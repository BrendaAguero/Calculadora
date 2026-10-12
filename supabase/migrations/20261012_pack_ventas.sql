-- Pack Ventas y Stock: ventas, resumen, stock, producción, compras y proveedores van juntos en un extra.
-- Ya no vienen con la Edición Personal; la Mensualidad Plus los incluye. Al comprar la Edición Personal
-- online se puede sumar el pack con descuento.

insert into public.modules (code, name, description, price, currency, active)
values ('PACK_VENTAS', 'Pack Ventas y Stock', 'Ventas, resumen, stock, producción, compras y proveedores.', 10000, 'ARS', true)
on conflict (code) do update set name = excluded.name, description = excluded.description, active = true;

-- Los módulos sueltos de stock y proveedores quedan reemplazados por el pack (no se borran: quien los tenga los conserva).
update public.modules set active = false, updated_at = now() where code in ('STOCK_BASICO', 'PROVEEDORES_BASICO');

-- Precio del pack si se suma al comprar la Edición Personal.
insert into public.pricing_config (key, value_numeric)
values ('pack_ventas_with_personal', 7000)
on conflict (key) do nothing;

create or replace function public.sellable_module(p_code text) returns boolean
language sql immutable set search_path to 'public'
as $$ select p_code in ('PACK_VENTAS', 'EXTRA_DEVICE') $$;

alter table public.personal_orders add column if not exists with_pack boolean not null default false;
alter table public.approved_emails add column if not exists with_pack boolean not null default false;

-- Otorga el pack (con constancia en dev_grants, como la licencia de la compra online).
create or replace function public.grant_pack_module(p_user_id uuid, p_reason text) returns void
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_module uuid;
  v_admin uuid;
  v_grant uuid;
begin
  select id into v_module from modules where code = 'PACK_VENTAS';
  if v_module is null or exists (select 1 from user_modules where user_id = p_user_id and module_id = v_module and status = 'active') then return; end if;
  select id into v_admin from profiles where role = 'admin' order by created_at limit 1;
  insert into dev_grants (user_id, grant_type, target_id, granted_by_admin_id, reason)
  values (p_user_id, 'module', v_module, coalesce(auth.uid(), v_admin), p_reason)
  returning id into v_grant;
  insert into user_modules (user_id, module_id, dev_grant_id, status)
  values (p_user_id, v_module, v_grant, 'active')
  on conflict (user_id, module_id) do update set status = 'active', dev_grant_id = excluded.dev_grant_id, purchase_id = null, acquired_at = now();
end;
$$;
revoke all on function public.grant_pack_module(uuid, text) from public, anon, authenticated;

-- Pedido online que puede incluir el pack. Devuelve el id y el total a cobrar.
-- (create_personal_order queda para compatibilidad, la app usa esta.)
create or replace function public.create_personal_order_v2(p_email text, p_full_name text, p_with_pack boolean)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_price numeric;
  v_pack numeric := 0;
  v_id uuid;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Revisá el email.'; end if;
  if exists (select 1 from approved_emails where lower(email) = v_email and status = 'approved') then
    raise exception 'Ese email ya tiene la Edición Personal. Entrá con tu email.';
  end if;
  if (select count(*) from personal_orders where lower(email) = v_email and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Hiciste muchos pedidos hoy. Si tenés un problema, escribinos.';
  end if;
  select value_numeric into v_price from pricing_config where key = 'personal_price_online';
  if coalesce(p_with_pack, false) then
    select coalesce((select value_numeric from pricing_config where key = 'pack_ventas_with_personal'), 7000) into v_pack;
  end if;
  insert into personal_orders (email, full_name, total, with_pack)
  values (v_email, nullif(left(btrim(coalesce(p_full_name, '')), 120), ''), coalesce(v_price, 44900) + v_pack, coalesce(p_with_pack, false))
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'total', coalesce(v_price, 44900) + v_pack);
end;
$$;
revoke all on function public.create_personal_order_v2(text, text, boolean) from public;
grant execute on function public.create_personal_order_v2(text, text, boolean) to anon, authenticated;

-- Pago aprobado: además de la Edición Personal, el pack si se pidió. Reintegro: se quitan los dos.
create or replace function public.mp_record_personal_order(p jsonb) returns text
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_order personal_orders%rowtype;
  v_user uuid;
begin
  select * into v_order from personal_orders where id = (p->>'order_id')::uuid for update;
  if v_order.id is null then return 'order_not_found'; end if;
  if p->>'status' in ('refunded', 'charged_back') then
    if v_order.status = 'approved' then
      update personal_orders set status = 'refunded', updated_at = now() where id = v_order.id;
      update approved_emails set status = 'revoked', updated_at = now() where lower(email) = lower(v_order.email) and source = 'online';
      update licenses set status = 'refunded', updated_at = now()
       where id in (select license_id from approved_emails where lower(email) = lower(v_order.email)) and status = 'active';
      if v_order.with_pack then
        update user_modules set status = 'refunded'
         where dev_grant_id in (select id from dev_grants where reason = 'Pack Ventas · pedido ' || v_order.id::text) and status = 'active';
      end if;
      return 'refunded';
    end if;
    return 'refund_ignored';
  end if;
  if p->>'status' <> 'approved' then return 'recorded_' || coalesce(p->>'status', 'unknown'); end if;
  if v_order.status = 'approved' then return 'already_approved'; end if;
  if v_order.status <> 'pending' then return 'order_not_pending'; end if;
  if abs((p->>'amount')::numeric - v_order.total) > 0.01 or coalesce(p->>'currency', 'ARS') <> v_order.currency then return 'amount_mismatch'; end if;
  update personal_orders set status = 'approved', payment_reference = p->>'payment_id', updated_at = now() where id = v_order.id;
  perform public.approve_email_internal(v_order.email, 'online', 'Pedido online ' || v_order.id::text);
  if v_order.with_pack then
    -- Si la cuenta ya existe se otorga ahora; si no, al crearse (handle_new_user).
    update approved_emails set with_pack = true, note = coalesce(note, '') || ' · pack ' || v_order.id::text
     where lower(email) = lower(v_order.email) returning user_id into v_user;
    if v_user is not null then perform public.grant_pack_module(v_user, 'Pack Ventas · pedido ' || v_order.id::text); end if;
  end if;
  return 'activated';
end;
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_approved approved_emails%rowtype;
begin
  insert into public.profiles (id, full_name, email, terms_accepted_at)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    case when (new.raw_user_meta_data ->> 'terms_accepted') = 'true' then now() else null end
  );
  insert into public.user_preferences (user_id) values (new.id);
  perform public.grant_free_activity(new.id);

  select * into v_approved from approved_emails where lower(email) = lower(new.email) and status = 'approved';
  if v_approved.id is not null then
    update approved_emails set user_id = new.id,
      license_id = public.grant_personal_license(new.id, 'Edición Personal · ' || v_approved.source)
     where id = v_approved.id;
    if v_approved.with_pack then
      perform public.grant_pack_module(new.id, 'Pack Ventas · pedido ' || coalesce(substring(v_approved.note from 'pack ([0-9a-f-]{36})'), v_approved.id::text));
    end if;
  end if;
  return new;
end;
$$;

-- Administración: precios del pack y otorgarlo a pagos por transferencia o MercadoLibre.
create or replace function public.admin_set_pack_prices(p_pack numeric, p_with_personal numeric) returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.is_admin() then raise exception 'Solo la administración puede hacer esto.'; end if;
  if not (p_pack > 0) or not (p_with_personal > 0) then raise exception 'Los precios tienen que ser mayores a cero.'; end if;
  update modules set price = p_pack, updated_at = now() where code = 'PACK_VENTAS';
  insert into pricing_config (key, value_numeric) values ('pack_ventas_with_personal', p_with_personal)
  on conflict (key) do update set value_numeric = excluded.value_numeric;
  perform public.log_audit('prices.pack', 'module', null, null, jsonb_build_object('pack', p_pack, 'with_personal', p_with_personal));
end;
$$;
revoke all on function public.admin_set_pack_prices(numeric, numeric) from public, anon;
grant execute on function public.admin_set_pack_prices(numeric, numeric) to authenticated;

create or replace function public.admin_give_pack(p_id uuid) returns void
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_row approved_emails%rowtype;
begin
  if not public.is_admin() then raise exception 'Solo la administración puede hacer esto.'; end if;
  update approved_emails set with_pack = true, updated_at = now() where id = p_id and status = 'approved' returning * into v_row;
  if v_row.id is null then raise exception 'No se encontró ese email aprobado.'; end if;
  if v_row.user_id is not null then perform public.grant_pack_module(v_row.user_id, 'Pack Ventas · administración ' || v_row.id::text); end if;
  perform public.log_audit('email.pack', 'approved_email', v_row.id, null, jsonb_build_object('email', v_row.email));
end;
$$;
revoke all on function public.admin_give_pack(uuid) from public, anon;
grant execute on function public.admin_give_pack(uuid) to authenticated;
