-- 1) Protección del precio de revendedoras: el precio más bajo al público (con el mayor descuento automático encendido)
--    tiene que dejarle a la revendedora al menos el margen mínimo. Si un cambio lo rompe, se rechaza y se explica por qué.
insert into public.pricing_config (key, value_numeric, description) values
  ('reseller_min_margin_pct', 20, 'Margen mínimo (%) que le tiene que quedar a una revendedora frente al precio más bajo al público')
on conflict (key) do nothing;

create or replace function public.pricing_guard_check() returns void
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_online numeric;
  v_transfer numeric;
  v_reseller numeric;
  v_margin numeric;
  v_discount numeric;
  v_public numeric;
  v_limit numeric;
  v_max_discount numeric;
begin
  select value_numeric into v_online from pricing_config where key = 'personal_price_online';
  select value_numeric into v_transfer from pricing_config where key = 'personal_price_transfer';
  select value_numeric into v_reseller from pricing_config where key = 'reseller_unit_price';
  select coalesce(value_numeric, 20) into v_margin from pricing_config where key = 'reseller_min_margin_pct';
  if v_online is null or v_reseller is null then return; end if;
  -- Un solo descuento por compra: cuenta el mayor de los avisos automáticos encendidos que dan descuento.
  select coalesce(max(discount_pct), 0) into v_discount from auto_notices
   where active and code in ('free_discount', 'courtesy_ending');
  v_public := least(v_online, coalesce(v_transfer, v_online)) * (100 - v_discount) / 100;
  v_limit := v_public * (100 - coalesce(v_margin, 20)) / 100;
  if v_reseller > v_limit then
    v_max_discount := greatest(floor((1 - v_reseller / (least(v_online, coalesce(v_transfer, v_online)) * (100 - coalesce(v_margin, 20)) / 100)) * 100), 0);
    raise exception 'Así una revendedora casi no gana: el precio más bajo al público quedaría en $% y ella paga $% por licencia (necesita al menos % %% de margen). Bajá el descuento automático a % %% o menos, subí el precio al público o bajá el precio de revendedora.',
      replace(to_char(round(v_public), 'FM999,999,999'), ',', '.'), replace(to_char(round(v_reseller), 'FM999,999,999'), ',', '.'), round(v_margin), v_max_discount;
  end if;
end;
$$;
revoke all on function public.pricing_guard_check() from public, anon, authenticated;

create or replace function public.pricing_guard_trigger() returns trigger
language plpgsql security definer set search_path to 'public'
as $$
begin
  perform public.pricing_guard_check();
  return null;
end;
$$;
revoke all on function public.pricing_guard_trigger() from public, anon, authenticated;

create trigger pricing_config_guard after insert or update on public.pricing_config
  for each statement execute function public.pricing_guard_trigger();
create trigger auto_notices_guard after update on public.auto_notices
  for each statement execute function public.pricing_guard_trigger();

create or replace function public.admin_set_reseller_margin(p_pct numeric) returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.is_admin() then raise exception 'Solo la administración puede hacer esto.'; end if;
  if p_pct is null or p_pct < 0 or p_pct > 80 then raise exception 'El margen va de 0 a 80 %%.'; end if;
  update pricing_config set value_numeric = p_pct, updated_at = now() where key = 'reseller_min_margin_pct';
  perform public.log_audit('prices.reseller_margin', 'pricing', null, null, jsonb_build_object('pct', p_pct));
end;
$$;
revoke all on function public.admin_set_reseller_margin(numeric) from public, anon;
grant execute on function public.admin_set_reseller_margin(numeric) to authenticated;

-- 2) Ajuste por inflación: sube todos los precios juntos el % indicado, redondeados a $100. Queda la fecha del último ajuste.
insert into public.pricing_config (key, value_numeric, value_text, description) values
  ('last_price_adjust', null, null, 'Último ajuste de precios por inflación (fecha en value_text, % en value_numeric)')
on conflict (key) do nothing;

create or replace function public.admin_adjust_prices(p_pct numeric) returns void
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_factor numeric;
begin
  if not public.is_admin() then raise exception 'Solo la administración puede hacer esto.'; end if;
  if p_pct is null or p_pct <= 0 or p_pct > 100 then raise exception 'Poné un porcentaje entre 0,1 y 100.'; end if;
  v_factor := 1 + p_pct / 100;
  update pricing_config set value_numeric = round(value_numeric * v_factor / 100) * 100, updated_at = now()
   where key in ('personal_price_online', 'personal_price_transfer', 'personal_price_mercadolibre', 'personal_price_regular',
                 'activity_price_extra', 'activity_price_secondary', 'reseller_unit_price', 'pack_ventas_with_personal')
     and coalesce(value_numeric, 0) > 0;
  update plans set price = (select value_numeric from pricing_config where key = 'personal_price_online'), updated_at = now() where code = 'ADVANCED';
  update modules set price = round(price * v_factor / 100) * 100, updated_at = now() where active and price > 0;
  update subscription_plans_catalog set price = round(price * v_factor / 100) * 100, updated_at = now() where active and price > 0;
  update pricing_config set value_numeric = p_pct, value_text = to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF'), updated_at = now() where key = 'last_price_adjust';
  perform public.log_audit('prices.inflation', 'pricing', null, null, jsonb_build_object('pct', p_pct));
end;
$$;
revoke all on function public.admin_adjust_prices(numeric) from public, anon;
grant execute on function public.admin_adjust_prices(numeric) to authenticated;

-- 3) Descuento por antigüedad para pasar de la Edición Personal a Personal Plus: cuanto más tiempo, más descuento.
--    (Las reglas viejas de «antigüedad» y «compra reciente» quedan apagadas.)
update public.discount_rules set active = false where discount_type in ('entrepreneur_age', 'recent_base_purchase');
alter table public.discount_rules drop constraint if exists discount_rules_discount_type_check;
alter table public.discount_rules add constraint discount_rules_discount_type_check
  check (discount_type = any (array['entrepreneur_age', 'recent_base_purchase', 'promotional', 'personal_loyalty']));
insert into public.discount_rules (discount_type, name, min_days, max_days, duration_months, percentage, active)
select 'personal_loyalty', v.name, v.min_days, null, null, v.pct, true
  from (values ('Antigüedad Edición Personal: 3 meses', 90, 10), ('Antigüedad Edición Personal: 6 meses', 180, 15), ('Antigüedad Edición Personal: 1 año', 365, 25)) v(name, min_days, pct)
 where not exists (select 1 from public.discount_rules where discount_type = 'personal_loyalty');

create or replace function public.admin_set_loyalty_discounts(p_d1 integer, p_p1 numeric, p_d2 integer, p_p2 numeric, p_d3 integer, p_p3 numeric) returns void
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_ids uuid[];
begin
  if not public.is_admin() then raise exception 'Solo la administración puede hacer esto.'; end if;
  if least(p_d1, p_d2, p_d3) < 0 or greatest(p_p1, p_p2, p_p3) > 60 or least(p_p1, p_p2, p_p3) < 0 then
    raise exception 'Los días van desde 0 y los descuentos de 0 a 60 %%.';
  end if;
  if not (p_d1 < p_d2 and p_d2 < p_d3) then raise exception 'Los plazos tienen que ir de menor a mayor.'; end if;
  select array_agg(id order by min_days) into v_ids from discount_rules where discount_type = 'personal_loyalty';
  update discount_rules set min_days = p_d1, percentage = p_p1, name = 'Antigüedad Edición Personal: ' || p_d1 || ' días', updated_at = now() where id = v_ids[1];
  update discount_rules set min_days = p_d2, percentage = p_p2, name = 'Antigüedad Edición Personal: ' || p_d2 || ' días', updated_at = now() where id = v_ids[2];
  update discount_rules set min_days = p_d3, percentage = p_p3, name = 'Antigüedad Edición Personal: ' || p_d3 || ' días', updated_at = now() where id = v_ids[3];
  perform public.log_audit('prices.loyalty', 'pricing', null, null, jsonb_build_object('d', array[p_d1, p_d2, p_d3], 'pct', array[p_p1, p_p2, p_p3]));
end;
$$;
revoke all on function public.admin_set_loyalty_discounts(integer, numeric, integer, numeric, integer, numeric) from public, anon;
grant execute on function public.admin_set_loyalty_discounts(integer, numeric, integer, numeric, integer, numeric) to authenticated;

create or replace function public.quote_entrepreneur(p_months integer)
returns jsonb
language plpgsql stable security definer set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_catalog_id uuid;
  v_price numeric;
  v_plan_id uuid;
  v_plan_code text;
  v_age_days int;
  v_pct numeric := 0;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Iniciá sesión.');
  end if;

  select c.id, c.price into v_catalog_id, v_price
  from subscription_plans_catalog c
  where c.duration_months = p_months and c.active and c.valid_from <= now() and (c.valid_until is null or c.valid_until > now())
  order by c.valid_from desc limit 1;
  if v_catalog_id is null then
    return jsonb_build_object('ok', false, 'error', 'Ese plazo no está disponible.');
  end if;

  select l.plan_id, p.code into v_plan_id, v_plan_code
  from licenses l join plans p on p.id = l.plan_id
  where l.user_id = v_uid and l.status = 'active' and p.code in ('BASIC', 'ADVANCED')
  order by (p.code = 'ADVANCED') desc limit 1;

  if v_plan_id is null then
    -- Sin Edición Personal: precio de lista, con el plan completo como base.
    select id, code into v_plan_id, v_plan_code from plans where code = 'ADVANCED';
  else
    -- Con Edición Personal: descuento según el tiempo que la tiene (la licencia pagada más antigua).
    select floor(extract(epoch from now() - min(coalesce(l.activated_at, l.acquired_at))) / 86400)::int into v_age_days
    from licenses l join plans p on p.id = l.plan_id
    where l.user_id = v_uid and p.code in ('BASIC', 'ADVANCED') and l.status in ('active', 'replaced') and l.dev_grant_id is null;
    if v_age_days is not null then
      select coalesce(max(percentage), 0) into v_pct from discount_rules
       where discount_type = 'personal_loyalty' and active and v_age_days >= min_days
         and (duration_months is null or duration_months = p_months)
         and valid_from <= now() and (valid_until is null or valid_until > now());
    end if;
  end if;

  return jsonb_build_object(
    'ok', true, 'catalog_id', v_catalog_id, 'months', p_months, 'base_plan_id', v_plan_id, 'base_plan', v_plan_code,
    'price', v_price, 'age_days', v_age_days, 'age_pct', v_pct, 'recent_days', null, 'recent_pct', 0,
    'discount_pct', v_pct, 'final_price', round(v_price * (1 - v_pct / 100), 2)
  );
end;
$$;
