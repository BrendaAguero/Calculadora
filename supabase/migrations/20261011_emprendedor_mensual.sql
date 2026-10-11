-- Emprendedor: la mensualidad (1 mes) no se suma a un Emprendedor vigente (decisión de la dueña, 11/10/2026).
-- Los planes de 6 y 12 meses sí se suman al final. Solo reemplaza dos funciones; no toca datos.

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
  v_active_until timestamptz;
begin
  v_quote := public.quote_entrepreneur(p_months);
  if not (v_quote->>'ok')::boolean then
    raise exception '%', v_quote->>'error';
  end if;
  if exists (select 1 from subscriptions where user_id = v_uid and status = 'pending') then
    raise exception 'Ya tenés un pedido de Emprendedor pendiente.';
  end if;

  select max(expires_at) into v_active_until from subscriptions where user_id = v_uid and status = 'active' and expires_at > now();
  if p_months = 1 and v_active_until is not null then
    raise exception 'La mensualidad no se suma a un Emprendedor vigente. Podés pedirla cuando venza el actual (%), o elegir 6 o 12 meses.',
      to_char(v_active_until at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY');
  end if;

  insert into purchases (user_id, product_type, product_id, quantity, subtotal, discount_amount, total, currency, payment_provider, payment_status)
  values (
    v_uid,
    case when v_active_until is not null then 'subscription_renewal' else 'subscription_initial' end,
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

-- Activar un pedido (solo administradoras). 6 y 12 meses se suman al final de un Emprendedor vigente;
-- la mensualidad no se puede activar mientras haya uno vigente.
create or replace function public.admin_activate_subscription(p_subscription_id uuid)
returns timestamptz
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_sub subscriptions%rowtype;
  v_active_until timestamptz;
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

  select max(expires_at) into v_active_until
  from subscriptions
  where user_id = v_sub.user_id and status = 'active' and expires_at > now();
  if v_sub.duration_months = 1 and v_active_until is not null then
    raise exception 'Es una mensualidad y la cuenta ya tiene Emprendedor hasta el %. La mensualidad no se suma: activala cuando venza.',
      to_char(v_active_until at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY');
  end if;

  v_start := greatest(now(), coalesce(v_active_until, now()));
  v_expires := v_start + make_interval(months => v_sub.duration_months);

  update subscriptions set status = 'active', start_at = v_start, expires_at = v_expires, updated_at = now() where id = v_sub.id;
  update purchases set payment_status = 'approved', completed_at = now(), updated_at = now() where id = v_sub.purchase_id;
  return v_expires;
end;
$$;

revoke all on function public.request_entrepreneur(int, boolean) from public, anon;
revoke all on function public.admin_activate_subscription(uuid) from public, anon;
grant execute on function public.request_entrepreneur(int, boolean) to authenticated;
grant execute on function public.admin_activate_subscription(uuid) to authenticated;
