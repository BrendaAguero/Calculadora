-- Compra online (Checkout Pro) de licencias Básico/Avanzado, del pase Básico → Avanzado y de módulos.
-- El pedido queda como compra pendiente; al aprobarse el pago, mp_record_payment lo activa.
-- Solo se venden módulos que ya funcionan (los demás se muestran como «Próximamente»).

create or replace function public.sellable_module(p_code text)
returns boolean
language sql immutable
as $$ select p_code in ('STOCK_BASICO', 'PROVEEDORES_BASICO') $$;

-- Pedido de licencia (la persona no tiene licencia base: está en la versión gratis).
create or replace function public.request_license_purchase(p_plan_code text)
returns uuid
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_plan plans%rowtype;
  v_purchase uuid;
begin
  if v_uid is null then raise exception 'Iniciá sesión para comprar.'; end if;
  select * into v_plan from plans where code = p_plan_code and code in ('BASIC', 'ADVANCED') and active;
  if v_plan.id is null then raise exception 'Plan no disponible.'; end if;
  if exists (select 1 from licenses l join plans p on p.id = l.plan_id where l.user_id = v_uid and l.status = 'active' and p.code in ('BASIC', 'ADVANCED')) then
    raise exception 'Ya tenés una licencia. Si tenés Básico, podés pasarte a Avanzado.';
  end if;
  -- Si ya hay un pedido pendiente igual, se reutiliza (por ejemplo, si volvió atrás en Mercado Pago).
  select id into v_purchase from purchases
   where user_id = v_uid and product_type = 'license' and product_id = v_plan.id and payment_status = 'pending'
   order by created_at desc limit 1;
  if v_purchase is not null then return v_purchase; end if;

  insert into purchases (user_id, product_type, product_id, quantity, subtotal, discount_amount, total, currency, payment_provider, payment_status)
  values (v_uid, 'license', v_plan.id, 1, v_plan.price, 0, v_plan.price, 'ARS', 'manual', 'pending')
  returning id into v_purchase;
  return v_purchase;
end;
$$;

-- Precio del pase de Básico a Avanzado según los días desde que se compró Básico (tabla upgrade_price_rules).
create or replace function public.quote_license_upgrade()
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_license licenses%rowtype;
  v_days int;
  v_rule upgrade_price_rules%rowtype;
begin
  select l.* into v_license from licenses l join plans p on p.id = l.plan_id
   where l.user_id = v_uid and l.status = 'active' and p.code = 'BASIC' order by l.acquired_at desc limit 1;
  if v_license.id is null then return jsonb_build_object('ok', false, 'error', 'Necesitás tener Básico para pasarte a Avanzado.'); end if;
  v_days := greatest(0, floor(extract(epoch from (now() - v_license.acquired_at)) / 86400)::int);
  select r.* into v_rule from upgrade_price_rules r
   join plans f on f.id = r.from_plan_id and f.code = 'BASIC'
   join plans t on t.id = r.to_plan_id and t.code = 'ADVANCED'
   where r.active and r.valid_from <= now() and (r.valid_until is null or r.valid_until > now())
     and v_days >= r.min_days and (r.max_days is null or v_days <= r.max_days)
   order by r.min_days desc limit 1;
  if v_rule.id is null then return jsonb_build_object('ok', false, 'error', 'El pase a Avanzado no está disponible ahora.'); end if;
  return jsonb_build_object('ok', true, 'price', v_rule.price, 'days', v_days, 'license_id', v_license.id,
    'next_change_days', case when v_rule.max_days is null then null else v_rule.max_days + 1 - v_days end);
end;
$$;

create or replace function public.request_license_upgrade()
returns uuid
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_quote jsonb := public.quote_license_upgrade();
  v_advanced uuid;
  v_purchase uuid;
begin
  if not (v_quote->>'ok')::boolean then raise exception '%', v_quote->>'error'; end if;
  select id into v_advanced from plans where code = 'ADVANCED';
  -- Un pedido pendiente anterior se reemplaza por uno con el precio de hoy.
  update purchases set payment_status = 'canceled', updated_at = now()
   where user_id = v_uid and product_type = 'license_upgrade' and payment_status = 'pending';
  insert into purchases (user_id, product_type, product_id, quantity, subtotal, discount_amount, total, currency, payment_provider, payment_status)
  values (v_uid, 'license_upgrade', v_advanced, 1, (v_quote->>'price')::numeric, 0, (v_quote->>'price')::numeric, 'ARS', 'manual', 'pending')
  returning id into v_purchase;
  return v_purchase;
end;
$$;

-- Pedido de módulo (requiere licencia; los módulos son permanentes).
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
    raise exception 'Los módulos se suman a una licencia Básico o Avanzado.';
  end if;
  if exists (select 1 from user_modules where user_id = v_uid and module_id = v_module.id and status = 'active') then
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

-- Cancela un pedido de compra pendiente propio (no Emprendedor, que tiene su propio camino).
create or replace function public.cancel_purchase_request(p_purchase_id uuid)
returns void
language plpgsql volatile security definer
set search_path = public
as $$
begin
  update purchases set payment_status = 'canceled', updated_at = now()
   where id = p_purchase_id and user_id = auth.uid() and payment_status = 'pending'
     and product_type in ('license', 'license_upgrade', 'module');
  if not found then raise exception 'No se encontró un pedido pendiente.'; end if;
end;
$$;

-- Activa una compra de licencia, pase o módulo ya pagada (uso interno de mp_record_payment).
create or replace function public.apply_purchase_activation(p_purchase_id uuid)
returns text
language plpgsql volatile security definer
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
  else
    return 'unsupported_product';
  end if;

  update purchases set payment_status = 'approved', completed_at = now(), updated_at = now() where id = v_purchase.id;
  perform public.create_commission_for_purchase(v_purchase.id);
  return 'activated';
end;
$$;

-- Si se devuelve el pago de una licencia, pase o módulo, se desactiva lo que se activó con él.
create or replace function public.revoke_purchase_items(p_purchase_id uuid)
returns void
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_lic licenses%rowtype;
begin
  for v_lic in select * from licenses where purchase_id = p_purchase_id and status = 'active' loop
    update licenses set status = 'refunded', updated_at = now() where id = v_lic.id;
    -- Al devolver un pase a Avanzado, vuelve la licencia Básico anterior.
    if v_lic.upgraded_from_license_id is not null then
      update licenses set status = 'active', updated_at = now() where id = v_lic.upgraded_from_license_id and status = 'replaced';
    end if;
  end loop;
  update user_modules set status = 'refunded' where purchase_id = p_purchase_id and status = 'active';
end;
$$;

-- mp_record_payment: además activa (o, si se devuelve el pago, desactiva) licencias, pases y módulos.
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
    -- Licencia, pase a Avanzado o módulo.
    if v_purchase.product_type in ('license', 'license_upgrade', 'module') then
      return public.apply_purchase_activation(v_purchase.id);
    end if;
    select id into v_sub from subscriptions where purchase_id = v_purchase.id and status = 'pending';
    if v_sub is null then return 'subscription_not_pending'; end if;
    perform public.apply_subscription_activation(v_sub);
    return 'activated';
  elsif v_status = 'refunded' then
    if v_purchase.payment_status = 'approved' then
      update purchases set payment_status = 'refunded', refunded_at = now(), updated_at = now() where id = v_purchase.id;
      update subscriptions set status = 'refunded', auto_renew = false, updated_at = now() where purchase_id = v_purchase.id;
      perform public.revoke_purchase_items(v_purchase.id);
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

revoke all on function public.request_license_purchase(text) from public, anon;
revoke all on function public.quote_license_upgrade() from public, anon;
revoke all on function public.request_license_upgrade() from public, anon;
revoke all on function public.request_module_purchase(text) from public, anon;
revoke all on function public.cancel_purchase_request(uuid) from public, anon;
grant execute on function public.request_license_purchase(text) to authenticated;
grant execute on function public.quote_license_upgrade() to authenticated;
grant execute on function public.request_license_upgrade() to authenticated;
grant execute on function public.request_module_purchase(text) to authenticated;
grant execute on function public.cancel_purchase_request(uuid) to authenticated;
revoke all on function public.apply_purchase_activation(uuid) from public, anon, authenticated;
revoke all on function public.revoke_purchase_items(uuid) from public, anon, authenticated;
revoke all on function public.mp_record_payment(jsonb) from public, anon, authenticated;
grant execute on function public.mp_record_payment(jsonb) to service_role;
