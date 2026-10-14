-- Avisos dirigidos a cuentas puntuales y avisos automáticos (con descuentos personales).

-- 1) Avisos para cuentas específicas (por email).
alter table public.announcements add column if not exists target_users uuid[] not null default '{}';
alter table public.announcements drop constraint if exists announcements_audience_check;
alter table public.announcements add constraint announcements_audience_check check (audience in ('all', 'free', 'licensed', 'plus', 'users'));

alter policy announcements_select on public.announcements
  using ((active and starts_at <= now() and (ends_at is null or ends_at > now())
          and (audience <> 'users' or (select auth.uid()) = any (target_users)))
         or public.is_admin());

-- Igual que admin_save_announcement, más los emails de las cuentas destino (nombre nuevo para no borrar la anterior).
create or replace function public.admin_save_announcement_v2(
  p_id uuid, p_kind text, p_title text, p_body text, p_image text, p_keep_image boolean,
  p_button_label text, p_button_link text, p_audience text, p_starts_at timestamptz, p_ends_at timestamptz, p_active boolean,
  p_target_emails text
) returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_id uuid;
  v_emails text[];
  v_users uuid[] := '{}';
  v_missing text[] := '{}';
begin
  if not public.is_admin() then raise exception 'Solo la administración puede hacer esto.'; end if;
  if p_audience = 'users' then
    select array_agg(distinct e) into v_emails
      from unnest(regexp_split_to_array(lower(coalesce(p_target_emails, '')), '[\s,;]+')) e where e ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$';
    if v_emails is null then raise exception 'Escribí al menos un email para el aviso dirigido.'; end if;
    if array_length(v_emails, 1) > 500 then raise exception 'Hasta 500 emails por aviso.'; end if;
    select coalesce(array_agg(p.id), '{}') into v_users from profiles p where lower(p.email) = any (v_emails);
    select coalesce(array_agg(e), '{}') into v_missing from unnest(v_emails) e where not exists (select 1 from profiles p where lower(p.email) = e);
    if array_length(v_users, 1) is null then raise exception 'Ninguno de esos emails tiene cuenta en la app.'; end if;
  end if;
  v_id := public.admin_save_announcement(p_id, p_kind, p_title, p_body, p_image, p_keep_image, p_button_label, p_button_link,
                                         p_audience, p_starts_at, p_ends_at, p_active);
  update announcements set target_users = v_users where id = v_id;
  return jsonb_build_object('id', v_id, 'targets', coalesce(array_length(v_users, 1), 0), 'missing', to_jsonb(v_missing));
end;
$$;
revoke all on function public.admin_save_announcement_v2(uuid, text, text, text, text, boolean, text, text, text, timestamptz, timestamptz, boolean, text) from public, anon;
grant execute on function public.admin_save_announcement_v2(uuid, text, text, text, text, boolean, text, text, text, timestamptz, timestamptz, boolean, text) to authenticated;

-- 2) Avisos automáticos: reglas que la app revisa sola cuando alguien la abre.
create table if not exists public.auto_notices (
  code text primary key,
  sort integer not null default 0,
  active boolean not null default false,
  kind text not null default 'novedad' check (kind in ('novedad', 'cambio', 'promocion', 'aviso')),
  title text not null check (char_length(title) between 2 and 100),
  body text not null check (char_length(body) between 1 and 1500),
  button_label text check (button_label is null or char_length(button_label) <= 40),
  button_link text check (button_link is null or ((button_link ~ '^/[^/]' or button_link ~ '^https://') and char_length(button_link) <= 500)),
  days integer not null default 14 check (days between 0 and 3650),
  discount_pct integer not null default 0 check (discount_pct between 0 and 90),
  offer_days integer not null default 7 check (offer_days between 1 and 90),
  repeat_days integer not null default 0 check (repeat_days between 0 and 3650),
  updated_at timestamptz not null default now()
);
alter table public.auto_notices enable row level security;
create policy auto_notices_select on public.auto_notices for select to authenticated using (public.is_admin());
revoke insert, update, delete, truncate on public.auto_notices from anon, authenticated;

insert into public.auto_notices (code, sort, kind, title, body, button_label, button_link, days, discount_pct, offer_days, repeat_days) values
  ('free_discount', 10, 'promocion', '¡Un regalo para vos!', 'Hace {dias} días que usás la versión gratis. Te damos un {descuento} % de descuento en la Edición Personal, solo hasta el {vence}.', 'Aprovechar el descuento', '/comprar', 14, 20, 7, 0),
  ('free_limit', 20, 'aviso', 'Llegaste al límite de la versión gratis', 'Ya cargaste todo lo que entra en la versión gratis. Con la Edición Personal guardás hasta 100 materiales, 50 productos, 30 fórmulas y 30 moldes, con un solo pago.', 'Ver la Edición Personal', '/comprar', 0, 0, 7, 30),
  ('courtesy_ending', 30, 'aviso', 'Tu licencia de regalo está por vencer', 'Tu Edición Personal de regalo vence el {fin}. Para seguir usándola, comprala con un {descuento} % de descuento hasta el {vence}.', 'Comprar con descuento', '/comprar', 5, 15, 10, 0),
  ('plus_ending', 40, 'aviso', 'Tu Mensualidad Plus está por terminar', 'Tu Mensualidad Plus termina el {fin}. Renovala para no perder las actividades, el pack y los módulos del taller.', 'Renovar', '/access', 5, 0, 7, 25),
  ('pack_suggest', 50, 'novedad', '¿Ya vendés lo que hacés?', 'Ya hiciste {calculos} cálculos. Con el Pack Ventas y Stock anotás ventas y stock y ves cuánto ganás cada mes.', 'Ver el pack', '/access', 10, 0, 7, 0),
  ('welcome_back', 60, 'novedad', '¡Qué bueno verte de nuevo!', 'Hace {dias} días que no entrabas. Mirá lo nuevo: Comunidad con consejos y tutoriales, presupuestos y listas para ferias para imprimir, y fechas para vender.', 'Ver novedades', '/novedades', 30, 0, 7, 30),
  ('anniversary', 70, 'novedad', '¡Cumplimos un año juntas!', 'Hace un año que usás Calculadora Emprender. ¡Gracias por elegirnos!', null, null, 365, 0, 7, 365)
on conflict (code) do nothing;

-- Registro de qué aviso automático vio cada cuenta (para no repetirlo).
create table if not exists public.auto_notice_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null references public.auto_notices(code) on delete cascade,
  shown_at timestamptz not null default now(),
  times integer not null default 1,
  primary key (user_id, code)
);
alter table public.auto_notice_log enable row level security;
create policy auto_notice_log_select on public.auto_notice_log for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
revoke insert, update, delete, truncate on public.auto_notice_log from anon, authenticated;

-- Último ingreso a la app (para «qué bueno verte de nuevo»).
create table if not exists public.user_last_open (
  user_id uuid primary key references auth.users(id) on delete cascade,
  opened_at timestamptz not null default now()
);
alter table public.user_last_open enable row level security;
create policy user_last_open_select on public.user_last_open for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
revoke insert, update, delete, truncate on public.user_last_open from anon, authenticated;

-- Descuentos personales (los crea un aviso automático). Se aplican solos al comprar con ese email.
create table if not exists public.user_offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null,
  discount_pct integer not null check (discount_pct between 1 and 90),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists user_offers_user_idx on public.user_offers (user_id, expires_at desc);
alter table public.user_offers enable row level security;
create policy user_offers_select on public.user_offers for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
revoke insert, update, delete, truncate on public.user_offers from anon, authenticated;

alter table public.personal_orders add column if not exists discount_pct integer not null default 0;

create or replace function public.admin_save_auto_notice(
  p_code text, p_active boolean, p_kind text, p_title text, p_body text, p_button_label text, p_button_link text,
  p_days integer, p_discount_pct integer, p_offer_days integer, p_repeat_days integer
) returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.is_admin() then raise exception 'Solo la administración puede hacer esto.'; end if;
  update auto_notices set active = p_active, kind = p_kind, title = trim(p_title), body = trim(p_body),
         button_label = nullif(trim(p_button_label), ''), button_link = nullif(trim(p_button_link), ''),
         days = p_days, discount_pct = p_discount_pct, offer_days = p_offer_days, repeat_days = p_repeat_days, updated_at = now()
   where code = p_code;
  if not found then raise exception 'No se encontró el aviso automático.'; end if;
  perform public.log_audit('auto_notice.save', 'auto_notice', null, null, jsonb_build_object('code', p_code, 'active', p_active, 'discount', p_discount_pct));
end;
$$;
revoke all on function public.admin_save_auto_notice(text, boolean, text, text, text, text, text, integer, integer, integer, integer) from public, anon;
grant execute on function public.admin_save_auto_notice(text, boolean, text, text, text, text, text, integer, integer, integer, integer) to authenticated;

-- Descuento personal vigente de la cuenta (el mayor).
create or replace function public.my_offer() returns table (discount_pct integer, expires_at timestamptz)
language sql stable security definer set search_path to 'public'
as $$
  select o.discount_pct, o.expires_at from user_offers o where o.user_id = auth.uid() and o.expires_at > now()
   order by o.discount_pct desc, o.expires_at desc limit 1;
$$;
revoke all on function public.my_offer() from public, anon;
grant execute on function public.my_offer() to authenticated;

-- Revisa las reglas para quien abre la app y devuelve, como mucho, un aviso (y lo anota para no repetirlo).
create or replace function public.my_auto_notice() returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_profile profiles%rowtype;
  v_prev_open timestamptz;
  v_license record;
  v_has_license boolean;
  v_plus_end timestamptz;
  v_rule auto_notices%rowtype;
  v_hit boolean;
  v_vars jsonb;
  v_offer_end timestamptz;
  v_count integer;
begin
  if v_uid is null then return null; end if;
  select * into v_profile from profiles where id = v_uid;
  if v_profile.id is null or v_profile.account_status <> 'active' then return null; end if;

  select opened_at into v_prev_open from user_last_open where user_id = v_uid;
  insert into user_last_open (user_id, opened_at) values (v_uid, now())
  on conflict (user_id) do update set opened_at = now() where user_last_open.opened_at < now() - interval '10 minutes';

  -- El equipo y las cuentas de prueba no reciben avisos automáticos.
  if v_profile.role in ('admin', 'moderator') or v_profile.is_tester then return null; end if;

  select l.expires_at, l.dev_grant_id into v_license from licenses l join plans p on p.id = l.plan_id
   where l.user_id = v_uid and l.status = 'active' and p.code in ('BASIC', 'ADVANCED') and (l.expires_at is null or l.expires_at > now())
   order by l.expires_at nulls first limit 1;
  v_has_license := found;
  select max(s.expires_at) into v_plus_end from subscriptions s where s.user_id = v_uid and s.status = 'active' and s.expires_at > now();

  for v_rule in select * from auto_notices where active order by sort loop
    -- ¿Ya se mostró? Solo se repite si la regla lo permite y pasó ese tiempo.
    continue when exists (select 1 from auto_notice_log g where g.user_id = v_uid and g.code = v_rule.code
                          and (v_rule.repeat_days = 0 or g.shown_at > now() - make_interval(days => v_rule.repeat_days)));
    v_hit := false;
    v_vars := jsonb_build_object('dias', v_rule.days);

    if v_rule.code = 'free_discount' then
      v_hit := not v_has_license and v_profile.created_at <= now() - make_interval(days => v_rule.days);
      v_vars := jsonb_build_object('dias', floor(extract(epoch from now() - v_profile.created_at) / 86400)::int);
    elsif v_rule.code = 'free_limit' then
      if not v_has_license then
        select count(*) into v_count from materials where user_id = v_uid and status <> 'archived';
        v_hit := v_count >= coalesce((select pl.limit_value from plan_limits pl join plans p on p.id = pl.plan_id where p.code = 'FREE' and pl.resource = 'materials'), 5);
        if not v_hit then
          select count(*) into v_count from products where user_id = v_uid and status <> 'archived';
          v_hit := v_count >= coalesce((select pl.limit_value from plan_limits pl join plans p on p.id = pl.plan_id where p.code = 'FREE' and pl.resource = 'products'), 2);
        end if;
      end if;
    elsif v_rule.code = 'courtesy_ending' then
      v_hit := v_has_license and v_license.dev_grant_id is not null and v_license.expires_at is not null
               and v_license.expires_at <= now() + make_interval(days => v_rule.days);
      if v_hit then v_vars := jsonb_build_object('fin', to_char(v_license.expires_at at time zone 'America/Argentina/Buenos_Aires', 'DD/MM')); end if;
    elsif v_rule.code = 'plus_ending' then
      v_hit := v_plus_end is not null and v_plus_end <= now() + make_interval(days => v_rule.days)
               and not exists (select 1 from subscriptions s where s.user_id = v_uid and s.status = 'active' and s.auto_renew);
      if v_hit then v_vars := jsonb_build_object('fin', to_char(v_plus_end at time zone 'America/Argentina/Buenos_Aires', 'DD/MM')); end if;
    elsif v_rule.code = 'pack_suggest' then
      if v_has_license and v_plus_end is null and not public.has_module('PACK_VENTAS') then
        select count(*) into v_count from calculations where user_id = v_uid;
        v_hit := v_count >= greatest(v_rule.days, 1);
        v_vars := jsonb_build_object('calculos', v_count);
      end if;
    elsif v_rule.code = 'welcome_back' then
      v_hit := v_prev_open is not null and v_prev_open <= now() - make_interval(days => v_rule.days);
      if v_hit then v_vars := jsonb_build_object('dias', floor(extract(epoch from now() - v_prev_open) / 86400)::int); end if;
    elsif v_rule.code = 'anniversary' then
      v_hit := v_profile.created_at <= now() - make_interval(days => greatest(v_rule.days, 1));
    end if;
    continue when not v_hit;

    -- Descuento personal (si la regla lo da y la persona todavía puede comprar).
    v_offer_end := null;
    if v_rule.discount_pct > 0 and v_rule.code in ('free_discount', 'courtesy_ending') then
      v_offer_end := now() + make_interval(days => v_rule.offer_days);
      insert into user_offers (user_id, source, discount_pct, expires_at) values (v_uid, v_rule.code, v_rule.discount_pct, v_offer_end);
      v_vars := v_vars || jsonb_build_object('descuento', v_rule.discount_pct, 'vence', to_char(v_offer_end at time zone 'America/Argentina/Buenos_Aires', 'DD/MM'));
    end if;

    insert into auto_notice_log (user_id, code) values (v_uid, v_rule.code)
    on conflict (user_id, code) do update set shown_at = now(), times = auto_notice_log.times + 1;

    return jsonb_build_object('code', v_rule.code, 'kind', v_rule.kind, 'title', v_rule.title, 'body', v_rule.body,
                              'button_label', v_rule.button_label, 'button_link', v_rule.button_link, 'vars', v_vars);
  end loop;
  return null;
end;
$$;
revoke all on function public.my_auto_notice() from public, anon;
grant execute on function public.my_auto_notice() to authenticated;

-- Compra online: aplica el descuento personal vigente de la cuenta con ese email (solo a la Edición Personal).
create or replace function public.create_personal_order_v2(p_email text, p_full_name text, p_with_pack boolean)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_price numeric;
  v_pack numeric := 0;
  v_pct integer := 0;
  v_id uuid;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Revisá el email.'; end if;
  if exists (select 1 from approved_emails where lower(email) = v_email and status = 'approved') then
    raise exception 'Ese email ya tiene la Edición Personal. Entrá con tu email.';
  end if;
  if (select count(*) from personal_orders where lower(email) = v_email and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Hiciste muchos pedidos hoy. Si tenés un problema, escribinos.';
  end if;
  select value_numeric into v_price from pricing_config where key = 'personal_price_online';
  v_price := coalesce(v_price, 44900);
  select coalesce(max(o.discount_pct), 0) into v_pct from user_offers o join profiles p on p.id = o.user_id
   where lower(p.email) = v_email and o.expires_at > now();
  if v_pct > 0 then v_price := round(v_price * (100 - v_pct) / 100); end if;
  if coalesce(p_with_pack, false) then
    select coalesce((select value_numeric from pricing_config where key = 'pack_ventas_with_personal'), 7000) into v_pack;
  end if;
  insert into personal_orders (email, full_name, total, with_pack, discount_pct)
  values (v_email, nullif(left(btrim(coalesce(p_full_name, '')), 120), ''), v_price + v_pack, coalesce(p_with_pack, false), v_pct)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'total', v_price + v_pack, 'discount_pct', v_pct);
end;
$$;
