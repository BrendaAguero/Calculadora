-- Etapas 19 (Afiliados) y 20 (Administración). Las tablas de afiliados ya existían (vacías).
-- Reglas (PROMPT_MAESTRO): comisión normal 15 % o 20 %, PRO 25 %; retención 11 días; retiro mínimo
-- $20.000 (PRO $10.000); PRO = 10 ventas válidas por mes durante 3 meses seguidos.
-- Antifraude: nadie usa su propio código, una sola afiliada por compra, la comisión nace solo con el pago
-- confirmado y se anula si hay reembolso. Todo lo que hace la administración queda en audit_logs.
-- Solo agrega columnas, políticas de lectura para administradoras y funciones.

alter table public.affiliates add column if not exists application_note text;
alter table public.commissions add column if not exists withdrawal_id uuid references public.withdrawals(id);
create unique index if not exists commissions_one_per_purchase on public.commissions (purchase_id);

-- Las administradoras pueden LEER todo lo necesario para el panel (las escrituras van por funciones).
create policy admin_select_all on public.profiles for select using (public.is_admin());
create policy admin_select_all on public.purchases for select using (public.is_admin());
create policy admin_select_all on public.subscriptions for select using (public.is_admin());
create policy admin_select_all on public.licenses for select using (public.is_admin());
create policy admin_select_all on public.user_activities for select using (public.is_admin());
create policy admin_select_all on public.payment_transactions for select using (public.is_admin());
create policy admin_select_all on public.affiliates for select using (public.is_admin());
create policy admin_select_all on public.affiliate_codes for select using (public.is_admin());
create policy admin_select_all on public.affiliate_attributions for select using (public.is_admin());
create policy admin_select_all on public.commissions for select using (public.is_admin());
create policy admin_select_all on public.withdrawals for select using (public.is_admin());
create policy admin_select_all on public.audit_logs for select using (public.is_admin());
create policy admin_select_all on public.dev_grants for select using (public.is_admin());

-- Registro de auditoría (uso interno de las funciones).
create or replace function public.log_audit(p_action text, p_entity_type text, p_entity_id uuid, p_old jsonb default null, p_new jsonb default null)
returns void
language sql volatile security definer
set search_path = public
as $$
  insert into audit_logs (actor_user_id, action, entity_type, entity_id, old_data, new_data)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_old, p_new);
$$;

-- Un administrador puede cambiar estado, rol o marca de prueba de un perfil (además del sistema).
create or replace function public.protect_profile_sensitive_fields()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if (new.role is distinct from old.role
      or new.account_status is distinct from old.account_status
      or new.is_tester is distinct from old.is_tester)
     and not (coalesce(auth.role(), '') = 'service_role' or current_user = 'service_role' or public.is_admin()) then
    raise exception 'No autorizado para modificar role, account_status o is_tester directamente';
  end if;
  return new;
end;
$function$;

-- ===== Afiliados =====

create or replace function public.apply_affiliate(p_note text)
returns uuid
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Iniciá sesión.'; end if;
  if exists (select 1 from affiliates where user_id = auth.uid()) then
    raise exception 'Ya enviaste una solicitud de afiliada.';
  end if;
  insert into affiliates (user_id, status, commission_percentage, application_note)
  values (auth.uid(), 'pending', 15, nullif(left(trim(p_note), 500), ''))
  returning id into v_id;
  return v_id;
end;
$$;

-- Código único a partir del email (letras) + 4 números.
create or replace function public.new_affiliate_code(p_user_id uuid)
returns text
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_base text;
  v_code text;
begin
  select upper(left(regexp_replace(split_part(coalesce(full_name, email), '@', 1), '[^a-zA-Z]', '', 'g'), 6)) into v_base
  from profiles where id = p_user_id;
  if coalesce(v_base, '') = '' then v_base := 'EMPRE'; end if;
  loop
    v_code := v_base || lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when not exists (select 1 from affiliate_codes where code = v_code);
  end loop;
  return v_code;
end;
$$;

create or replace function public.admin_review_affiliate(p_affiliate_id uuid, p_approve boolean, p_percentage numeric default 15)
returns text
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_aff affiliates%rowtype;
  v_code text;
begin
  if not public.is_admin() then raise exception 'No autorizado.'; end if;
  select * into v_aff from affiliates where id = p_affiliate_id for update;
  if v_aff.id is null then raise exception 'No se encontró la solicitud.'; end if;
  if p_approve then
    if p_percentage not in (15, 20, 25, 30) then raise exception 'La comisión tiene que ser 15, 20, 25 o 30 %%.'; end if;
    update affiliates set status = 'approved', commission_percentage = p_percentage, approved_at = coalesce(approved_at, now()), updated_at = now()
      where id = p_affiliate_id;
    select code into v_code from affiliate_codes where affiliate_id = p_affiliate_id and active limit 1;
    if v_code is null then
      v_code := public.new_affiliate_code(v_aff.user_id);
      insert into affiliate_codes (affiliate_id, code, active) values (p_affiliate_id, v_code, true);
    end if;
    perform public.log_audit('affiliate.approve', 'affiliate', p_affiliate_id, to_jsonb(v_aff), jsonb_build_object('percentage', p_percentage, 'code', v_code));
    return v_code;
  else
    update affiliates set status = 'rejected', updated_at = now() where id = p_affiliate_id;
    update affiliate_codes set active = false where affiliate_id = p_affiliate_id;
    perform public.log_audit('affiliate.reject', 'affiliate', p_affiliate_id, to_jsonb(v_aff), null);
    return null;
  end if;
end;
$$;

create or replace function public.admin_set_affiliate_status(p_affiliate_id uuid, p_status text)
returns void
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_old affiliates%rowtype;
begin
  if not public.is_admin() then raise exception 'No autorizado.'; end if;
  if p_status not in ('approved', 'suspended') then raise exception 'Estado inválido.'; end if;
  select * into v_old from affiliates where id = p_affiliate_id for update;
  if v_old.id is null then raise exception 'No se encontró la afiliada.'; end if;
  update affiliates set status = p_status, updated_at = now() where id = p_affiliate_id;
  update affiliate_codes set active = (p_status = 'approved') where affiliate_id = p_affiliate_id;
  perform public.log_audit('affiliate.status', 'affiliate', p_affiliate_id, jsonb_build_object('status', v_old.status), jsonb_build_object('status', p_status));
end;
$$;

-- Asocia una compra pendiente de quien llama a un código de afiliada (antifraude incluido).
create or replace function public.attribute_purchase(p_purchase_id uuid, p_code text)
returns text
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_purchase purchases%rowtype;
  v_aff affiliates%rowtype;
begin
  select * into v_purchase from purchases where id = p_purchase_id and user_id = auth.uid() and payment_status = 'pending';
  if v_purchase.id is null then return 'purchase_not_found'; end if;
  select a.* into v_aff from affiliate_codes c join affiliates a on a.id = c.affiliate_id
    where upper(c.code) = upper(trim(p_code)) and c.active and a.status = 'approved';
  if v_aff.id is null then return 'invalid_code'; end if;
  if v_aff.user_id = auth.uid() then return 'self_referral'; end if;
  if exists (select 1 from affiliate_attributions where purchase_id = p_purchase_id) then return 'already_attributed'; end if;
  insert into affiliate_attributions (affiliate_id, user_id, purchase_id, attribution_type) values (v_aff.id, auth.uid(), p_purchase_id, 'purchase');
  return 'attributed';
end;
$$;

-- Comisión de una compra aprobada (uso interno). Retenida 11 días.
create or replace function public.create_commission_for_purchase(p_purchase_id uuid)
returns void
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_attr affiliate_attributions%rowtype;
  v_aff affiliates%rowtype;
  v_total numeric;
begin
  select * into v_attr from affiliate_attributions where purchase_id = p_purchase_id;
  if v_attr.id is null then return; end if;
  select * into v_aff from affiliates where id = v_attr.affiliate_id;
  if v_aff.status <> 'approved' or v_aff.user_id = v_attr.user_id then return; end if;
  select total into v_total from purchases where id = p_purchase_id and payment_status = 'approved';
  if v_total is null or v_total <= 0 then return; end if;
  insert into commissions (affiliate_id, purchase_id, percentage, gross_sale_amount, commission_amount, hold_until, status)
  values (v_aff.id, p_purchase_id, v_aff.commission_percentage, v_total, round(v_total * v_aff.commission_percentage / 100, 2), now() + interval '11 days', 'held')
  on conflict (purchase_id) do nothing;
end;
$$;

-- Pone al día una afiliada: libera comisiones retenidas y evalúa PRO (uso interno).
create or replace function public.refresh_affiliate(p_affiliate_id uuid)
returns void
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_aff affiliates%rowtype;
  v_month date := date_trunc('month', (now() at time zone 'America/Argentina/Buenos_Aires'))::date;
  v_ok int;
begin
  update commissions set status = 'available', released_at = now()
    where affiliate_id = p_affiliate_id and status = 'held' and hold_until <= now();
  select * into v_aff from affiliates where id = p_affiliate_id;
  if v_aff.id is null or v_aff.is_pro then return; end if;
  -- PRO: los 3 meses completos anteriores con 10 o más ventas válidas cada uno.
  select count(*) into v_ok from (
    select date_trunc('month', created_at at time zone 'America/Argentina/Buenos_Aires') m, count(*) n
    from commissions
    where affiliate_id = p_affiliate_id and status not in ('reversed', 'canceled')
      and created_at at time zone 'America/Argentina/Buenos_Aires' >= (v_month - interval '3 months')
      and created_at at time zone 'America/Argentina/Buenos_Aires' < v_month
    group by 1 having count(*) >= 10
  ) months;
  update affiliates set valid_sales_count = (select count(*) from commissions where affiliate_id = p_affiliate_id and status not in ('reversed', 'canceled')),
    updated_at = now() where id = p_affiliate_id;
  if v_ok = 3 then
    update affiliates set is_pro = true, pro_started_at = now(), commission_percentage = greatest(commission_percentage, 25), updated_at = now()
      where id = p_affiliate_id;
    perform public.log_audit('affiliate.pro', 'affiliate', p_affiliate_id, null, jsonb_build_object('is_pro', true));
  end if;
end;
$$;

create or replace function public.refresh_my_affiliate()
returns void
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from affiliates where user_id = auth.uid();
  if v_id is not null then perform public.refresh_affiliate(v_id); end if;
end;
$$;

-- La afiliada pide cobrar todo lo disponible (si llega al mínimo).
create or replace function public.request_withdrawal(p_method text, p_reference text)
returns uuid
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_aff affiliates%rowtype;
  v_amount numeric;
  v_min numeric;
  v_id uuid;
begin
  select * into v_aff from affiliates where user_id = auth.uid() for update;
  if v_aff.id is null or v_aff.status <> 'approved' then raise exception 'Tu cuenta de afiliada no está activa.'; end if;
  if coalesce(trim(p_method), '') = '' or coalesce(trim(p_reference), '') = '' then raise exception 'Indicá cómo y a dónde querés cobrar.'; end if;
  perform public.refresh_affiliate(v_aff.id);
  if exists (select 1 from withdrawals where affiliate_id = v_aff.id and status in ('requested', 'reviewing', 'approved')) then
    raise exception 'Ya tenés un retiro en curso.';
  end if;
  select coalesce(sum(commission_amount), 0) into v_amount from commissions where affiliate_id = v_aff.id and status = 'available';
  v_min := case when v_aff.is_pro then 10000 else 20000 end;
  if v_amount < v_min then
    raise exception 'El mínimo para retirar es $% y tenés $% disponibles.', to_char(v_min, 'FM999G999G990'), to_char(v_amount, 'FM999G999G990D00');
  end if;
  insert into withdrawals (affiliate_id, amount, payout_method, payout_reference, status)
  values (v_aff.id, v_amount, left(trim(p_method), 60), left(trim(p_reference), 120), 'requested')
  returning id into v_id;
  update commissions set status = 'withdrawal_requested', withdrawal_id = v_id where affiliate_id = v_aff.id and status = 'available';
  return v_id;
end;
$$;

create or replace function public.admin_update_withdrawal(p_withdrawal_id uuid, p_status text, p_notes text default null)
returns void
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_old withdrawals%rowtype;
begin
  if not public.is_admin() then raise exception 'No autorizado.'; end if;
  if p_status not in ('reviewing', 'approved', 'paid', 'rejected') then raise exception 'Estado inválido.'; end if;
  select * into v_old from withdrawals where id = p_withdrawal_id for update;
  if v_old.id is null then raise exception 'No se encontró el retiro.'; end if;
  if v_old.status in ('paid', 'rejected') then raise exception 'Ese retiro ya está cerrado.'; end if;
  update withdrawals set status = p_status, paid_at = case when p_status = 'paid' then now() else paid_at end,
    notes = coalesce(nullif(trim(p_notes), ''), notes) where id = p_withdrawal_id;
  if p_status = 'paid' then
    update commissions set status = 'paid' where withdrawal_id = p_withdrawal_id;
  elsif p_status = 'rejected' then
    update commissions set status = 'available', withdrawal_id = null where withdrawal_id = p_withdrawal_id and status = 'withdrawal_requested';
  end if;
  perform public.log_audit('withdrawal.' || p_status, 'withdrawal', p_withdrawal_id, jsonb_build_object('status', v_old.status), jsonb_build_object('status', p_status, 'notes', p_notes));
end;
$$;

-- ===== Administración =====

create or replace function public.admin_set_account_status(p_user_id uuid, p_status text)
returns void
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_old text;
begin
  if not public.is_admin() then raise exception 'No autorizado.'; end if;
  if p_status not in ('active', 'suspended', 'blocked') then raise exception 'Estado inválido.'; end if;
  if p_user_id = auth.uid() then raise exception 'No podés cambiar el estado de tu propia cuenta.'; end if;
  select account_status into v_old from profiles where id = p_user_id for update;
  if v_old is null then raise exception 'No se encontró la cuenta.'; end if;
  update profiles set account_status = p_status, updated_at = now() where id = p_user_id;
  perform public.log_audit('user.status', 'profile', p_user_id, jsonb_build_object('account_status', v_old), jsonb_build_object('account_status', p_status));
end;
$$;

-- Licencia de cortesía (queda registrada como dev_grant y en la auditoría).
create or replace function public.admin_grant_license(p_user_id uuid, p_plan_code text, p_reason text)
returns uuid
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_plan uuid;
  v_grant uuid;
  v_license uuid;
begin
  if not public.is_admin() then raise exception 'No autorizado.'; end if;
  select id into v_plan from plans where code = p_plan_code and p_plan_code in ('BASIC', 'ADVANCED');
  if v_plan is null then raise exception 'Plan inválido.'; end if;
  if exists (select 1 from licenses l join plans p on p.id = l.plan_id where l.user_id = p_user_id and l.status = 'active' and p.code in ('BASIC', 'ADVANCED')) then
    raise exception 'La cuenta ya tiene una licencia activa.';
  end if;
  insert into dev_grants (user_id, grant_type, target_id, granted_by_admin_id, reason)
  values (p_user_id, 'license', v_plan, auth.uid(), coalesce(nullif(trim(p_reason), ''), 'Licencia de cortesía'))
  returning id into v_grant;
  insert into licenses (user_id, plan_id, dev_grant_id, status, acquired_at, activated_at)
  values (p_user_id, v_plan, v_grant, 'active', now(), now())
  returning id into v_license;
  perform public.log_audit('license.grant', 'license', v_license, null, jsonb_build_object('user_id', p_user_id, 'plan', p_plan_code, 'reason', p_reason));
  return v_license;
end;
$$;

-- ===== Activación y pagos: ahora también generan / anulan comisiones =====

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
  -- Si la compra vino de una afiliada, se genera su comisión (retenida 11 días).
  perform public.create_commission_for_purchase(v_sub.purchase_id);
  return v_expires;
end;
$$;

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

-- Permisos
revoke all on function public.log_audit(text, text, uuid, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.new_affiliate_code(uuid) from public, anon, authenticated;
revoke all on function public.create_commission_for_purchase(uuid) from public, anon, authenticated;
revoke all on function public.refresh_affiliate(uuid) from public, anon, authenticated;
revoke all on function public.apply_subscription_activation(uuid) from public, anon, authenticated;
revoke all on function public.mp_record_payment(jsonb) from public, anon, authenticated;
grant execute on function public.apply_subscription_activation(uuid) to service_role;
grant execute on function public.mp_record_payment(jsonb) to service_role;
revoke all on function public.apply_affiliate(text) from public, anon;
revoke all on function public.admin_review_affiliate(uuid, boolean, numeric) from public, anon;
revoke all on function public.admin_set_affiliate_status(uuid, text) from public, anon;
revoke all on function public.attribute_purchase(uuid, text) from public, anon;
revoke all on function public.refresh_my_affiliate() from public, anon;
revoke all on function public.request_withdrawal(text, text) from public, anon;
revoke all on function public.admin_update_withdrawal(uuid, text, text) from public, anon;
revoke all on function public.admin_set_account_status(uuid, text) from public, anon;
revoke all on function public.admin_grant_license(uuid, text, text) from public, anon;
grant execute on function public.apply_affiliate(text) to authenticated;
grant execute on function public.admin_review_affiliate(uuid, boolean, numeric) to authenticated;
grant execute on function public.admin_set_affiliate_status(uuid, text) to authenticated;
grant execute on function public.attribute_purchase(uuid, text) to authenticated;
grant execute on function public.refresh_my_affiliate() to authenticated;
grant execute on function public.request_withdrawal(text, text) to authenticated;
grant execute on function public.admin_update_withdrawal(uuid, text, text) to authenticated;
grant execute on function public.admin_set_account_status(uuid, text) to authenticated;
grant execute on function public.admin_grant_license(uuid, text, text) to authenticated;

-- ===== Ajustes aplicados después (mismo día) =====

-- Montos en formato argentino para los mensajes ($20.000,00).
create or replace function public.ars(p numeric)
returns text
language sql immutable
set search_path = public
as $$
  select '$' || translate(to_char(round(p, 2), 'FM999,999,999,990.00'), ',.', '.,');
$$;

create or replace function public.request_withdrawal(p_method text, p_reference text)
returns uuid
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_aff affiliates%rowtype;
  v_amount numeric;
  v_min numeric;
  v_id uuid;
begin
  select * into v_aff from affiliates where user_id = auth.uid() for update;
  if v_aff.id is null or v_aff.status <> 'approved' then raise exception 'Tu cuenta de afiliada no está activa.'; end if;
  if coalesce(trim(p_method), '') = '' or coalesce(trim(p_reference), '') = '' then raise exception 'Indicá cómo y a dónde querés cobrar.'; end if;
  perform public.refresh_affiliate(v_aff.id);
  if exists (select 1 from withdrawals where affiliate_id = v_aff.id and status in ('requested', 'reviewing', 'approved')) then
    raise exception 'Ya tenés un retiro en curso.';
  end if;
  select coalesce(sum(commission_amount), 0) into v_amount from commissions where affiliate_id = v_aff.id and status = 'available';
  v_min := case when v_aff.is_pro then 10000 else 20000 end;
  if v_amount < v_min then
    raise exception 'El mínimo para retirar es % y tenés % disponibles.', public.ars(v_min), public.ars(v_amount);
  end if;
  insert into withdrawals (affiliate_id, amount, payout_method, payout_reference, status)
  values (v_aff.id, v_amount, left(trim(p_method), 60), left(trim(p_reference), 120), 'requested')
  returning id into v_id;
  update commissions set status = 'withdrawal_requested', withdrawal_id = v_id where affiliate_id = v_aff.id and status = 'available';
  return v_id;
end;
$$;

-- ¿El código existe, está activo y no es de quien lo usa? (para avisar antes de pagar)
create or replace function public.check_affiliate_code(p_code text)
returns text
language sql stable security definer
set search_path = public
as $$
  select case
    when a.id is null then 'invalid_code'
    when a.user_id = auth.uid() then 'self_referral'
    else 'ok' end
  from (select 1) x
  left join affiliate_codes c on upper(c.code) = upper(trim(p_code)) and c.active
  left join affiliates a on a.id = c.affiliate_id and a.status = 'approved';
$$;

revoke all on function public.request_withdrawal(text, text) from public, anon;
grant execute on function public.request_withdrawal(text, text) to authenticated;
revoke all on function public.check_affiliate_code(text) from public, anon;
grant execute on function public.check_affiliate_code(text) to authenticated;

-- Aprobar o rechazar solo actúa sobre solicitudes pendientes: tocar dos veces no duplica registros.
create or replace function public.admin_review_affiliate(p_affiliate_id uuid, p_approve boolean, p_percentage numeric default 15)
returns text
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_aff affiliates%rowtype;
  v_code text;
begin
  if not public.is_admin() then raise exception 'No autorizado.'; end if;
  select * into v_aff from affiliates where id = p_affiliate_id for update;
  if v_aff.id is null then raise exception 'No se encontró la solicitud.'; end if;
  if v_aff.status <> 'pending' then
    if p_approve and v_aff.status = 'approved' then
      select code into v_code from affiliate_codes where affiliate_id = p_affiliate_id and active limit 1;
      return v_code;
    end if;
    raise exception 'Esta solicitud ya fue revisada.';
  end if;
  if p_approve then
    if p_percentage not in (15, 20, 25, 30) then raise exception 'La comisión tiene que ser 15, 20, 25 o 30 %%.'; end if;
    update affiliates set status = 'approved', commission_percentage = p_percentage, approved_at = coalesce(approved_at, now()), updated_at = now()
      where id = p_affiliate_id;
    select code into v_code from affiliate_codes where affiliate_id = p_affiliate_id and active limit 1;
    if v_code is null then
      v_code := public.new_affiliate_code(v_aff.user_id);
      insert into affiliate_codes (affiliate_id, code, active) values (p_affiliate_id, v_code, true);
    end if;
    perform public.log_audit('affiliate.approve', 'affiliate', p_affiliate_id, to_jsonb(v_aff), jsonb_build_object('percentage', p_percentage, 'code', v_code));
    return v_code;
  else
    update affiliates set status = 'rejected', updated_at = now() where id = p_affiliate_id;
    update affiliate_codes set active = false where affiliate_id = p_affiliate_id;
    perform public.log_audit('affiliate.reject', 'affiliate', p_affiliate_id, to_jsonb(v_aff), null);
    return null;
  end if;
end;
$$;
revoke all on function public.admin_review_affiliate(uuid, boolean, numeric) from public, anon;
grant execute on function public.admin_review_affiliate(uuid, boolean, numeric) to authenticated;
