-- Etapa 18: Mercado Pago (Checkout Pro) para Emprendedor.
-- El servidor confirma cada pago consultando a Mercado Pago (nunca confía en lo que llega por la URL o el aviso)
-- y recién ahí llama a mp_record_payment, que solo puede ejecutar el servidor (service_role).
-- Idempotente: el mismo pago procesado dos veces no activa dos veces.

create unique index if not exists payment_transactions_provider_payment
  on public.payment_transactions (provider, external_payment_id) where external_payment_id is not null;

-- Activación de una suscripción pendiente (la lógica que antes estaba dentro de admin_activate_subscription).
create or replace function public.apply_subscription_activation(p_subscription_id uuid)
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

-- La activación manual de la administradora usa la misma lógica.
create or replace function public.admin_activate_subscription(p_subscription_id uuid)
returns timestamptz
language plpgsql volatile security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado.';
  end if;
  return public.apply_subscription_activation(p_subscription_id);
end;
$$;

-- p = {purchase_id, payment_id, preference_id, status, status_detail, amount, currency}
-- (datos tal como los devolvió la API de Mercado Pago al consultar el pago).
create or replace function public.mp_record_payment(p jsonb)
returns text
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_purchase purchases%rowtype;
  v_status text;
  v_sub uuid;
  v_already boolean;
begin
  select * into v_purchase from purchases where id = (p->>'purchase_id')::uuid for update;
  if v_purchase.id is null then return 'purchase_not_found'; end if;

  v_status := case p->>'status'
    when 'approved' then 'approved'
    when 'authorized' then 'approved'
    when 'refunded' then 'refunded'
    when 'charged_back' then 'refunded'
    when 'rejected' then 'rejected'
    when 'cancelled' then 'canceled'
    else 'pending' end;

  select exists (select 1 from payment_transactions where provider = 'mercadopago' and external_payment_id = p->>'payment_id' and status = v_status) into v_already;

  insert into payment_transactions (purchase_id, provider, external_payment_id, external_preference_id, status, amount, currency, raw_status,
                                    approved_at, refunded_at)
  values (v_purchase.id, 'mercadopago', p->>'payment_id', nullif(p->>'preference_id', ''), v_status, (p->>'amount')::numeric,
          coalesce(p->>'currency', 'ARS'), concat_ws('/', p->>'status', p->>'status_detail'),
          case when v_status = 'approved' then now() end, case when v_status = 'refunded' then now() end)
  on conflict (provider, external_payment_id) where external_payment_id is not null do update
    set status = excluded.status, raw_status = excluded.raw_status, amount = excluded.amount,
        approved_at = coalesce(payment_transactions.approved_at, excluded.approved_at),
        refunded_at = coalesce(payment_transactions.refunded_at, excluded.refunded_at), updated_at = now();

  if v_status = 'approved' then
    if v_purchase.payment_status = 'approved' then return 'already_approved'; end if;
    if v_purchase.payment_status <> 'pending' then return 'purchase_not_pending'; end if;
    if abs((p->>'amount')::numeric - v_purchase.total) > 0.01 or coalesce(p->>'currency', 'ARS') <> v_purchase.currency then
      return 'amount_mismatch';
    end if;
    update purchases set payment_provider = 'mercadopago', payment_reference = p->>'payment_id', updated_at = now() where id = v_purchase.id;
    select id into v_sub from subscriptions where purchase_id = v_purchase.id and status = 'pending';
    if v_sub is null then return 'subscription_not_pending'; end if;
    perform public.apply_subscription_activation(v_sub);
    return 'activated';
  elsif v_status = 'refunded' then
    if v_purchase.payment_status = 'approved' then
      update purchases set payment_status = 'refunded', refunded_at = now(), updated_at = now() where id = v_purchase.id;
      update subscriptions set status = 'refunded', auto_renew = false, updated_at = now() where purchase_id = v_purchase.id;
      return 'refunded';
    end if;
    return case when v_already then 'already_refunded' else 'refund_ignored' end;
  end if;
  return 'recorded_' || v_status;
end;
$$;

-- Solo el servidor puede activar o registrar pagos.
revoke all on function public.apply_subscription_activation(uuid) from public, anon, authenticated;
revoke all on function public.mp_record_payment(jsonb) from public, anon, authenticated;
grant execute on function public.apply_subscription_activation(uuid) to service_role;
grant execute on function public.mp_record_payment(jsonb) to service_role;
revoke all on function public.admin_activate_subscription(uuid) from public, anon;
grant execute on function public.admin_activate_subscription(uuid) to authenticated;
