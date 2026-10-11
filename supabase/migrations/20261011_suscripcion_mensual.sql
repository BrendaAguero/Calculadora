-- Renovación automática de la suscripción mensual con Suscripciones de Mercado Pago (preapproval).
-- La persona autoriza en Mercado Pago un cobro mensual; cada cobro aprobado extiende Emprendedor un mes.
-- external_reference de la suscripción en Mercado Pago = id de nuestra fila en subscriptions.

-- Estado de la suscripción en Mercado Pago (pending, authorized, paused, cancelled).
alter table public.subscriptions add column if not exists preapproval_status text;
create unique index if not exists subscriptions_preapproval_unique on public.subscriptions (external_preapproval_id) where external_preapproval_id is not null;

-- Guarda el id y el estado de la suscripción de Mercado Pago. Si allá se pausó o canceló, deja de renovarse acá.
create or replace function public.mp_update_preapproval(p_subscription_id uuid, p_preapproval_id text, p_status text)
returns text
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_sub subscriptions%rowtype;
begin
  select * into v_sub from subscriptions where id = p_subscription_id for update;
  if v_sub.id is null then return 'subscription_not_found'; end if;
  if v_sub.external_preapproval_id is not null and v_sub.external_preapproval_id <> p_preapproval_id then return 'other_preapproval'; end if;

  update subscriptions
     set external_preapproval_id = p_preapproval_id,
         preapproval_status = p_status,
         auto_renew = case when p_status in ('cancelled', 'paused') then false else auto_renew end,
         auto_renew_canceled_at = case when p_status in ('cancelled', 'paused') and auto_renew then now() else auto_renew_canceled_at end,
         updated_at = now()
   where id = v_sub.id;
  return 'updated';
end;
$$;

-- Registra un cobro de la suscripción mensual (ya confirmado consultando el pago a Mercado Pago).
-- Primer cobro: activa el pedido pendiente (mismo camino que Checkout Pro, con comisión de afiliada).
-- Cobros siguientes: nueva compra aprobada + renovación + un mes más de Emprendedor.
create or replace function public.mp_record_subscription_payment(p jsonb)
returns text
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_sub subscriptions%rowtype;
  v_payment text := p->>'payment_id';
  v_amount numeric := (p->>'amount')::numeric;
  v_purchase uuid;
  v_number int;
  v_start timestamptz;
begin
  if v_payment is null or v_payment !~ '^\d+$' then return 'invalid_payment'; end if;
  select * into v_sub from subscriptions where id = (p->>'subscription_id')::uuid for update;
  if v_sub.id is null then return 'subscription_not_found'; end if;
  if v_sub.duration_months <> 1 then return 'not_monthly'; end if;
  if p->>'status' <> 'approved' then return 'ignored_' || coalesce(p->>'status', 'unknown'); end if;
  if coalesce(p->>'currency', 'ARS') <> 'ARS' then return 'currency_mismatch'; end if;

  if p->>'preapproval_id' is not null and v_sub.external_preapproval_id is null then
    update subscriptions set external_preapproval_id = p->>'preapproval_id', updated_at = now() where id = v_sub.id;
  end if;

  if exists (select 1 from payment_transactions where provider = 'mercadopago' and external_payment_id = v_payment) then
    return 'already_recorded';
  end if;

  if v_sub.status = 'pending' then
    return public.mp_record_payment(jsonb_build_object(
      'purchase_id', v_sub.purchase_id, 'payment_id', v_payment, 'status', 'approved',
      'status_detail', p->>'status_detail', 'amount', v_amount, 'currency', 'ARS'));
  end if;
  if v_sub.status <> 'active' then return 'subscription_not_renewable'; end if;

  insert into purchases (user_id, product_type, product_id, quantity, subtotal, discount_amount, total, currency,
                         payment_provider, payment_reference, payment_status, purchased_at, completed_at)
  values (v_sub.user_id, 'subscription_renewal', v_sub.catalog_id, 1, v_amount, 0, v_amount, 'ARS',
          'mercadopago', v_payment, 'approved', now(), now())
  returning id into v_purchase;

  insert into payment_transactions (purchase_id, provider, external_payment_id, status, amount, currency, raw_status, approved_at)
  values (v_purchase, 'mercadopago', v_payment, 'approved', v_amount, 'ARS', concat_ws('/', p->>'status', p->>'status_detail'), now());

  select coalesce(max(renewal_number), 0) + 1 into v_number from subscription_renewals where subscription_id = v_sub.id;
  v_start := greatest(v_sub.expires_at, now());
  insert into subscription_renewals (subscription_id, renewal_number, period_start, period_end, scheduled_at, price_charged, currency, status, purchase_id, external_payment_id)
  values (v_sub.id, v_number, v_start, v_start + interval '1 month', now(), v_amount, 'ARS', 'charged', v_purchase, v_payment);

  update subscriptions set expires_at = v_start + interval '1 month', updated_at = now() where id = v_sub.id;
  return 'renewed';
end;
$$;

-- mp_record_payment: igual que antes, y si se devuelve el cobro de una renovación, se anula ese mes.
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
  v_renewal subscription_renewals%rowtype;
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
      -- Cobro de una renovación mensual: se anula ese mes (la suscripción sigue con lo demás pagado).
      select * into v_renewal from subscription_renewals where purchase_id = v_purchase.id and status = 'charged' for update;
      if v_renewal.id is not null then
        update subscription_renewals set status = 'canceled', updated_at = now() where id = v_renewal.id;
        update subscriptions set expires_at = expires_at - interval '1 month', updated_at = now() where id = v_renewal.subscription_id;
      end if;
      -- La comisión de una compra reembolsada se anula (si todavía no se pagó).
      update commissions set status = 'reversed', reversed_at = now()
        where purchase_id = v_purchase.id and status in ('pending', 'held', 'available');
      return 'refunded';
    end if;
    return case when v_already then 'already_refunded' else 'refund_ignored' end;
  end if;
  return 'recorded_' || v_status;
end;
$$;

revoke all on function public.mp_update_preapproval(uuid, text, text) from public, anon, authenticated;
revoke all on function public.mp_record_subscription_payment(jsonb) from public, anon, authenticated;
revoke all on function public.mp_record_payment(jsonb) from public, anon, authenticated;
grant execute on function public.mp_update_preapproval(uuid, text, text) to service_role;
grant execute on function public.mp_record_subscription_payment(jsonb) to service_role;
grant execute on function public.mp_record_payment(jsonb) to service_role;
