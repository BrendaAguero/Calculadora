-- Edición Personal (decisión del 11/10/2026): la app pasa a venderse solo como Edición Personal.
-- * Pago único (plan ADVANCED, renombrado «Edición Personal»): funciones de gestión, límites de Avanzado, Yeso,
--   banner, 2 aparatos. Precios: $44.900 online, $40.000 transferencia, $49.900 MercadoLibre.
-- * Mensualidad Plus (la suscripción mensual que ya existía): $4.900, quita el banner, desbloquea actividades y
--   módulos, sin límites y (más adelante) modo sin conexión. Requiere la Edición Personal.
-- * Solo pueden entrar emails aprobados (compra online, o aprobados a mano por la administración).
-- Nada se borra: los planes viejos quedan desactivados.

update public.plans set name = 'Edición Personal', price = 44900,
  description = 'Pago único. Funciones de gestión, límites de Avanzado, Yeso, con banner, 2 aparatos.', updated_at = now()
 where code = 'ADVANCED';
update public.plans set active = false, updated_at = now() where code in ('BASIC', 'FREE');

update public.subscription_plans_catalog set price = 4900, updated_at = now() where duration_months = 1;
update public.subscription_plans_catalog set active = false, updated_at = now() where duration_months in (6, 12);
-- La mensualidad tiene precio fijo: los descuentos de Emprendedor quedan desactivados.
update public.discount_rules set active = false, updated_at = now() where active;

insert into public.pricing_config (key, value_numeric, description) values
  ('personal_price_online', 44900, 'Edición Personal comprada en la app con Mercado Pago'),
  ('personal_price_transfer', 40000, 'Edición Personal por transferencia (se aprueba a mano)'),
  ('personal_price_mercadolibre', 49900, 'Edición Personal en MercadoLibre (se aprueba a mano)'),
  ('included_devices', 2, 'Aparatos incluidos en la Edición Personal')
on conflict do nothing;

-- Módulo «Aparato extra» (se puede comprar varias veces: cada compra suma un aparato).
insert into public.modules (code, name, description, price, currency, active)
select 'EXTRA_DEVICE', 'Aparato extra', 'Usá la app en un aparato más.', 4900, 'ARS', true
where not exists (select 1 from public.modules where code = 'EXTRA_DEVICE');

create or replace function public.sellable_module(p_code text)
returns boolean
language sql immutable
as $$ select p_code in ('STOCK_BASICO', 'PROVEEDORES_BASICO', 'EXTRA_DEVICE') $$;

-- ---------------------------------------------------------------------------------------------
-- Emails aprobados

create table if not exists public.approved_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text not null check (source in ('online', 'transferencia', 'mercadolibre', 'revendedora', 'cortesia')),
  status text not null default 'approved' check (status in ('approved', 'revoked')),
  note text check (note is null or char_length(note) <= 500),
  user_id uuid references auth.users(id) on delete set null,
  license_id uuid references public.licenses(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists approved_emails_email_unique on public.approved_emails (lower(email));
alter table public.approved_emails enable row level security;
create policy approved_emails_select on public.approved_emails
  for select to authenticated using (public.is_admin() or user_id = auth.uid());

-- Pedidos online de la Edición Personal (todavía sin cuenta: se compra con el email).
create table if not exists public.personal_orders (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  full_name text check (full_name is null or char_length(full_name) <= 120),
  total numeric not null check (total > 0),
  currency text not null default 'ARS',
  status text not null default 'pending' check (status in ('pending', 'approved', 'canceled', 'refunded')),
  payment_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.personal_orders enable row level security;
create policy personal_orders_select_admin on public.personal_orders for select to authenticated using (public.is_admin());

-- Da la Edición Personal a una cuenta (si no tiene ya una licencia activa). Uso interno.
create or replace function public.grant_personal_license(p_user_id uuid, p_reason text)
returns uuid
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_plan uuid;
  v_admin uuid;
  v_grant uuid;
  v_license uuid;
begin
  select l.id into v_license from licenses l join plans p on p.id = l.plan_id
   where l.user_id = p_user_id and l.status = 'active' and p.code in ('BASIC', 'ADVANCED') limit 1;
  if v_license is not null then return v_license; end if;
  select id into v_plan from plans where code = 'ADVANCED';
  select id into v_admin from profiles where role = 'admin' order by created_at limit 1;
  insert into dev_grants (user_id, grant_type, target_id, granted_by_admin_id, reason)
  values (p_user_id, 'license', v_plan, coalesce(auth.uid(), v_admin), p_reason)
  returning id into v_grant;
  insert into licenses (user_id, plan_id, dev_grant_id, status, acquired_at, activated_at)
  values (p_user_id, v_plan, v_grant, 'active', now(), now())
  returning id into v_license;
  return v_license;
end;
$$;

-- Aprueba un email (o lo reactiva) y, si la cuenta ya existe, le da la licencia. Uso interno.
create or replace function public.approve_email_internal(p_email text, p_source text, p_note text)
returns uuid
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_row approved_emails%rowtype;
  v_user uuid;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Revisá el email.'; end if;
  insert into approved_emails (email, source, note, approved_by)
  values (v_email, p_source, nullif(left(btrim(coalesce(p_note, '')), 500), ''), auth.uid())
  on conflict (lower(email)) do update set status = 'approved', updated_at = now(),
    note = coalesce(excluded.note, approved_emails.note)
  returning * into v_row;
  select id into v_user from profiles where lower(email) = v_email limit 1;
  if v_user is not null then
    update approved_emails set user_id = v_user,
      license_id = public.grant_personal_license(v_user, 'Edición Personal · ' || v_row.source)
     where id = v_row.id;
  end if;
  return v_row.id;
end;
$$;

create or replace function public.admin_approve_email(p_email text, p_source text, p_note text default null)
returns uuid
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then raise exception 'Solo la administración puede hacer esto.'; end if;
  if p_source not in ('transferencia', 'mercadolibre', 'revendedora', 'cortesia', 'online') then raise exception 'Origen no válido.'; end if;
  v_id := public.approve_email_internal(p_email, p_source, p_note);
  perform public.log_audit('email.approve', 'approved_email', v_id, null, jsonb_build_object('email', lower(btrim(p_email)), 'source', p_source));
  return v_id;
end;
$$;

-- Revocar quita el permiso de entrar con ese email (la licencia queda revocada).
create or replace function public.admin_revoke_email(p_id uuid)
returns void
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_row approved_emails%rowtype;
begin
  if not public.is_admin() then raise exception 'Solo la administración puede hacer esto.'; end if;
  update approved_emails set status = 'revoked', updated_at = now() where id = p_id returning * into v_row;
  if v_row.id is null then raise exception 'No se encontró el email.'; end if;
  if v_row.license_id is not null then
    update licenses set status = 'revoked', updated_at = now() where id = v_row.license_id and status = 'active';
  end if;
  perform public.log_audit('email.revoke', 'approved_email', p_id, null, jsonb_build_object('email', v_row.email));
end;
$$;

-- ¿Puede pedir código de ingreso? (email aprobado o cuenta existente activa). Solo el servidor la consulta.
create or replace function public.login_allowed(p_email text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from approved_emails where lower(email) = lower(btrim(p_email)) and status = 'approved')
      or exists (select 1 from profiles where lower(email) = lower(btrim(p_email)) and account_status = 'active');
$$;

-- Pedido online sin cuenta.
create or replace function public.create_personal_order(p_email text, p_full_name text)
returns uuid
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_price numeric;
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
  insert into personal_orders (email, full_name, total) values (v_email, nullif(left(btrim(coalesce(p_full_name, '')), 120), ''), coalesce(v_price, 44900))
  returning id into v_id;
  return v_id;
end;
$$;

-- Pago de un pedido online (confirmado consultando a Mercado Pago). Al aprobarse, aprueba el email.
create or replace function public.mp_record_personal_order(p jsonb)
returns text
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_order personal_orders%rowtype;
begin
  select * into v_order from personal_orders where id = (p->>'order_id')::uuid for update;
  if v_order.id is null then return 'order_not_found'; end if;
  if p->>'status' in ('refunded', 'charged_back') then
    if v_order.status = 'approved' then
      update personal_orders set status = 'refunded', updated_at = now() where id = v_order.id;
      update approved_emails set status = 'revoked', updated_at = now() where lower(email) = lower(v_order.email) and source = 'online';
      update licenses set status = 'refunded', updated_at = now()
       where id in (select license_id from approved_emails where lower(email) = lower(v_order.email)) and status = 'active';
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
  return 'activated';
end;
$$;

-- Al crear una cuenta: Yeso y, si el email está aprobado, la Edición Personal.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
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
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Aparatos: 2 incluidos + 1 por cada «Aparato extra» comprado (o todos con Mensualidad Plus no: siguen siendo 2+extras).

create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null check (char_length(device_id) between 16 and 64),
  label text check (label is null or char_length(label) <= 120),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  released_at timestamptz
);
create unique index if not exists user_devices_active_unique on public.user_devices (user_id, device_id) where released_at is null;
alter table public.user_devices enable row level security;
create policy user_devices_select on public.user_devices for select to authenticated using (user_id = auth.uid() or public.is_admin());

create or replace function public.allowed_devices(p_user_id uuid)
returns int
language sql stable security definer
set search_path = public
as $$
  select coalesce((select value_numeric::int from pricing_config where key = 'included_devices'), 2)
       + (select count(*)::int from purchases pu join modules m on m.id = pu.product_id
           where pu.user_id = p_user_id and pu.product_type = 'module' and m.code = 'EXTRA_DEVICE' and pu.payment_status = 'approved');
$$;

-- Registra el aparato al entrar. Devuelve 'ok' o 'limit' (si ya usa todos sus aparatos).
create or replace function public.register_device(p_device_id text, p_label text)
returns text
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Iniciá sesión.'; end if;
  if exists (select 1 from profiles where id = v_uid and (role = 'admin' or is_tester)) then return 'ok'; end if;
  if exists (select 1 from user_devices where user_id = v_uid and device_id = p_device_id and released_at is null) then
    update user_devices set last_seen_at = now() where user_id = v_uid and device_id = p_device_id and released_at is null;
    return 'ok';
  end if;
  if (select count(*) from user_devices where user_id = v_uid and released_at is null) >= public.allowed_devices(v_uid) then
    return 'limit';
  end if;
  insert into user_devices (user_id, device_id, label) values (v_uid, p_device_id, nullif(left(btrim(coalesce(p_label, '')), 120), ''));
  return 'ok';
end;
$$;

-- Liberar un aparato (la persona, uno propio; la administración, cualquiera).
create or replace function public.release_device(p_id uuid)
returns void
language plpgsql volatile security definer
set search_path = public
as $$
begin
  update user_devices set released_at = now()
   where id = p_id and released_at is null and (user_id = auth.uid() or public.is_admin());
  if not found then raise exception 'No se encontró el aparato.'; end if;
  if public.is_admin() then perform public.log_audit('device.release', 'user_device', p_id, null, null); end if;
end;
$$;

-- «Aparato extra» se puede comprar más de una vez.
create or replace function public.request_module_purchase(p_module_code text)
returns uuid
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_module modules%rowtype;
  v_purchase uuid;
begin
  if v_uid is null then raise exception 'Iniciá sesión para comprar.'; end if;
  select * into v_module from modules where code = p_module_code and active;
  if v_module.id is null or not public.sellable_module(v_module.code) then raise exception 'Este módulo todavía no está disponible.'; end if;
  if not exists (select 1 from licenses l join plans p on p.id = l.plan_id where l.user_id = v_uid and l.status = 'active' and p.code in ('BASIC', 'ADVANCED')) then
    raise exception 'Los extras se suman a la Edición Personal.';
  end if;
  if v_module.code <> 'EXTRA_DEVICE' and exists (select 1 from user_modules where user_id = v_uid and module_id = v_module.id and status = 'active') then
    raise exception 'Ya tenés este módulo.';
  end if;
  select id into v_purchase from purchases
   where user_id = v_uid and product_type = 'module' and product_id = v_module.id and payment_status = 'pending'
   order by created_at desc limit 1;
  if v_purchase is not null then return v_purchase; end if;
  insert into purchases (user_id, product_type, product_id, quantity, subtotal, discount_amount, total, currency, payment_provider, payment_status)
  values (v_uid, 'module', v_module.id, 1, v_module.price, 0, v_module.price, 'ARS', 'manual', 'pending')
  returning id into v_purchase;
  return v_purchase;
end;
$$;

-- Permisos
revoke all on function public.grant_personal_license(uuid, text) from public, anon, authenticated;
revoke all on function public.approve_email_internal(text, text, text) from public, anon, authenticated;
revoke all on function public.mp_record_personal_order(jsonb) from public, anon, authenticated;
revoke all on function public.login_allowed(text) from public, anon, authenticated;
revoke all on function public.allowed_devices(uuid) from public, anon;
grant execute on function public.mp_record_personal_order(jsonb) to service_role;
grant execute on function public.login_allowed(text) to service_role;
grant execute on function public.allowed_devices(uuid) to authenticated;
revoke all on function public.admin_approve_email(text, text, text) from public, anon;
revoke all on function public.admin_revoke_email(uuid) from public, anon;
revoke all on function public.create_personal_order(text, text) from public;
revoke all on function public.register_device(text, text) from public, anon;
revoke all on function public.release_device(uuid) from public, anon;
grant execute on function public.admin_approve_email(text, text, text) to authenticated;
grant execute on function public.admin_revoke_email(uuid) to authenticated;
grant execute on function public.create_personal_order(text, text) to anon, authenticated;
grant execute on function public.register_device(text, text) to authenticated;
grant execute on function public.release_device(uuid) to authenticated;

-- La administración cambia los precios (por ejemplo, por inflación). Los pedidos ya creados mantienen su precio.
create or replace function public.admin_set_prices(p_online numeric, p_transfer numeric, p_mercadolibre numeric, p_monthly numeric, p_extra_device numeric)
returns void
language plpgsql volatile security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Solo la administración puede hacer esto.'; end if;
  if least(p_online, p_transfer, p_mercadolibre, p_monthly, p_extra_device) <= 0 then raise exception 'Los precios tienen que ser mayores a cero.'; end if;
  update pricing_config set value_numeric = p_online, updated_at = now() where key = 'personal_price_online';
  update pricing_config set value_numeric = p_transfer, updated_at = now() where key = 'personal_price_transfer';
  update pricing_config set value_numeric = p_mercadolibre, updated_at = now() where key = 'personal_price_mercadolibre';
  update plans set price = p_online, updated_at = now() where code = 'ADVANCED';
  update subscription_plans_catalog set price = p_monthly, updated_at = now() where duration_months = 1;
  update modules set price = p_extra_device, updated_at = now() where code = 'EXTRA_DEVICE';
  perform public.log_audit('prices.update', 'pricing', null, null, jsonb_build_object('online', p_online, 'transfer', p_transfer, 'mercadolibre', p_mercadolibre, 'monthly', p_monthly, 'extra_device', p_extra_device));
end;
$$;
revoke all on function public.admin_set_prices(numeric, numeric, numeric, numeric, numeric) from public, anon;
grant execute on function public.admin_set_prices(numeric, numeric, numeric, numeric, numeric) to authenticated;
