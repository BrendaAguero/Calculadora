-- Etapa 12: Emprendedor (sin cobro todavía; la administradora activa los pedidos).
-- Solo agrega funciones. Las tablas de compras y suscripciones no permiten insertar desde la app,
-- así que el pedido y la activación pasan por estas funciones, que validan todo del lado de la base.

-- ¿La persona que llama es administradora activa?
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and account_status = 'active');
$$;

-- Precio de Emprendedor para la persona que llama.
-- Descuentos: antigüedad de la licencia base y compra/upgrade reciente. Se aplica SOLO EL MAYOR
-- (decisión de la dueña, 11/10/2026).
create or replace function public.quote_entrepreneur(p_months int)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_catalog_id uuid;
  v_price numeric;
  v_plan_id uuid;
  v_plan_code text;
  v_age_days int;
  v_recent_days int;
  v_age_pct numeric := 0;
  v_recent_pct numeric := 0;
  v_pct numeric;
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

  -- Emprendedor requiere una licencia base vigente (se toma la de mayor nivel).
  select l.plan_id, p.code into v_plan_id, v_plan_code
  from licenses l join plans p on p.id = l.plan_id
  where l.user_id = v_uid and l.status = 'active' and p.code in ('BASIC', 'ADVANCED')
  order by (p.code = 'ADVANCED') desc limit 1;
  if v_plan_id is null then
    return jsonb_build_object('ok', false, 'error', 'Emprendedor requiere tener una licencia Básico o Avanzado.');
  end if;

  -- Antigüedad: desde la primera licencia base (incluye la reemplazada por un upgrade).
  -- Compra reciente: desde la licencia base más nueva (compra o upgrade).
  select floor(extract(epoch from now() - min(coalesce(l.activated_at, l.acquired_at))) / 86400)::int,
         floor(extract(epoch from now() - max(l.acquired_at)) / 86400)::int
    into v_age_days, v_recent_days
  from licenses l join plans p on p.id = l.plan_id
  where l.user_id = v_uid and p.code in ('BASIC', 'ADVANCED') and l.status in ('active', 'replaced');

  select coalesce(max(percentage), 0) into v_age_pct
  from discount_rules
  where discount_type = 'entrepreneur_age' and active and (duration_months is null or duration_months = p_months)
    and v_age_days >= min_days and (max_days is null or v_age_days <= max_days)
    and valid_from <= now() and (valid_until is null or valid_until > now());

  select coalesce(max(percentage), 0) into v_recent_pct
  from discount_rules
  where discount_type = 'recent_base_purchase' and active and (duration_months is null or duration_months = p_months)
    and v_recent_days >= min_days and (max_days is null or v_recent_days <= max_days)
    and valid_from <= now() and (valid_until is null or valid_until > now());

  v_pct := greatest(v_age_pct, v_recent_pct);

  return jsonb_build_object(
    'ok', true,
    'catalog_id', v_catalog_id,
    'months', p_months,
    'base_plan_id', v_plan_id,
    'base_plan', v_plan_code,
    'price', v_price,
    'age_days', v_age_days,
    'age_pct', v_age_pct,
    'recent_days', v_recent_days,
    'recent_pct', v_recent_pct,
    'discount_pct', v_pct,
    'final_price', round(v_price * (1 - v_pct / 100), 2)
  );
end;
$$;

-- Pedido de Emprendedor: crea la compra y la suscripción en estado pendiente.
create or replace function public.request_entrepreneur(p_months int, p_auto_renew boolean default false)
returns uuid
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_quote jsonb;
  v_purchase_id uuid;
  v_subscription_id uuid;
  v_has_active boolean;
begin
  v_quote := public.quote_entrepreneur(p_months);
  if not (v_quote->>'ok')::boolean then
    raise exception '%', v_quote->>'error';
  end if;
  if exists (select 1 from subscriptions where user_id = v_uid and status = 'pending') then
    raise exception 'Ya tenés un pedido de Emprendedor pendiente.';
  end if;

  select exists (select 1 from subscriptions where user_id = v_uid and status = 'active' and expires_at > now()) into v_has_active;

  insert into purchases (user_id, product_type, product_id, quantity, subtotal, discount_amount, total, currency, payment_provider, payment_status)
  values (
    v_uid,
    case when v_has_active then 'subscription_renewal' else 'subscription_initial' end,
    (v_quote->>'catalog_id')::uuid, 1,
    (v_quote->>'price')::numeric,
    (v_quote->>'price')::numeric - (v_quote->>'final_price')::numeric,
    (v_quote->>'final_price')::numeric,
    'ARS', 'manual', 'pending'
  )
  returning id into v_purchase_id;

  -- Fechas provisorias: se recalculan al activar.
  insert into subscriptions (user_id, base_plan_id, catalog_id, purchase_id, duration_months, start_at, expires_at, status, auto_renew,
    price_before_discount, base_discount_percentage, recent_purchase_discount_percentage, total_discount_percentage, final_price, currency)
  values (
    v_uid, (v_quote->>'base_plan_id')::uuid, (v_quote->>'catalog_id')::uuid, v_purchase_id, p_months,
    now(), now() + make_interval(months => p_months), 'pending', p_auto_renew and p_months = 1,
    (v_quote->>'price')::numeric, (v_quote->>'age_pct')::numeric, (v_quote->>'recent_pct')::numeric,
    (v_quote->>'discount_pct')::numeric, (v_quote->>'final_price')::numeric, 'ARS'
  )
  returning id into v_subscription_id;

  return v_subscription_id;
end;
$$;

-- La persona cancela su propio pedido pendiente.
create or replace function public.cancel_entrepreneur_request(p_subscription_id uuid)
returns void
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_purchase_id uuid;
begin
  update subscriptions set status = 'canceled', updated_at = now()
  where id = p_subscription_id and user_id = auth.uid() and status = 'pending'
  returning purchase_id into v_purchase_id;
  if v_purchase_id is null then
    raise exception 'No se encontró un pedido pendiente.';
  end if;
  update purchases set payment_status = 'canceled', updated_at = now() where id = v_purchase_id;
end;
$$;

-- Lista de pedidos pendientes (solo administradoras).
create or replace function public.admin_list_entrepreneur_requests()
returns table (subscription_id uuid, user_email text, user_name text, months int, price numeric, discount_pct numeric, final_price numeric, base_plan text, requested_at timestamptz)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado.';
  end if;
  return query
    select s.id, pr.email, pr.full_name, s.duration_months, s.price_before_discount, s.total_discount_percentage, s.final_price, p.code, s.created_at
    from subscriptions s
    join profiles pr on pr.id = s.user_id
    join plans p on p.id = s.base_plan_id
    where s.status = 'pending'
    order by s.created_at;
end;
$$;

-- Activar un pedido (solo administradoras). Si ya tiene Emprendedor vigente, el plazo se suma al final.
create or replace function public.admin_activate_subscription(p_subscription_id uuid)
returns timestamptz
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_sub subscriptions%rowtype;
  v_start timestamptz;
  v_expires timestamptz;
begin
  if not public.is_admin() then
    raise exception 'No autorizado.';
  end if;

  select * into v_sub from subscriptions where id = p_subscription_id for update;
  if v_sub.id is null or v_sub.status <> 'pending' then
    raise exception 'El pedido no existe o ya no está pendiente.';
  end if;
  if not exists (
    select 1 from licenses l join plans p on p.id = l.plan_id
    where l.user_id = v_sub.user_id and l.status = 'active' and p.code in ('BASIC', 'ADVANCED')
  ) then
    raise exception 'La cuenta ya no tiene una licencia base vigente.';
  end if;

  select greatest(now(), coalesce(max(expires_at), now())) into v_start
  from subscriptions
  where user_id = v_sub.user_id and status = 'active' and expires_at > now();
  v_expires := v_start + make_interval(months => v_sub.duration_months);

  update subscriptions set status = 'active', start_at = v_start, expires_at = v_expires, updated_at = now() where id = v_sub.id;
  update purchases set payment_status = 'approved', completed_at = now(), updated_at = now() where id = v_sub.purchase_id;
  return v_expires;
end;
$$;

revoke all on function public.is_admin() from public, anon;
revoke all on function public.quote_entrepreneur(int) from public, anon;
revoke all on function public.request_entrepreneur(int, boolean) from public, anon;
revoke all on function public.cancel_entrepreneur_request(uuid) from public, anon;
revoke all on function public.admin_list_entrepreneur_requests() from public, anon;
revoke all on function public.admin_activate_subscription(uuid) from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.quote_entrepreneur(int) to authenticated;
grant execute on function public.request_entrepreneur(int, boolean) to authenticated;
grant execute on function public.cancel_entrepreneur_request(uuid) to authenticated;
grant execute on function public.admin_list_entrepreneur_requests() to authenticated;
grant execute on function public.admin_activate_subscription(uuid) to authenticated;
