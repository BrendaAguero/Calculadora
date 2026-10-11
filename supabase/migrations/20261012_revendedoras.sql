-- Modo revendedora (decisión del 11/10/2026): cualquier persona con la Edición Personal lo activa gratis,
-- compra paquetes de licencias a precio mayorista y carga los emails de sus clientas. La administración
-- aprueba cada email: recién ahí se descuenta una licencia del saldo y la clienta recibe su clave.
insert into public.pricing_config (key, value_numeric, description) values
  ('reseller_unit_price', 31400, 'Precio por licencia para revendedoras (paquetes de 5, 10 o 20)')
on conflict do nothing;

create table if not exists public.reseller_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now()
);
alter table public.reseller_accounts enable row level security;
create policy reseller_accounts_select on public.reseller_accounts for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- Paquetes de licencias (se pagan con Mercado Pago; external_reference = id del pedido).
create table if not exists public.reseller_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quantity int not null check (quantity in (5, 10, 20)),
  unit_price numeric(12, 2) not null check (unit_price > 0),
  total numeric(12, 2) not null check (total > 0),
  currency text not null default 'ARS',
  status text not null default 'pending' check (status in ('pending', 'approved', 'canceled', 'refunded')),
  payment_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reseller_orders_user on public.reseller_orders (user_id, created_at desc);
alter table public.reseller_orders enable row level security;
create policy reseller_orders_select on public.reseller_orders for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- Clientas que carga la revendedora (cada una usa una licencia del saldo).
create table if not exists public.reseller_clients (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid not null references auth.users(id) on delete cascade,
  email text not null check (char_length(email) <= 200),
  full_name text check (full_name is null or char_length(full_name) <= 120),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approved_email_id uuid references public.approved_emails(id),
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists reseller_clients_reseller on public.reseller_clients (reseller_id, created_at desc);
create unique index if not exists reseller_clients_open_email on public.reseller_clients (lower(email)) where status in ('pending', 'approved');
alter table public.reseller_clients enable row level security;
create policy reseller_clients_select on public.reseller_clients for select to authenticated using (reseller_id = auth.uid() or public.is_admin());

-- Saldo: licencias pagadas menos las usadas o reservadas (pendientes de aprobación).
create or replace function public.reseller_balance(p_user_id uuid)
returns int
language sql stable security definer
set search_path = public
as $$
  select coalesce((select sum(quantity) from reseller_orders where user_id = p_user_id and status = 'approved'), 0)::int
       - (select count(*) from reseller_clients where reseller_id = p_user_id and status in ('pending', 'approved'))::int
$$;

create or replace function public.my_reseller_balance()
returns int
language sql stable security definer
set search_path = public
as $$ select public.reseller_balance(auth.uid()) $$;

-- Activar el modo revendedora (gratis, con la Edición Personal).
create or replace function public.become_reseller()
returns void
language plpgsql volatile security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Iniciá sesión.'; end if;
  if not exists (select 1 from licenses l join plans p on p.id = l.plan_id where l.user_id = auth.uid() and l.status = 'active' and p.code in ('BASIC', 'ADVANCED'))
     and not public.is_admin() then
    raise exception 'El modo revendedora se activa con la Edición Personal.';
  end if;
  insert into reseller_accounts (user_id) values (auth.uid()) on conflict (user_id) do nothing;
end;
$$;

-- Pedido de un paquete (el precio sale de la base).
create or replace function public.request_reseller_order(p_quantity int)
returns uuid
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_price numeric;
  v_id uuid;
begin
  if v_uid is null then raise exception 'Iniciá sesión.'; end if;
  if not exists (select 1 from reseller_accounts where user_id = v_uid and status = 'active') then raise exception 'Primero activá el modo revendedora.'; end if;
  if p_quantity not in (5, 10, 20) then raise exception 'Elegí un paquete de 5, 10 o 20 licencias.'; end if;
  select value_numeric into v_price from pricing_config where key = 'reseller_unit_price';
  select id into v_id from reseller_orders where user_id = v_uid and quantity = p_quantity and status = 'pending' order by created_at desc limit 1;
  if v_id is not null then
    update reseller_orders set unit_price = v_price, total = v_price * p_quantity, updated_at = now() where id = v_id;
    return v_id;
  end if;
  insert into reseller_orders (user_id, quantity, unit_price, total) values (v_uid, p_quantity, v_price, v_price * p_quantity) returning id into v_id;
  return v_id;
end;
$$;

-- Pago de Mercado Pago de un paquete (solo el servidor).
create or replace function public.mp_record_reseller_order(p jsonb)
returns text
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_order reseller_orders%rowtype;
begin
  select * into v_order from reseller_orders where id = (p->>'order_id')::uuid for update;
  if v_order.id is null then return 'order_not_found'; end if;
  if p->>'status' in ('refunded', 'charged_back') then
    if v_order.status = 'approved' then
      update reseller_orders set status = 'refunded', updated_at = now() where id = v_order.id;
      return 'refunded';
    end if;
    return 'refund_ignored';
  end if;
  if p->>'status' <> 'approved' then return 'recorded_' || coalesce(p->>'status', 'unknown'); end if;
  if v_order.status = 'approved' then return 'already_approved'; end if;
  if v_order.status <> 'pending' then return 'order_not_pending'; end if;
  if abs((p->>'amount')::numeric - v_order.total) > 0.01 or coalesce(p->>'currency', 'ARS') <> v_order.currency then return 'amount_mismatch'; end if;
  update reseller_orders set status = 'approved', payment_reference = p->>'payment_id', updated_at = now() where id = v_order.id;
  return 'activated';
end;
$$;

-- La revendedora carga una clienta (reserva una licencia del saldo hasta que la administración decida).
create or replace function public.reseller_add_client(p_email text, p_full_name text)
returns uuid
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_id uuid;
begin
  if v_uid is null then raise exception 'Iniciá sesión.'; end if;
  if not exists (select 1 from reseller_accounts where user_id = v_uid and status = 'active') then raise exception 'Primero activá el modo revendedora.'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Revisá el email.'; end if;
  if public.reseller_balance(v_uid) <= 0 then raise exception 'No te quedan licencias. Comprá un paquete.'; end if;
  if exists (select 1 from approved_emails where lower(email) = v_email and status = 'approved') then raise exception 'Ese email ya tiene la Edición Personal.'; end if;
  if exists (select 1 from reseller_clients where lower(email) = v_email and status in ('pending', 'approved')) then raise exception 'Ese email ya fue cargado.'; end if;
  insert into reseller_clients (reseller_id, email, full_name) values (v_uid, v_email, nullif(left(btrim(coalesce(p_full_name, '')), 120), '')) returning id into v_id;
  return v_id;
end;
$$;

-- La revendedora cancela una carga pendiente (libera la licencia).
create or replace function public.reseller_cancel_client(p_id uuid)
returns void
language plpgsql volatile security definer
set search_path = public
as $$
begin
  update reseller_clients set status = 'rejected', note = 'Cancelada por la revendedora', decided_at = now()
   where id = p_id and reseller_id = auth.uid() and status = 'pending';
  if not found then raise exception 'No se encontró esa carga pendiente.'; end if;
end;
$$;

-- La administración aprueba o rechaza. Al aprobar, el email queda habilitado (la app crea y manda la clave).
create or replace function public.admin_decide_reseller_client(p_id uuid, p_approve boolean, p_note text default null)
returns uuid
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_client reseller_clients%rowtype;
  v_email_id uuid;
begin
  if not public.is_admin() then raise exception 'Solo la administración puede hacer esto.'; end if;
  select * into v_client from reseller_clients where id = p_id for update;
  if v_client.id is null or v_client.status <> 'pending' then raise exception 'Esa solicitud ya no está pendiente.'; end if;
  if p_approve then
    v_email_id := public.approve_email_internal(v_client.email, 'revendedora', 'Revendedora ' || v_client.reseller_id::text);
    update reseller_clients set status = 'approved', approved_email_id = v_email_id, decided_at = now(), note = nullif(left(btrim(coalesce(p_note, '')), 300), '') where id = p_id;
  else
    update reseller_clients set status = 'rejected', decided_at = now(), note = nullif(left(btrim(coalesce(p_note, '')), 300), '') where id = p_id;
  end if;
  perform public.log_audit(case when p_approve then 'reseller.client.approve' else 'reseller.client.reject' end, 'reseller_client', p_id, null, jsonb_build_object('email', v_client.email));
  return v_email_id;
end;
$$;

create or replace function public.admin_set_reseller_price(p_price numeric)
returns void
language plpgsql volatile security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Solo la administración puede hacer esto.'; end if;
  if p_price <= 0 then raise exception 'El precio tiene que ser mayor a cero.'; end if;
  update pricing_config set value_numeric = p_price, updated_at = now() where key = 'reseller_unit_price';
  perform public.log_audit('prices.reseller', 'pricing', null, null, jsonb_build_object('unit', p_price));
end;
$$;

revoke all on function public.reseller_balance(uuid) from public, anon, authenticated;
grant execute on function public.reseller_balance(uuid) to service_role;
revoke all on function public.my_reseller_balance() from public, anon;
grant execute on function public.my_reseller_balance() to authenticated;
revoke all on function public.become_reseller() from public, anon;
grant execute on function public.become_reseller() to authenticated;
revoke all on function public.request_reseller_order(int) from public, anon;
grant execute on function public.request_reseller_order(int) to authenticated;
revoke all on function public.mp_record_reseller_order(jsonb) from public, anon, authenticated;
grant execute on function public.mp_record_reseller_order(jsonb) to service_role;
revoke all on function public.reseller_add_client(text, text) from public, anon;
grant execute on function public.reseller_add_client(text, text) to authenticated;
revoke all on function public.reseller_cancel_client(uuid) from public, anon;
grant execute on function public.reseller_cancel_client(uuid) to authenticated;
revoke all on function public.admin_decide_reseller_client(uuid, boolean, text) from public, anon;
grant execute on function public.admin_decide_reseller_client(uuid, boolean, text) to authenticated;
revoke all on function public.admin_set_reseller_price(numeric) from public, anon;
grant execute on function public.admin_set_reseller_price(numeric) to authenticated;
grant select on public.reseller_accounts, public.reseller_orders, public.reseller_clients to authenticated;
