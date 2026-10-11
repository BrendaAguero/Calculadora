-- Emprendedor: actualizar a un plan más largo con prorrateo (decisión de la dueña, 11/10/2026).
-- - Crédito = lo pagado por el plan actual × (tiempo que le queda ÷ duración total del plan).
-- - Precio = precio del plan más largo (con su descuento) − crédito. El plan nuevo empieza hoy y dura completo;
--   el anterior termina hoy (si era la mensual, deja de renovarse).
-- - Solo con UN plan activo, pagado (los de cortesía no dan crédito) y hacia un plazo más largo.
-- Agrega dos columnas opcionales y funciones. No modifica datos existentes.

alter table public.subscriptions
  add column if not exists upgraded_from_subscription_id uuid references public.subscriptions(id),
  add column if not exists upgrade_credit numeric(12,2);

create or replace function public.quote_entrepreneur_upgrade(p_months int)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_count int;
  v_cur subscriptions%rowtype;
  v_quote jsonb;
  v_credit numeric;
  v_total_secs numeric;
  v_left_secs numeric;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Iniciá sesión.');
  end if;

  select count(*) into v_count from subscriptions where user_id = v_uid and status = 'active' and expires_at > now();
  if v_count <> 1 then
    return jsonb_build_object('ok', false, 'error', 'Solo se puede actualizar cuando tenés un único plan activo.');
  end if;
  select * into v_cur from subscriptions where user_id = v_uid and status = 'active' and expires_at > now();

  if v_cur.purchase_id is null or v_cur.final_price <= 0 then
    return jsonb_build_object('ok', false, 'error', 'Los planes de cortesía no se pueden actualizar.');
  end if;
  if p_months <= v_cur.duration_months then
    return jsonb_build_object('ok', false, 'error', 'Solo se puede pasar a un plan más largo.');
  end if;

  v_quote := public.quote_entrepreneur(p_months);
  if not (v_quote->>'ok')::boolean then
    return v_quote;
  end if;

  -- Crédito proporcional al tiempo que le queda (si todavía no empezó, vale lo pagado completo).
  v_total_secs := extract(epoch from v_cur.expires_at - v_cur.start_at);
  v_left_secs := least(v_total_secs, extract(epoch from v_cur.expires_at - now()));
  v_credit := round(v_cur.final_price * v_left_secs / nullif(v_total_secs, 0), 2);

  return v_quote || jsonb_build_object(
    'from_subscription_id', v_cur.id,
    'from_months', v_cur.duration_months,
    'from_expires_at', v_cur.expires_at,
    'credit', v_credit,
    'upgrade_price', greatest(round((v_quote->>'final_price')::numeric - v_credit, 2), 0)
  );
end;
$$;

create or replace function public.request_entrepreneur_upgrade(p_months int)
returns uuid
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_quote jsonb;
  v_purchase_id uuid;
  v_subscription_id uuid;
begin
  if exists (select 1 from subscriptions where user_id = v_uid and status = 'pending') then
    raise exception 'Ya tenés un pedido de Emprendedor pendiente.';
  end if;
  v_quote := public.quote_entrepreneur_upgrade(p_months);
  if not (v_quote->>'ok')::boolean then
    raise exception '%', v_quote->>'error';
  end if;

  insert into purchases (user_id, product_type, product_id, quantity, subtotal, discount_amount, total, currency, payment_provider, payment_status)
  values (
    v_uid, 'subscription_renewal', (v_quote->>'catalog_id')::uuid, 1,
    (v_quote->>'price')::numeric,
    (v_quote->>'price')::numeric - (v_quote->>'upgrade_price')::numeric,
    (v_quote->>'upgrade_price')::numeric,
    'ARS', 'manual', 'pending'
  )
  returning id into v_purchase_id;

  insert into subscriptions (user_id, base_plan_id, catalog_id, purchase_id, duration_months, start_at, expires_at, status, auto_renew,
    price_before_discount, base_discount_percentage, recent_purchase_discount_percentage, total_discount_percentage, final_price, currency,
    upgraded_from_subscription_id, upgrade_credit)
  values (
    v_uid, (v_quote->>'base_plan_id')::uuid, (v_quote->>'catalog_id')::uuid, v_purchase_id, p_months,
    now(), now() + make_interval(months => p_months), 'pending', false,
    (v_quote->>'price')::numeric, (v_quote->>'age_pct')::numeric, (v_quote->>'recent_pct')::numeric,
    (v_quote->>'discount_pct')::numeric, (v_quote->>'upgrade_price')::numeric, 'ARS',
    (v_quote->>'from_subscription_id')::uuid, (v_quote->>'credit')::numeric
  )
  returning id into v_subscription_id;

  return v_subscription_id;
end;
$$;

-- Activar (solo administradoras). Ahora también resuelve las actualizaciones.
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

  if v_sub.upgraded_from_subscription_id is not null then
    -- Actualización: el plan anterior termina hoy y el nuevo empieza hoy, completo.
    if exists (
      select 1 from subscriptions
      where user_id = v_sub.user_id and status = 'active' and expires_at > now() and id <> v_sub.upgraded_from_subscription_id
    ) then
      raise exception 'La cuenta tiene otro plan activo además del que se actualiza; revisalo antes de activar.';
    end if;
    update subscriptions
      set status = 'expired', expires_at = least(expires_at, now()),
          auto_renew = false, auto_renew_canceled_at = case when auto_renew then now() else auto_renew_canceled_at end,
          updated_at = now()
      where id = v_sub.upgraded_from_subscription_id and user_id = v_sub.user_id;
    v_start := now();
  else
    select max(expires_at) into v_active_until
    from subscriptions
    where user_id = v_sub.user_id and status = 'active' and expires_at > now();
    if v_sub.duration_months = 1 and v_active_until is not null then
      raise exception 'Es una suscripción mensual y la cuenta ya tiene Emprendedor hasta el %. La mensual no se suma: activala cuando venza.',
        to_char(v_active_until at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY');
    end if;
    -- 6 y 12 meses empiezan cuando termina lo ya pagado; si había mensual, deja de renovarse.
    v_start := greatest(now(), coalesce(v_active_until, now()));
    update subscriptions set auto_renew = false, auto_renew_canceled_at = now(), updated_at = now()
    where user_id = v_sub.user_id and status = 'active' and auto_renew and id <> v_sub.id;
  end if;

  v_expires := v_start + make_interval(months => v_sub.duration_months);
  update subscriptions set status = 'active', start_at = v_start, expires_at = v_expires, updated_at = now() where id = v_sub.id;
  update purchases set payment_status = 'approved', completed_at = now(), updated_at = now() where id = v_sub.purchase_id;
  return v_expires;
end;
$$;

-- Lista de pedidos con datos de actualización. Es una función nueva (_v2) para no reemplazar la anterior.
create or replace function public.admin_list_entrepreneur_requests_v2()
returns table (subscription_id uuid, user_email text, user_name text, months int, price numeric, discount_pct numeric, final_price numeric,
  base_plan text, requested_at timestamptz, upgrade_from_months int, upgrade_credit numeric)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado.';
  end if;
  return query
    select s.id, pr.email, pr.full_name, s.duration_months, s.price_before_discount, s.total_discount_percentage, s.final_price, p.code, s.created_at,
           f.duration_months, s.upgrade_credit
    from subscriptions s
    join profiles pr on pr.id = s.user_id
    join plans p on p.id = s.base_plan_id
    left join subscriptions f on f.id = s.upgraded_from_subscription_id
    where s.status = 'pending'
    order by s.created_at;
end;
$$;

revoke all on function public.quote_entrepreneur_upgrade(int) from public, anon;
revoke all on function public.request_entrepreneur_upgrade(int) from public, anon;
revoke all on function public.admin_activate_subscription(uuid) from public, anon;
revoke all on function public.admin_list_entrepreneur_requests_v2() from public, anon;
grant execute on function public.quote_entrepreneur_upgrade(int) to authenticated;
grant execute on function public.request_entrepreneur_upgrade(int) to authenticated;
grant execute on function public.admin_activate_subscription(uuid) to authenticated;
grant execute on function public.admin_list_entrepreneur_requests_v2() to authenticated;
