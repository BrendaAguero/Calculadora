-- Códigos de descuento que crea la administración (uno o varios a la vez), con fechas, límites de uso y opciones especiales.
-- Se aplican antes de pagar: Mercado Pago cobra el monto con descuento y la comisión de afiliada se calcula sobre lo pagado.
-- Un solo descuento por compra: si la persona ya tiene uno mejor (antigüedad, oferta, afiliada), queda ese.
-- Productos: 'personal' (Edición Personal desde la página), 'plus_annual', 'plus_6' y 'extras' (módulos, packs y actividades).
-- Personal Plus mensual no lleva códigos porque Mercado Pago cobra el mismo monto todos los meses.

create table if not exists public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{3,20}$'),
  kind text not null check (kind in ('percent', 'amount')),
  value numeric not null check (value > 0),
  applies_to text[] not null check (applies_to <@ array['personal', 'plus_annual', 'plus_6', 'extras'] and cardinality(applies_to) > 0),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  max_uses integer check (max_uses is null or max_uses > 0),
  once_per_person boolean not null default true,
  first_purchase_only boolean not null default false,
  only_email text,
  note text,
  batch text,
  active boolean not null default true,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  check (kind <> 'percent' or value <= 90),
  check (expires_at is null or expires_at > starts_at)
);
create index if not exists discount_codes_batch_idx on public.discount_codes (batch);
alter table public.discount_codes enable row level security;
create policy discount_codes_admin_select on public.discount_codes for select using (public.is_admin());
revoke insert, update, delete, truncate on public.discount_codes from anon, authenticated;

create table if not exists public.discount_redemptions (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references public.discount_codes (id),
  purchase_id uuid unique references public.purchases (id),
  personal_order_id uuid unique references public.personal_orders (id),
  user_id uuid references auth.users (id),
  email text,
  amount_off numeric not null check (amount_off > 0),
  created_at timestamptz not null default now(),
  check (purchase_id is not null or personal_order_id is not null)
);
create index if not exists discount_redemptions_code_idx on public.discount_redemptions (code_id);
create index if not exists discount_redemptions_user_idx on public.discount_redemptions (user_id);
alter table public.discount_redemptions enable row level security;
create policy discount_redemptions_admin_select on public.discount_redemptions for select using (public.is_admin());
revoke insert, update, delete, truncate on public.discount_redemptions from anon, authenticated;

-- Un uso cuenta si se pagó, o si el pedido sigue pendiente desde hace menos de un día (así un pedido abandonado no gasta el código).
create or replace function public.discount_redemption_counts(r public.discount_redemptions) returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select coalesce((select p.payment_status = 'approved' or (p.payment_status = 'pending' and r.created_at > now() - interval '1 day')
                     from purchases p where p.id = r.purchase_id), false)
      or coalesce((select o.status in ('approved', 'refunded') or (o.status = 'pending' and r.created_at > now() - interval '1 day')
                     from personal_orders o where o.id = r.personal_order_id), false);
$$;
revoke all on function public.discount_redemption_counts(public.discount_redemptions) from public, anon, authenticated;

-- Por qué un código no sirve (null = sirve). Solo la usan otras funciones de la base y el servidor.
create or replace function public.discount_code_problem(p_code text, p_scope text, p_user uuid, p_email text, p_exclude_purchase uuid default null, p_exclude_order uuid default null)
returns text
language plpgsql stable security definer set search_path to 'public'
as $$
declare
  v discount_codes%rowtype;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_used integer;
begin
  select * into v from discount_codes where code = upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  if v.id is null or not v.active then return 'Ese código de descuento no existe o ya no está activo.'; end if;
  if v.starts_at > now() then return 'Ese código todavía no está vigente: empieza el ' || to_char(v.starts_at at time zone 'America/Argentina/Buenos_Aires', 'DD/MM') || '.'; end if;
  if v.expires_at is not null and v.expires_at <= now() then return 'Ese código de descuento ya venció.'; end if;
  if not (p_scope = any (v.applies_to)) then return 'Ese código no sirve para esta compra.'; end if;
  if v.only_email is not null and v.only_email <> v_email then return 'Ese código es personal y no corresponde a tu email.'; end if;
  if v.max_uses is not null then
    select count(*) into v_used from discount_redemptions r
     where r.code_id = v.id and public.discount_redemption_counts(r)
       and (p_exclude_purchase is null or r.purchase_id is distinct from p_exclude_purchase) and (p_exclude_order is null or r.personal_order_id is distinct from p_exclude_order);
    if v_used >= v.max_uses then return 'Ese código ya se usó todas las veces posibles.'; end if;
  end if;
  if v.once_per_person and exists (
       select 1 from discount_redemptions r
        where r.code_id = v.id and ((p_user is not null and r.user_id = p_user) or (v_email <> '' and r.email = v_email))
          and public.discount_redemption_counts(r)
          and (p_exclude_purchase is null or r.purchase_id is distinct from p_exclude_purchase) and (p_exclude_order is null or r.personal_order_id is distinct from p_exclude_order)) then
    return 'Ya usaste este código.';
  end if;
  if v.first_purchase_only and (
       exists (select 1 from purchases where p_user is not null and user_id = p_user and payment_status = 'approved')
       or exists (select 1 from personal_orders where v_email <> '' and lower(email) = v_email and status = 'approved')
       or exists (select 1 from approved_emails where v_email <> '' and lower(email) = v_email and status = 'approved')) then
    return 'Ese código es solo para la primera compra.';
  end if;
  return null;
end;
$$;
revoke all on function public.discount_code_problem(text, text, uuid, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.discount_code_problem(text, text, uuid, text, uuid, uuid) to service_role;

-- Precio con el código, sin bajar de un 10 % del precio (Mercado Pago no cobra $0).
create or replace function public.discount_code_price(p_code text, p_base numeric) returns numeric
language sql stable security definer set search_path to 'public'
as $$
  select greatest(round(p_base * 0.1),
                  case when d.kind = 'percent' then round(p_base * (100 - d.value) / 100) else round(p_base - d.value) end)
    from discount_codes d where d.code = upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
$$;
revoke all on function public.discount_code_price(text, numeric) from public, anon, authenticated;

-- Para la app (con sesión): ¿sirve este código para este tipo de compra? Devuelve null si sirve, o el motivo.
create or replace function public.check_discount_code(p_code text, p_scope text) returns text
language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if auth.uid() is null then return 'Iniciá sesión.'; end if;
  return public.discount_code_problem(p_code, p_scope, auth.uid(), (select email from profiles where id = auth.uid()));
end;
$$;
revoke all on function public.check_discount_code(text, text) from public, anon;
grant execute on function public.check_discount_code(text, text) to authenticated;

-- ¿El texto es un código de descuento (exista o no esté vigente)? Para distinguirlo de un código de afiliada.
create or replace function public.is_discount_code(p_code text) returns boolean
language sql stable security definer set search_path to 'public'
as $$ select exists (select 1 from discount_codes where code = upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'))); $$;
revoke all on function public.is_discount_code(text) from public, anon;
grant execute on function public.is_discount_code(text) to authenticated, service_role;

-- Aplica el código a un pedido propio pendiente de la app (Plus de 6 o 12 meses, módulos, packs o actividades).
create or replace function public.apply_discount_code(p_purchase_id uuid, p_code text) returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_purchase purchases%rowtype;
  v_sub subscriptions%rowtype;
  v_scope text;
  v_base numeric;
  v_new numeric;
  v_problem text;
  v_code discount_codes%rowtype;
begin
  if v_uid is null then raise exception 'Iniciá sesión.'; end if;
  select * into v_purchase from purchases where id = p_purchase_id and user_id = v_uid and payment_status = 'pending' for update;
  if v_purchase.id is null then raise exception 'No se encontró un pedido pendiente.'; end if;
  if v_purchase.product_type = 'subscription_initial' then
    select * into v_sub from subscriptions where purchase_id = v_purchase.id and status = 'pending' for update;
    if v_sub.id is null or v_sub.upgraded_from_subscription_id is not null then raise exception 'Los códigos no se usan en actualizaciones de plan.'; end if;
    v_scope := case v_sub.duration_months when 12 then 'plus_annual' when 6 then 'plus_6' end;
    if v_scope is null then raise exception 'Personal Plus mensual no lleva códigos de descuento.'; end if;
    v_base := v_sub.price_before_discount;
  elsif v_purchase.product_type in ('module', 'activity') then
    v_scope := 'extras';
    v_base := v_purchase.total;
  else
    raise exception 'Ese código no sirve para esta compra.';
  end if;
  v_problem := public.discount_code_problem(p_code, v_scope, v_uid, (select email from profiles where id = v_uid), v_purchase.id, null);
  if v_problem is not null then raise exception '%', v_problem; end if;
  select * into v_code from discount_codes where code = upper(regexp_replace(p_code, '\s', '', 'g'));
  v_new := public.discount_code_price(v_code.code, v_base);
  if v_new >= v_purchase.total then raise exception 'Ya tenés un descuento igual o mayor en esta compra, así que el código no cambia el precio.'; end if;
  if v_sub.id is not null then
    update subscriptions set final_price = v_new, total_discount_percentage = round(100 * (v_base - v_new) / v_base, 2), updated_at = now() where id = v_sub.id;
  end if;
  update purchases set total = v_new, discount_amount = subtotal - v_new, updated_at = now() where id = v_purchase.id;
  insert into discount_redemptions (code_id, purchase_id, user_id, email, amount_off)
  values (v_code.id, v_purchase.id, v_uid, (select lower(email) from profiles where id = v_uid), v_purchase.total - v_new)
  on conflict (purchase_id) do update set code_id = excluded.code_id, amount_off = discount_redemptions.amount_off + excluded.amount_off, created_at = now();
  return jsonb_build_object('total', v_new, 'code', v_code.code);
end;
$$;
revoke all on function public.apply_discount_code(uuid, text) from public, anon;
grant execute on function public.apply_discount_code(uuid, text) to authenticated;

-- Aplica el código a un pedido de la Edición Personal hecho desde la página (solo el servidor).
create or replace function public.apply_discount_code_to_order(p_order_id uuid, p_code text) returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_order personal_orders%rowtype;
  v_list numeric;
  v_pack numeric;
  v_new numeric;
  v_problem text;
  v_code discount_codes%rowtype;
begin
  select * into v_order from personal_orders where id = p_order_id and status = 'pending' for update;
  if v_order.id is null then raise exception 'No se encontró el pedido.'; end if;
  v_problem := public.discount_code_problem(p_code, 'personal', null, v_order.email, null, v_order.id);
  if v_problem is not null then raise exception '%', v_problem; end if;
  select * into v_code from discount_codes where code = upper(regexp_replace(p_code, '\s', '', 'g'));
  select coalesce(value_numeric, 44900) into v_list from pricing_config where key = 'personal_price_online';
  v_pack := case when v_order.with_pack then coalesce((select value_numeric from pricing_config where key = 'pack_ventas_with_personal'), 7000) else 0 end;
  v_new := public.discount_code_price(v_code.code, v_list);
  if v_new + v_pack >= v_order.total then raise exception 'Ya tenés un descuento igual o mayor, así que el código no cambia el precio.'; end if;
  update personal_orders set total = v_new + v_pack, discount_pct = round(100 * (v_list - v_new) / v_list), updated_at = now() where id = v_order.id;
  insert into discount_redemptions (code_id, personal_order_id, email, amount_off)
  values (v_code.id, v_order.id, lower(v_order.email), v_order.total - v_new - v_pack);
  return jsonb_build_object('total', v_new + v_pack, 'code', v_code.code);
end;
$$;
revoke all on function public.apply_discount_code_to_order(uuid, text) from public, anon, authenticated;
grant execute on function public.apply_discount_code_to_order(uuid, text) to service_role;

-- Administración: crear uno (con el texto elegido) o varios (prefijo + letras al azar, de un solo uso cada uno).
create or replace function public.admin_create_discount_codes(
  p_code text, p_count integer, p_kind text, p_value numeric, p_applies_to text[],
  p_starts_at timestamptz, p_expires_at timestamptz, p_max_uses integer, p_once_per_person boolean,
  p_first_purchase_only boolean, p_only_email text, p_note text
) returns text[]
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_prefix text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_count integer := coalesce(p_count, 1);
  v_batch text;
  v_new text;
  v_out text[] := '{}';
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_tries integer;
  v_email text := nullif(lower(btrim(coalesce(p_only_email, ''))), '');
begin
  if not public.is_admin() then raise exception 'Solo la administración puede hacer esto.'; end if;
  if v_count < 1 or v_count > 200 then raise exception 'Podés crear de 1 a 200 códigos por vez.'; end if;
  if p_kind not in ('percent', 'amount') then raise exception 'Elegí porcentaje o monto fijo.'; end if;
  if p_value is null or p_value <= 0 or (p_kind = 'percent' and p_value > 90) then raise exception 'El descuento tiene que ser de 1 a 90 %% (o un monto mayor a 0).'; end if;
  if p_applies_to is null or cardinality(p_applies_to) = 0 then raise exception 'Elegí al menos un producto.'; end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Revisá el email.'; end if;
  if p_expires_at is not null and p_expires_at <= coalesce(p_starts_at, now()) then raise exception 'La fecha de vencimiento tiene que ser posterior al inicio.'; end if;
  if v_count = 1 then
    if v_prefix !~ '^[A-Z0-9]{3,20}$' then raise exception 'El código tiene que tener de 3 a 20 letras o números, sin espacios.'; end if;
    if exists (select 1 from discount_codes where code = v_prefix) then raise exception 'Ya existe un código %.', v_prefix; end if;
    if exists (select 1 from affiliate_codes where upper(code) = v_prefix) then raise exception 'Ese texto ya es el código de una afiliada. Elegí otro.'; end if;
    insert into discount_codes (code, kind, value, applies_to, starts_at, expires_at, max_uses, once_per_person, first_purchase_only, only_email, note, created_by)
    values (v_prefix, p_kind, p_value, p_applies_to, coalesce(p_starts_at, now()), p_expires_at, p_max_uses, coalesce(p_once_per_person, true),
            coalesce(p_first_purchase_only, false), v_email, nullif(btrim(coalesce(p_note, '')), ''), auth.uid());
    v_out := array[v_prefix];
  else
    if length(v_prefix) > 12 then raise exception 'Para varios códigos, usá un prefijo de hasta 12 letras.'; end if;
    v_batch := coalesce(nullif(v_prefix, ''), 'LOTE') || '-' || to_char(now() at time zone 'America/Argentina/Buenos_Aires', 'YYMMDD-HH24MI');
    for i in 1..v_count loop
      v_tries := 0;
      loop
        v_new := v_prefix || (select string_agg(substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1), '') from generate_series(1, 6));
        exit when not exists (select 1 from discount_codes where code = v_new) and not exists (select 1 from affiliate_codes where upper(code) = v_new);
        v_tries := v_tries + 1;
        if v_tries > 20 then raise exception 'No se pudieron generar códigos únicos. Probá con otro prefijo.'; end if;
      end loop;
      insert into discount_codes (code, kind, value, applies_to, starts_at, expires_at, max_uses, once_per_person, first_purchase_only, only_email, note, batch, created_by)
      values (v_new, p_kind, p_value, p_applies_to, coalesce(p_starts_at, now()), p_expires_at, coalesce(p_max_uses, 1), true,
              coalesce(p_first_purchase_only, false), v_email, nullif(btrim(coalesce(p_note, '')), ''), v_batch, auth.uid());
      v_out := v_out || v_new;
    end loop;
  end if;
  perform public.log_audit('discount_codes.create', 'discount_codes', null, null,
    jsonb_build_object('count', v_count, 'first', v_out[1], 'kind', p_kind, 'value', p_value, 'applies_to', p_applies_to, 'expires_at', p_expires_at));
  return v_out;
end;
$$;
revoke all on function public.admin_create_discount_codes(text, integer, text, numeric, text[], timestamptz, timestamptz, integer, boolean, boolean, text, text) from public, anon;
grant execute on function public.admin_create_discount_codes(text, integer, text, numeric, text[], timestamptz, timestamptz, integer, boolean, boolean, text, text) to authenticated;

-- Pausar o reactivar un código o un lote entero. Los códigos no se borran (queda el historial de usos).
create or replace function public.admin_set_discount_code_active(p_id uuid, p_batch text, p_active boolean) returns integer
language plpgsql security definer set search_path to 'public'
as $$
declare v_n integer;
begin
  if not public.is_admin() then raise exception 'Solo la administración puede hacer esto.'; end if;
  update discount_codes set active = coalesce(p_active, false)
   where (p_id is not null and id = p_id) or (p_id is null and p_batch is not null and batch = p_batch);
  get diagnostics v_n = row_count;
  perform public.log_audit('discount_codes.active', 'discount_codes', p_id, null, jsonb_build_object('batch', p_batch, 'active', p_active, 'rows', v_n));
  return v_n;
end;
$$;
revoke all on function public.admin_set_discount_code_active(uuid, text, boolean) from public, anon;
grant execute on function public.admin_set_discount_code_active(uuid, text, boolean) to authenticated;

-- Listado para la administración con usos y total descontado.
create or replace function public.admin_discount_codes() returns table (
  id uuid, code text, kind text, value numeric, applies_to text[], starts_at timestamptz, expires_at timestamptz,
  max_uses integer, once_per_person boolean, first_purchase_only boolean, only_email text, note text, batch text,
  active boolean, created_at timestamptz, uses bigint, paid_uses bigint, amount_off numeric
)
language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if not public.is_admin() then raise exception 'Solo la administración puede hacer esto.'; end if;
  return query
  select d.id, d.code, d.kind, d.value, d.applies_to, d.starts_at, d.expires_at, d.max_uses, d.once_per_person, d.first_purchase_only,
         d.only_email, d.note, d.batch, d.active, d.created_at,
         count(r.id) filter (where public.discount_redemption_counts(r)),
         count(r.id) filter (where exists (select 1 from purchases p where p.id = r.purchase_id and p.payment_status = 'approved')
                                or exists (select 1 from personal_orders o where o.id = r.personal_order_id and o.status = 'approved')),
         coalesce(sum(r.amount_off) filter (where exists (select 1 from purchases p where p.id = r.purchase_id and p.payment_status = 'approved')
                                or exists (select 1 from personal_orders o where o.id = r.personal_order_id and o.status = 'approved')), 0)
    from discount_codes d left join discount_redemptions r on r.code_id = d.id
   group by d.id
   order by d.created_at desc
   limit 500;
end;
$$;
revoke all on function public.admin_discount_codes() from public, anon;
grant execute on function public.admin_discount_codes() to authenticated;
