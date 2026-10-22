-- 1) 5 % de descuento en Personal Plus ANUAL para quien lo contrata con el código o enlace de una afiliada.
--    Un solo descuento por compra: si ya tiene uno mayor (por ejemplo, por antigüedad), vale ese.
--    No aplica a actualizaciones de plan. El porcentaje se cambia en Administración → Afiliadas (0 = sin descuento).
insert into public.pricing_config (key, value_numeric, description) values
  ('affiliate_annual_discount_pct', 5, 'Descuento (%) en Personal Plus anual al contratarlo con el código o enlace de una afiliada.')
on conflict (key) do nothing;

create or replace function public.apply_affiliate_annual_discount(p_subscription_id uuid) returns numeric
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_sub subscriptions%rowtype;
  v_pct numeric;
  v_new numeric;
begin
  select * into v_sub from subscriptions
   where id = p_subscription_id and user_id = auth.uid() and status = 'pending'
     and duration_months = 12 and upgraded_from_subscription_id is null
   for update;
  if v_sub.id is null then return null; end if;
  -- Solo si la compra quedó a nombre de una afiliada (la base ya validó el código y que no sea propio).
  if not exists (select 1 from affiliate_attributions where purchase_id = v_sub.purchase_id) then return null; end if;
  select coalesce(value_numeric, 0) into v_pct from pricing_config where key = 'affiliate_annual_discount_pct';
  if coalesce(v_pct, 0) <= 0 or v_sub.total_discount_percentage >= v_pct then return null; end if;
  v_new := round(v_sub.price_before_discount * (100 - v_pct) / 100);
  update subscriptions set total_discount_percentage = v_pct, final_price = v_new, updated_at = now() where id = v_sub.id;
  update purchases set discount_amount = subtotal - v_new, total = v_new, updated_at = now()
   where id = v_sub.purchase_id and payment_status = 'pending';
  return v_new;
end;
$$;
revoke all on function public.apply_affiliate_annual_discount(uuid) from public, anon;
grant execute on function public.apply_affiliate_annual_discount(uuid) to authenticated;

create or replace function public.admin_set_affiliate_annual_discount(p_pct numeric) returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.is_admin() then raise exception 'Solo la administración puede hacer esto.'; end if;
  if p_pct is null or p_pct < 0 or p_pct > 30 then raise exception 'Poné de 0 a 30 %%.'; end if;
  update pricing_config set value_numeric = p_pct, updated_at = now() where key = 'affiliate_annual_discount_pct';
  perform public.log_audit('affiliate.annual_discount', 'pricing', null, null, jsonb_build_object('pct', p_pct));
end;
$$;
revoke all on function public.admin_set_affiliate_annual_discount(numeric) from public, anon;
grant execute on function public.admin_set_affiliate_annual_discount(numeric) to authenticated;

-- 2) Contracargos y devoluciones de ventas cuya comisión ya se pagó (o está en un retiro):
--    queda un descuento pendiente que se resta solo del próximo retiro de esa afiliada.
create table if not exists public.affiliate_adjustments (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates (id),
  commission_id uuid unique references public.commissions (id),
  amount numeric not null check (amount < 0),
  reason text not null,
  withdrawal_id uuid references public.withdrawals (id),
  created_at timestamptz not null default now()
);
create index if not exists affiliate_adjustments_affiliate_id_idx on public.affiliate_adjustments (affiliate_id);
create index if not exists affiliate_adjustments_withdrawal_id_idx on public.affiliate_adjustments (withdrawal_id);
alter table public.affiliate_adjustments enable row level security;
create policy affiliate_adjustments_select on public.affiliate_adjustments for select
  using (public.is_admin() or exists (select 1 from affiliates a where a.id = affiliate_id and a.user_id = (select auth.uid())));

-- Los descuentos tampoco se borran ni cambian de monto (solo se asocian a un retiro).
create or replace function public.affiliate_adjustments_guard() returns trigger
language plpgsql set search_path to 'public'
as $$
begin
  if tg_op = 'DELETE' then raise exception 'Los descuentos de afiliadas no se borran.'; end if;
  if new.affiliate_id is distinct from old.affiliate_id or new.amount is distinct from old.amount
     or new.commission_id is distinct from old.commission_id or new.created_at is distinct from old.created_at then
    raise exception 'Un descuento de afiliada no se puede modificar.';
  end if;
  return new;
end;
$$;
create trigger affiliate_adjustments_guard before update or delete on public.affiliate_adjustments
  for each row execute function public.affiliate_adjustments_guard();

-- Al devolverse una compra de la app.
do $do$
declare
  v_def text := pg_get_functiondef('public.mp_record_payment(jsonb)'::regprocedure);
  v_anchor text := 'where purchase_id = v_purchase.id and status in (''pending'', ''held'', ''available'');';
begin
  if position(v_anchor in v_def) = 0 then raise exception 'mp_record_payment cambió: revisar a mano'; end if;
  execute replace(v_def, v_anchor, v_anchor || $add$
      insert into affiliate_adjustments (affiliate_id, commission_id, amount, reason)
      select c.affiliate_id, c.id, -c.commission_amount, 'Devolución o contracargo de una venta ya cobrada'
        from commissions c where c.purchase_id = v_purchase.id and c.status in ('paid', 'withdrawal_requested') and c.commission_amount > 0
      on conflict (commission_id) do nothing;$add$);
end
$do$;

-- Al devolverse una compra de la Edición Personal hecha desde la página.
do $do$
declare
  v_def text := pg_get_functiondef('public.mp_record_personal_order(jsonb)'::regprocedure);
  v_anchor text := 'where personal_order_id = v_order.id and status in (''pending'', ''held'', ''available'');';
begin
  if position(v_anchor in v_def) = 0 then raise exception 'mp_record_personal_order cambió: revisar a mano'; end if;
  execute replace(v_def, v_anchor, v_anchor || $add$
      insert into affiliate_adjustments (affiliate_id, commission_id, amount, reason)
      select c.affiliate_id, c.id, -c.commission_amount, 'Devolución o contracargo de una venta ya cobrada'
        from commissions c where c.personal_order_id = v_order.id and c.status in ('paid', 'withdrawal_requested') and c.commission_amount > 0
      on conflict (commission_id) do nothing;$add$);
end
$do$;

-- Si se rechaza un retiro, sus descuentos vuelven a quedar pendientes.
do $do$
declare
  v_def text := pg_get_functiondef('public.admin_update_withdrawal(uuid, text, text)'::regprocedure);
  v_anchor text := 'update commissions set status = ''available'', withdrawal_id = null where withdrawal_id = p_withdrawal_id and status = ''withdrawal_requested'';';
begin
  if position(v_anchor in v_def) = 0 then raise exception 'admin_update_withdrawal cambió: revisar a mano'; end if;
  execute replace(v_def, v_anchor, v_anchor || $add$
    update affiliate_adjustments set withdrawal_id = null where withdrawal_id = p_withdrawal_id;$add$);
end
$do$;

-- Retiro: lo disponible menos los descuentos pendientes.
create or replace function public.request_withdrawal(p_method text, p_reference text) returns uuid
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_aff affiliates%rowtype;
  v_amount numeric;
  v_debt numeric;
  v_min numeric;
  v_ref text := regexp_replace(coalesce(p_reference, ''), '\s', '', 'g');
  v_id uuid;
begin
  select * into v_aff from affiliates where user_id = auth.uid() for update;
  if v_aff.id is null or v_aff.status <> 'approved' then raise exception 'Tu cuenta de afiliada no está activa.'; end if;
  if coalesce(trim(p_method), '') = '' then raise exception 'Elegí cómo querés cobrar.'; end if;
  if not (v_ref ~ '^\d{22}$' or v_ref ~ '^[A-Za-z0-9.\-]{6,20}$' or v_ref ~ '^[^@]+@[^@]+\.[^@]+$') then
    raise exception 'Revisá tus datos de cobro: el CBU o CVU tiene 22 números; el alias, entre 6 y 20 letras, números, puntos o guiones; o poné el email de tu Mercado Pago.';
  end if;
  perform public.refresh_affiliate(v_aff.id);
  if exists (select 1 from withdrawals where affiliate_id = v_aff.id and status in ('requested', 'reviewing', 'approved')) then
    raise exception 'Ya tenés un retiro en curso.';
  end if;
  select coalesce(sum(commission_amount), 0) into v_amount from commissions where affiliate_id = v_aff.id and status = 'available';
  select coalesce(sum(amount), 0) into v_debt from affiliate_adjustments where affiliate_id = v_aff.id and withdrawal_id is null;
  v_amount := v_amount + v_debt;
  select value_numeric into v_min from pricing_config
   where key = case when v_aff.is_pro then 'affiliate_min_withdrawal_pro' else 'affiliate_min_withdrawal' end;
  v_min := coalesce(v_min, case when v_aff.is_pro then 10000 else 20000 end);
  if v_amount < v_min then
    raise exception 'El mínimo para retirar es % y tenés % disponibles%.', public.ars(v_min), public.ars(greatest(v_amount, 0)),
      case when v_debt < 0 then ' (ya descontamos ' || public.ars(-v_debt) || ' de ventas devueltas)' else '' end;
  end if;
  insert into withdrawals (affiliate_id, amount, payout_method, payout_reference, status)
  values (v_aff.id, v_amount, left(trim(p_method), 60), left(v_ref, 120), 'requested')
  returning id into v_id;
  update commissions set status = 'withdrawal_requested', withdrawal_id = v_id where affiliate_id = v_aff.id and status = 'available';
  update affiliate_adjustments set withdrawal_id = v_id where affiliate_id = v_aff.id and withdrawal_id is null;
  return v_id;
end;
$$;

-- El control al pagar suma también los descuentos del retiro.
create or replace function public.withdrawals_guard() returns trigger
language plpgsql set search_path to 'public'
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Los retiros no se borran: se rechazan.';
  end if;
  if new.affiliate_id is distinct from old.affiliate_id or new.amount is distinct from old.amount then
    raise exception 'El monto de un retiro no se puede modificar.';
  end if;
  if new.status = 'paid' and old.status <> 'paid'
     and new.amount <> (select coalesce(sum(commission_amount), 0) from commissions where withdrawal_id = new.id)
                     + (select coalesce(sum(amount), 0) from affiliate_adjustments where withdrawal_id = new.id) then
    raise exception 'El monto del retiro no coincide con sus comisiones: revisalo antes de pagar.';
  end if;
  return new;
end;
$$;
