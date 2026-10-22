-- Afiliadas:
-- 1) La compra de la Edición Personal desde la página (sin cuenta) ahora genera comisión si la persona
--    llegó con el enlace de una afiliada. Si se devuelve el pago, la comisión se anula.
-- 2) Personal Plus mensual: la afiliada también cobra las renovaciones del primer año (11 cobros después
--    del primero). El anual es un solo pago y ya genera su comisión al pagarse.

alter table public.personal_orders add column if not exists affiliate_id uuid references public.affiliates (id);
create index if not exists personal_orders_affiliate_id_idx on public.personal_orders (affiliate_id);

alter table public.commissions alter column purchase_id drop not null;
alter table public.commissions add column if not exists personal_order_id uuid references public.personal_orders (id);
create unique index if not exists commissions_personal_order_id_key on public.commissions (personal_order_id);
alter table public.commissions drop constraint if exists commissions_source_check;
alter table public.commissions add constraint commissions_source_check check (purchase_id is not null or personal_order_id is not null);

-- La llama el servidor al crear el pedido, con el código del enlace (cookie «ref»).
-- No hace nada si el código no existe, la afiliada no está aprobada o se compra con el email de la propia afiliada.
create or replace function public.attach_affiliate_to_order(p_order_id uuid, p_code text) returns boolean
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_aff affiliates%rowtype;
  v_order personal_orders%rowtype;
begin
  if coalesce(trim(p_code), '') = '' then return false; end if;
  select * into v_order from personal_orders where id = p_order_id and status = 'pending';
  if v_order.id is null then return false; end if;
  select a.* into v_aff from affiliate_codes c join affiliates a on a.id = c.affiliate_id
   where upper(c.code) = upper(trim(p_code)) and c.active and a.status = 'approved';
  if v_aff.id is null then return false; end if;
  if exists (select 1 from profiles p where p.id = v_aff.user_id and lower(p.email) = lower(v_order.email)) then return false; end if;
  update personal_orders set affiliate_id = v_aff.id, updated_at = now() where id = p_order_id;
  return true;
end;
$$;
revoke all on function public.attach_affiliate_to_order(uuid, text) from public, anon, authenticated;
grant execute on function public.attach_affiliate_to_order(uuid, text) to service_role;

-- Al aprobarse el pedido: comisión retenida 11 días (como las demás). Al devolverse: se anula.
do $do$
declare
  v_def text := pg_get_functiondef('public.mp_record_personal_order(jsonb)'::regprocedure);
  v_ok text := 'perform public.approve_email_internal(v_order.email, ''online'', ''Pedido online '' || v_order.id::text);';
  v_refund text := 'update personal_orders set status = ''refunded'', updated_at = now() where id = v_order.id;';
begin
  if position(v_ok in v_def) = 0 or position(v_refund in v_def) = 0 then raise exception 'mp_record_personal_order cambió: revisar a mano'; end if;
  v_def := replace(v_def, v_ok, v_ok || $add$
  if v_order.affiliate_id is not null then
    insert into commissions (affiliate_id, personal_order_id, percentage, gross_sale_amount, commission_amount, hold_until, status)
    select a.id, v_order.id, a.commission_percentage, v_order.total, round(v_order.total * a.commission_percentage / 100, 2), now() + interval '11 days', 'held'
      from affiliates a where a.id = v_order.affiliate_id and a.status = 'approved'
    on conflict (personal_order_id) do nothing;
  end if;$add$);
  v_def := replace(v_def, v_refund, v_refund || $add$
      update commissions set status = 'reversed', reversed_at = now()
       where personal_order_id = v_order.id and status in ('pending', 'held', 'available');$add$);
  execute v_def;
end
$do$;

-- Renovaciones mensuales del primer año: copian la atribución del primer pago y generan su comisión.
do $do$
declare
  v_def text := pg_get_functiondef('public.mp_record_subscription_payment(jsonb)'::regprocedure);
  v_anchor text := 'update subscriptions set expires_at = v_start + interval ''1 month'', updated_at = now() where id = v_sub.id;';
begin
  if position(v_anchor in v_def) = 0 then raise exception 'mp_record_subscription_payment cambió: revisar a mano'; end if;
  execute replace(v_def, v_anchor, v_anchor || $add$
  if v_number <= 11 then
    insert into affiliate_attributions (affiliate_id, user_id, purchase_id, attribution_type)
    select a.affiliate_id, a.user_id, v_purchase, 'purchase' from affiliate_attributions a where a.purchase_id = v_sub.purchase_id
    on conflict (purchase_id) do nothing;
    perform public.create_commission_for_purchase(v_purchase);
  end if;$add$);
end
$do$;
