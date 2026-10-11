-- Actividad principal elegida por la usuaria (decisión del 11/10/2026):
-- - Al entrar por primera vez con la Edición Personal elige su actividad principal (incluida).
-- - Puede sumar una secundaria con descuento durante la primera semana; después cada actividad sale al precio normal.
-- - Con Mensualidad Plus tiene todas (eso lo resuelve la app; no se crean filas).
insert into public.pricing_config (key, value_numeric, description) values
  ('activity_price_secondary', 5900, 'Actividad secundaria con descuento (primera semana)'),
  ('activity_price_extra', 8900, 'Actividad extra (precio normal)')
on conflict do nothing;

-- Las cuentas nuevas ya no reciben Yeso automáticamente: eligen su principal al entrar.
-- (Las que ya lo tenían lo conservan.)
create or replace function public.grant_free_activity(p_user_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  return;
end;
$$;

-- Elige la actividad principal (solo si todavía no tiene ninguna).
create or replace function public.choose_primary_activity(p_code text)
returns void
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_activity uuid;
  v_admin uuid;
  v_grant uuid;
begin
  if v_uid is null then raise exception 'Iniciá sesión.'; end if;
  if not exists (select 1 from licenses l join plans p on p.id = l.plan_id where l.user_id = v_uid and l.status = 'active' and p.code in ('BASIC', 'ADVANCED'))
     and not exists (select 1 from profiles where id = v_uid and (role = 'admin' or is_tester)) then
    raise exception 'La actividad principal viene con la Edición Personal.';
  end if;
  if exists (select 1 from user_activities where user_id = v_uid and status = 'active') then
    raise exception 'Ya elegiste tu actividad principal.';
  end if;
  select id into v_activity from activities where code = p_code and active;
  if v_activity is null then raise exception 'Esa actividad no existe.'; end if;
  select id into v_admin from profiles where role = 'admin' order by created_at limit 1;
  insert into dev_grants (user_id, grant_type, target_id, granted_by_admin_id, reason)
  values (v_uid, 'activity', v_activity, v_admin, 'Actividad principal elegida al entrar')
  returning id into v_grant;
  insert into user_activities (user_id, activity_id, dev_grant_id, is_primary, status)
  values (v_uid, v_activity, v_grant, true, 'active')
  on conflict (user_id, activity_id) do update set status = 'active', is_primary = true, dev_grant_id = excluded.dev_grant_id, purchase_id = null, acquired_at = now();
end;
$$;

-- Precio de una actividad para esta usuaria: con descuento si es la segunda y está en su primera semana.
create or replace function public.activity_price_for(p_user_id uuid)
returns numeric
language sql stable security definer
set search_path = public
as $$
  select case
    when (select count(*) from user_activities where user_id = p_user_id and status = 'active') = 1
     and exists (select 1 from user_activities where user_id = p_user_id and status = 'active' and is_primary and acquired_at > now() - interval '7 days')
     and not exists (select 1 from purchases where user_id = p_user_id and product_type = 'activity' and payment_status = 'approved')
    then (select value_numeric from pricing_config where key = 'activity_price_secondary')
    else (select value_numeric from pricing_config where key = 'activity_price_extra')
  end
$$;

-- Pedido de compra de una actividad (lo paga en Mercado Pago).
create or replace function public.request_activity_purchase(p_code text)
returns uuid
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_activity uuid;
  v_price numeric;
  v_purchase uuid;
begin
  if v_uid is null then raise exception 'Iniciá sesión para comprar.'; end if;
  if not exists (select 1 from licenses l join plans p on p.id = l.plan_id where l.user_id = v_uid and l.status = 'active' and p.code in ('BASIC', 'ADVANCED')) then
    raise exception 'Las actividades se suman a la Edición Personal.';
  end if;
  if not exists (select 1 from user_activities where user_id = v_uid and status = 'active') then
    raise exception 'Primero elegí tu actividad principal.';
  end if;
  select id into v_activity from activities where code = p_code and active;
  if v_activity is null then raise exception 'Esa actividad no existe.'; end if;
  if exists (select 1 from user_activities where user_id = v_uid and activity_id = v_activity and status = 'active') then
    raise exception 'Ya tenés esta actividad.';
  end if;
  v_price := public.activity_price_for(v_uid);
  -- Un pedido pendiente se reutiliza (con el precio de hoy).
  select id into v_purchase from purchases where user_id = v_uid and product_type = 'activity' and product_id = v_activity and payment_status = 'pending' order by created_at desc limit 1;
  if v_purchase is not null then
    update purchases set subtotal = v_price, total = v_price, updated_at = now() where id = v_purchase;
    return v_purchase;
  end if;
  insert into purchases (user_id, product_type, product_id, quantity, subtotal, discount_amount, total, currency, payment_provider, payment_status)
  values (v_uid, 'activity', v_activity, 1, v_price, 0, v_price, 'ARS', 'manual', 'pending')
  returning id into v_purchase;
  return v_purchase;
end;
$$;

-- Al aprobarse el pago: también activa actividades.
create or replace function public.apply_purchase_activation(p_purchase_id uuid)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_purchase purchases%rowtype;
  v_old licenses%rowtype;
  v_new uuid;
begin
  select * into v_purchase from purchases where id = p_purchase_id for update;
  if v_purchase.id is null or v_purchase.payment_status <> 'pending' then return 'purchase_not_pending'; end if;

  if v_purchase.product_type = 'license' then
    if exists (select 1 from licenses l join plans p on p.id = l.plan_id where l.user_id = v_purchase.user_id and l.status = 'active' and p.code in ('BASIC', 'ADVANCED')) then
      return 'already_has_license';
    end if;
    insert into licenses (user_id, plan_id, purchase_id, status, acquired_at, activated_at)
    values (v_purchase.user_id, v_purchase.product_id, v_purchase.id, 'active', now(), now());
  elsif v_purchase.product_type = 'license_upgrade' then
    select l.* into v_old from licenses l join plans p on p.id = l.plan_id
     where l.user_id = v_purchase.user_id and l.status = 'active' and p.code = 'BASIC' order by l.acquired_at desc limit 1 for update;
    if v_old.id is null then return 'no_basic_license'; end if;
    update licenses set status = 'replaced', updated_at = now() where id = v_old.id;
    insert into licenses (user_id, plan_id, purchase_id, status, acquired_at, activated_at, upgraded_from_license_id)
    values (v_purchase.user_id, v_purchase.product_id, v_purchase.id, 'active', now(), now(), v_old.id)
    returning id into v_new;
  elsif v_purchase.product_type = 'module' then
    insert into user_modules (user_id, module_id, purchase_id, status, acquired_at)
    values (v_purchase.user_id, v_purchase.product_id, v_purchase.id, 'active', now())
    on conflict (user_id, module_id) do nothing;
  elsif v_purchase.product_type = 'activity' then
    insert into user_activities (user_id, activity_id, purchase_id, is_primary, status, acquired_at)
    values (v_purchase.user_id, v_purchase.product_id, v_purchase.id, false, 'active', now())
    on conflict (user_id, activity_id) do update set status = 'active', purchase_id = excluded.purchase_id, dev_grant_id = null, acquired_at = now()
      where user_activities.status <> 'active';
  else
    return 'unsupported_product';
  end if;

  update purchases set payment_status = 'approved', completed_at = now(), updated_at = now() where id = v_purchase.id;
  perform public.create_commission_for_purchase(v_purchase.id);
  return 'activated';
end;
$$;

-- Devolución o arrepentimiento: también desactiva la actividad comprada.
create or replace function public.revoke_purchase_items(p_purchase_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_lic licenses%rowtype;
begin
  for v_lic in select * from licenses where purchase_id = p_purchase_id and status = 'active' loop
    update licenses set status = 'refunded', updated_at = now() where id = v_lic.id;
    if v_lic.upgraded_from_license_id is not null then
      update licenses set status = 'active', updated_at = now() where id = v_lic.upgraded_from_license_id and status = 'replaced';
    end if;
  end loop;
  update user_modules set status = 'refunded' where purchase_id = p_purchase_id and status = 'active';
  update user_activities set status = 'refunded' where purchase_id = p_purchase_id and status = 'active';
end;
$$;

-- Precios de las actividades desde Administración.
create or replace function public.admin_set_activity_prices(p_secondary numeric, p_extra numeric)
returns void
language plpgsql volatile security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Solo la administración puede hacer esto.'; end if;
  if least(p_secondary, p_extra) <= 0 then raise exception 'Los precios tienen que ser mayores a cero.'; end if;
  update pricing_config set value_numeric = p_secondary, updated_at = now() where key = 'activity_price_secondary';
  update pricing_config set value_numeric = p_extra, updated_at = now() where key = 'activity_price_extra';
  perform public.log_audit('prices.activities', 'pricing', null, null, jsonb_build_object('secondary', p_secondary, 'extra', p_extra));
end;
$$;

revoke all on function public.choose_primary_activity(text) from public, anon;
grant execute on function public.choose_primary_activity(text) to authenticated;
revoke all on function public.activity_price_for(uuid) from public, anon, authenticated;
grant execute on function public.activity_price_for(uuid) to service_role;
revoke all on function public.request_activity_purchase(text) from public, anon;
grant execute on function public.request_activity_purchase(text) to authenticated;
revoke all on function public.admin_set_activity_prices(numeric, numeric) from public, anon;
grant execute on function public.admin_set_activity_prices(numeric, numeric) to authenticated;
revoke all on function public.apply_purchase_activation(uuid) from public, anon, authenticated;
revoke all on function public.revoke_purchase_items(uuid) from public, anon, authenticated;

-- Precio que ve la usuaria para su próxima actividad.
create or replace function public.my_activity_price()
returns numeric
language sql stable security definer
set search_path = public
as $$ select public.activity_price_for(auth.uid()) $$;
revoke all on function public.my_activity_price() from public, anon;
grant execute on function public.my_activity_price() to authenticated;

-- Cambio del 11/10/2026: la secundaria sale SIEMPRE a mitad de precio (sin límite de tiempo).
create or replace function public.activity_price_for(p_user_id uuid)
returns numeric
language sql stable security definer
set search_path = public
as $$
  select case
    when (select count(*) from user_activities where user_id = p_user_id and status = 'active') = 1
     and not exists (select 1 from purchases where user_id = p_user_id and product_type = 'activity' and payment_status = 'approved')
    then round((select value_numeric from pricing_config where key = 'activity_price_extra') / 2)
    else (select value_numeric from pricing_config where key = 'activity_price_extra')
  end
$$;
update pricing_config set value_numeric = round((select value_numeric from pricing_config where key = 'activity_price_extra') / 2), description = 'Actividad secundaria: siempre la mitad del precio normal (se calcula sola)', updated_at = now() where key = 'activity_price_secondary';
create or replace function public.admin_set_activity_prices(p_secondary numeric, p_extra numeric)
returns void
language plpgsql volatile security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Solo la administración puede hacer esto.'; end if;
  if p_extra <= 0 then raise exception 'El precio tiene que ser mayor a cero.'; end if;
  update pricing_config set value_numeric = p_extra, updated_at = now() where key = 'activity_price_extra';
  update pricing_config set value_numeric = round(p_extra / 2), updated_at = now() where key = 'activity_price_secondary';
  perform public.log_audit('prices.activities', 'pricing', null, null, jsonb_build_object('extra', p_extra, 'secondary', round(p_extra / 2)));
end;
$$;
