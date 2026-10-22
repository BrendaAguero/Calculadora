-- Pulido del programa de afiliadas.

-- 1) Liberación y PRO: solo cuentan las ventas nuevas (no las renovaciones mensuales de Personal Plus),
--    y el conteo de ventas válidas se actualiza también para las PRO. Una tarea diaria lo hace para todas.
create or replace function public.refresh_affiliate(p_affiliate_id uuid) returns void
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_aff affiliates%rowtype;
  v_month date := date_trunc('month', (now() at time zone 'America/Argentina/Buenos_Aires'))::date;
  v_ok int;
begin
  update commissions set status = 'available', released_at = now()
    where affiliate_id = p_affiliate_id and status = 'held' and hold_until <= now();
  select * into v_aff from affiliates where id = p_affiliate_id;
  if v_aff.id is null then return; end if;
  update affiliates set valid_sales_count = (
      select count(*) from commissions c
       where c.affiliate_id = p_affiliate_id and c.status not in ('reversed', 'canceled')
         and not exists (select 1 from purchases p where p.id = c.purchase_id and p.product_type = 'subscription_renewal')),
    updated_at = now() where id = p_affiliate_id;
  if v_aff.is_pro then return; end if;
  select count(*) into v_ok from (
    select date_trunc('month', c.created_at at time zone 'America/Argentina/Buenos_Aires') m
      from commissions c
     where c.affiliate_id = p_affiliate_id and c.status not in ('reversed', 'canceled')
       and not exists (select 1 from purchases p where p.id = c.purchase_id and p.product_type = 'subscription_renewal')
       and c.created_at at time zone 'America/Argentina/Buenos_Aires' >= (v_month - interval '3 months')
       and c.created_at at time zone 'America/Argentina/Buenos_Aires' < v_month
     group by 1 having count(*) >= 10
  ) months;
  if v_ok = 3 then
    update affiliates set is_pro = true, pro_started_at = now(), commission_percentage = greatest(commission_percentage, 25), updated_at = now()
      where id = p_affiliate_id;
    perform public.log_audit('affiliate.pro', 'affiliate', p_affiliate_id, null, jsonb_build_object('is_pro', true));
  end if;
end;
$$;
revoke all on function public.refresh_affiliate(uuid) from public, anon, authenticated;

create or replace function public.refresh_all_affiliates() returns void
language plpgsql security definer set search_path to 'public'
as $$
declare v_id uuid;
begin
  for v_id in select id from affiliates where status in ('approved', 'suspended') loop
    perform public.refresh_affiliate(v_id);
  end loop;
end;
$$;
revoke all on function public.refresh_all_affiliates() from public, anon, authenticated;
select cron.schedule('liberar-comisiones', '23 9 * * *', 'select public.refresh_all_affiliates();');

-- 2) Retiros: mínimo configurable y datos de cobro válidos (CBU/CVU de 22 números, alias o email de Mercado Pago).
insert into public.pricing_config (key, value_numeric, description) values
  ('affiliate_min_withdrawal', 20000, 'Mínimo para que una afiliada pida un retiro.'),
  ('affiliate_min_withdrawal_pro', 10000, 'Mínimo de retiro para afiliadas PRO.')
on conflict (key) do nothing;

create or replace function public.request_withdrawal(p_method text, p_reference text) returns uuid
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_aff affiliates%rowtype;
  v_amount numeric;
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
  select value_numeric into v_min from pricing_config
   where key = case when v_aff.is_pro then 'affiliate_min_withdrawal_pro' else 'affiliate_min_withdrawal' end;
  v_min := coalesce(v_min, case when v_aff.is_pro then 10000 else 20000 end);
  if v_amount < v_min then
    raise exception 'El mínimo para retirar es % y tenés % disponibles.', public.ars(v_min), public.ars(v_amount);
  end if;
  insert into withdrawals (affiliate_id, amount, payout_method, payout_reference, status)
  values (v_aff.id, v_amount, left(trim(p_method), 60), left(v_ref, 120), 'requested')
  returning id into v_id;
  update commissions set status = 'withdrawal_requested', withdrawal_id = v_id where affiliate_id = v_aff.id and status = 'available';
  return v_id;
end;
$$;

create or replace function public.admin_set_affiliate_withdrawal_min(p_min numeric, p_min_pro numeric) returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.is_admin() then raise exception 'Solo la administración puede hacer esto.'; end if;
  if p_min is null or p_min_pro is null or p_min < 0 or p_min_pro < 0 then raise exception 'Mínimos inválidos.'; end if;
  update pricing_config set value_numeric = p_min, updated_at = now() where key = 'affiliate_min_withdrawal';
  update pricing_config set value_numeric = p_min_pro, updated_at = now() where key = 'affiliate_min_withdrawal_pro';
  perform public.log_audit('affiliate.withdrawal_min', 'pricing', null, null, jsonb_build_object('min', p_min, 'min_pro', p_min_pro));
end;
$$;
revoke all on function public.admin_set_affiliate_withdrawal_min(numeric, numeric) from public, anon;
grant execute on function public.admin_set_affiliate_withdrawal_min(numeric, numeric) to authenticated;

-- 3) Detalle de cada comisión para la afiliada: qué se compró (sin datos de quien compró).
create or replace function public.my_commissions() returns table (
  id uuid, created_at timestamptz, gross_sale_amount numeric, percentage numeric, commission_amount numeric,
  status text, hold_until timestamptz, label text)
language sql stable security definer set search_path to 'public'
as $$
  select c.id, c.created_at, c.gross_sale_amount, c.percentage, c.commission_amount, c.status, c.hold_until,
    case
      when c.personal_order_id is not null then 'Edición Personal'
      when p.product_type = 'license' then 'Edición Personal'
      when p.product_type = 'license_upgrade' then 'Mejora de la Edición Personal'
      when p.product_type = 'subscription_initial' then 'Personal Plus' || coalesce(' · ' || case sc.duration_months when 12 then 'anual' when 1 then 'mensual' else sc.duration_months || ' meses' end, '')
      when p.product_type = 'subscription_renewal' then 'Personal Plus · renovación mensual'
      when p.product_type = 'module' then coalesce(m.name, 'Extra de la tienda')
      when p.product_type = 'activity' then 'Actividad'
      else 'Compra' end
  from commissions c
  join affiliates a on a.id = c.affiliate_id and a.user_id = auth.uid()
  left join purchases p on p.id = c.purchase_id
  left join subscription_plans_catalog sc on sc.id = p.product_id and p.product_type = 'subscription_initial'
  left join modules m on m.id = p.product_id and p.product_type = 'module'
  order by c.created_at desc
  limit 200;
$$;
revoke all on function public.my_commissions() from public, anon;
grant execute on function public.my_commissions() to authenticated;

-- 4) Visitas al enlace: solo un conteo por día (sin IP ni datos de quien entra).
create table if not exists public.affiliate_link_visits (
  affiliate_id uuid not null references public.affiliates (id) on delete cascade,
  day date not null,
  visits integer not null default 0,
  primary key (affiliate_id, day)
);
alter table public.affiliate_link_visits enable row level security;
create policy affiliate_link_visits_select on public.affiliate_link_visits for select
  using (public.is_admin() or exists (select 1 from affiliates a where a.id = affiliate_id and a.user_id = (select auth.uid())));

create or replace function public.track_affiliate_visit(p_code text) returns void
language plpgsql security definer set search_path to 'public'
as $$
declare v_aff uuid;
begin
  select c.affiliate_id into v_aff from affiliate_codes c join affiliates a on a.id = c.affiliate_id
   where upper(c.code) = upper(trim(p_code)) and c.active and a.status = 'approved';
  if v_aff is null then return; end if;
  insert into affiliate_link_visits (affiliate_id, day, visits)
  values (v_aff, (now() at time zone 'America/Argentina/Buenos_Aires')::date, 1)
  on conflict (affiliate_id, day) do update set visits = affiliate_link_visits.visits + 1;
end;
$$;
revoke all on function public.track_affiliate_visit(text) from public, anon, authenticated;
grant execute on function public.track_affiliate_visit(text) to service_role;

-- 5) Referidas: quien crea su cuenta llegando por un enlace queda asociada a esa afiliada 90 días,
--    así la comisión vale aunque compre más tarde, desde otro aparato o sin la cookie.
create table if not exists public.affiliate_referrals (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  affiliate_id uuid not null references public.affiliates (id),
  referred_at timestamptz not null default now()
);
create index if not exists affiliate_referrals_affiliate_id_idx on public.affiliate_referrals (affiliate_id);
alter table public.affiliate_referrals enable row level security;
create policy affiliate_referrals_select_admin on public.affiliate_referrals for select using (public.is_admin());

create or replace function public.set_signup_referral(p_user_id uuid, p_code text) returns boolean
language plpgsql security definer set search_path to 'public'
as $$
declare v_aff affiliates%rowtype;
begin
  select a.* into v_aff from affiliate_codes c join affiliates a on a.id = c.affiliate_id
   where upper(c.code) = upper(trim(coalesce(p_code, ''))) and c.active and a.status = 'approved';
  if v_aff.id is null or v_aff.user_id = p_user_id then return false; end if;
  insert into affiliate_referrals (user_id, affiliate_id) values (p_user_id, v_aff.id) on conflict (user_id) do nothing;
  return true;
end;
$$;
revoke all on function public.set_signup_referral(uuid, text) from public, anon, authenticated;
grant execute on function public.set_signup_referral(uuid, text) to service_role;

-- Código de la afiliada que refirió a la cuenta actual, si fue hace menos de 90 días y sigue activa.
create or replace function public.my_referral_code() returns text
language sql stable security definer set search_path to 'public'
as $$
  select c.code from affiliate_referrals r
    join affiliates a on a.id = r.affiliate_id and a.status = 'approved'
    join affiliate_codes c on c.affiliate_id = a.id and c.active
   where r.user_id = auth.uid() and r.referred_at > now() - interval '90 days'
   limit 1;
$$;
revoke all on function public.my_referral_code() from public, anon;
grant execute on function public.my_referral_code() to authenticated;

-- 6) Administración: cambiar el porcentaje y anular comisiones pendientes (por ejemplo, si hubo fraude).
create or replace function public.admin_set_affiliate_percentage(p_affiliate_id uuid, p_pct numeric) returns void
language plpgsql security definer set search_path to 'public'
as $$
declare v_old numeric;
begin
  if not public.is_admin() then raise exception 'Solo la administración puede hacer esto.'; end if;
  if p_pct is null or p_pct < 5 or p_pct > 40 then raise exception 'La comisión va de 5 a 40 %%.'; end if;
  select commission_percentage into v_old from affiliates where id = p_affiliate_id for update;
  if v_old is null then raise exception 'No se encontró la afiliada.'; end if;
  update affiliates set commission_percentage = p_pct, updated_at = now() where id = p_affiliate_id;
  perform public.log_audit('affiliate.percentage', 'affiliate', p_affiliate_id, jsonb_build_object('pct', v_old), jsonb_build_object('pct', p_pct));
end;
$$;
revoke all on function public.admin_set_affiliate_percentage(uuid, numeric) from public, anon;
grant execute on function public.admin_set_affiliate_percentage(uuid, numeric) to authenticated;

create or replace function public.admin_cancel_affiliate_commissions(p_affiliate_id uuid, p_reason text) returns integer
language plpgsql security definer set search_path to 'public'
as $$
declare v_n integer;
begin
  if not public.is_admin() then raise exception 'Solo la administración puede hacer esto.'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'Escribí el motivo.'; end if;
  update commissions set status = 'canceled' where affiliate_id = p_affiliate_id and status in ('pending', 'held', 'available');
  get diagnostics v_n = row_count;
  perform public.log_audit('affiliate.cancel_commissions', 'affiliate', p_affiliate_id, null, jsonb_build_object('count', v_n, 'reason', left(btrim(p_reason), 300)));
  return v_n;
end;
$$;
revoke all on function public.admin_cancel_affiliate_commissions(uuid, text) from public, anon;
grant execute on function public.admin_cancel_affiliate_commissions(uuid, text) to authenticated;
