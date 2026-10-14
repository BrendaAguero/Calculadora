-- 1) Licencias de cortesía por 1 mes, 2 meses o sin vencimiento.
alter table public.licenses add column if not exists expires_at timestamptz;
alter table public.licenses drop constraint if exists licenses_status_check;
alter table public.licenses add constraint licenses_status_check check (status = any (array['active', 'revoked', 'refunded', 'replaced', 'expired']));

-- (Nombre nuevo para no chocar con admin_grant_license de 3 parámetros, que queda sin uso.)
create or replace function public.admin_grant_license_for(p_user_id uuid, p_plan_code text, p_reason text, p_months integer)
returns uuid
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_plan uuid;
  v_grant uuid;
  v_license uuid;
begin
  if not public.is_admin() then raise exception 'No autorizado.'; end if;
  select id into v_plan from plans where code = p_plan_code and p_plan_code in ('BASIC', 'ADVANCED');
  if v_plan is null then raise exception 'Plan inválido.'; end if;
  if p_months is not null and (p_months < 1 or p_months > 24) then raise exception 'Duración inválida.'; end if;
  if exists (select 1 from licenses l join plans p on p.id = l.plan_id where l.user_id = p_user_id and l.status = 'active' and p.code in ('BASIC', 'ADVANCED')) then
    raise exception 'La cuenta ya tiene una licencia activa.';
  end if;
  insert into dev_grants (user_id, grant_type, target_id, granted_by_admin_id, reason)
  values (p_user_id, 'license', v_plan, auth.uid(), coalesce(nullif(trim(p_reason), ''), 'Licencia de cortesía'))
  returning id into v_grant;
  insert into licenses (user_id, plan_id, dev_grant_id, status, acquired_at, activated_at, expires_at)
  values (p_user_id, v_plan, v_grant, 'active', now(), now(), case when p_months is null then null else now() + make_interval(months => p_months) end)
  returning id into v_license;
  perform public.log_audit('license.grant', 'license', v_license, null, jsonb_build_object('user_id', p_user_id, 'plan', p_plan_code, 'reason', p_reason, 'months', p_months));
  return v_license;
end;
$$;
revoke all on function public.admin_grant_license_for(uuid, text, text, integer) from public, anon;
grant execute on function public.admin_grant_license_for(uuid, text, text, integer) to authenticated;

-- Las licencias vencidas pasan a «expired» (la app además ya no las cuenta desde el minuto en que vencen).
select cron.schedule('vencer-licencias', '7 * * * *', $job$
  update public.licenses set status = 'expired', updated_at = now()
   where status = 'active' and expires_at is not null and expires_at <= now();
$job$);

-- 2) Modo revendedora para cualquier cuenta (también la gratis).
create or replace function public.become_reseller() returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  if auth.uid() is null then raise exception 'Iniciá sesión.'; end if;
  insert into reseller_accounts (user_id) values (auth.uid()) on conflict (user_id) do nothing;
end;
$$;

-- Al aprobarse un paquete de 5 o más licencias, la revendedora recibe su propia Edición Personal de regalo
-- (si todavía no tiene una). Vale para cualquier forma de aprobación (Mercado Pago o administración).
create or replace function public.reseller_gift_license() returns trigger
language plpgsql security definer set search_path to 'public'
as $$
begin
  if new.status = 'approved' and coalesce(old.status, '') <> 'approved' and new.quantity >= 5 then
    perform public.grant_personal_license(new.user_id, 'Regalo por paquete de revendedora');
  end if;
  return new;
end;
$$;
revoke all on function public.reseller_gift_license() from public, anon, authenticated;
create trigger reseller_orders_gift_license after update of status on public.reseller_orders
  for each row execute function public.reseller_gift_license();

-- 3) Precio tachado (precio normal después del lanzamiento): 0 = no se muestra.
insert into public.pricing_config (key, value_numeric) values ('personal_price_regular', 0)
on conflict (key) do nothing;

create or replace function public.admin_set_regular_price(p_price numeric) returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.is_admin() then raise exception 'Solo la administración puede hacer esto.'; end if;
  if p_price is null or p_price < 0 then raise exception 'Precio inválido.'; end if;
  update pricing_config set value_numeric = p_price where key = 'personal_price_regular';
  perform public.log_audit('prices.regular', 'pricing', null, null, jsonb_build_object('price', p_price));
end;
$$;
revoke all on function public.admin_set_regular_price(numeric) from public, anon;
grant execute on function public.admin_set_regular_price(numeric) to authenticated;
