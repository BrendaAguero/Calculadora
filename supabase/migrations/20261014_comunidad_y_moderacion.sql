-- Moderadoras y Comunidad (consejos, tutoriales, preguntas y trabajos).
-- La moderación solo modera: oculta o vuelve a mostrar publicaciones y comentarios, revisa denuncias,
-- destaca y silencia a alguien en la comunidad por unos días. Todo lo demás sigue siendo solo de administración.

-- 1) Rol «moderadora».
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role = any (array['user', 'admin', 'moderator']));

create or replace function public.is_moderator() returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'moderator') and account_status = 'active');
$$;
revoke all on function public.is_moderator() from public, anon;
grant execute on function public.is_moderator() to authenticated;

-- Solo la administración nombra o saca moderadoras (nunca toca a otra administradora ni a sí misma).
create or replace function public.admin_set_moderator(p_email text, p_moderator boolean) returns void
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_user uuid;
  v_role text;
begin
  if not public.is_admin() then raise exception 'Solo la administración puede hacer esto.'; end if;
  select id, role into v_user, v_role from profiles where lower(email) = lower(trim(p_email));
  if v_user is null then raise exception 'No hay ninguna cuenta con ese email. La persona primero tiene que entrar a la app una vez.'; end if;
  if v_role = 'admin' then raise exception 'Esa cuenta es de administración.'; end if;
  update profiles set role = case when p_moderator then 'moderator' else 'user' end where id = v_user;
  perform public.log_audit(case when p_moderator then 'staff.moderator_add' else 'staff.moderator_remove' end, 'profile', v_user, jsonb_build_object('role', v_role), jsonb_build_object('moderator', p_moderator));
end;
$$;
revoke all on function public.admin_set_moderator(text, boolean) from public, anon;
grant execute on function public.admin_set_moderator(text, boolean) to authenticated;

-- 2) Comunidad.
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 60),
  official boolean not null default false,
  category text not null check (category in ('consejo', 'tutorial', 'pregunta', 'trabajo')),
  title text not null check (char_length(title) between 3 and 120),
  body text not null check (char_length(body) between 1 and 5000),
  link text check (link is null or (link ~ '^https://' and char_length(link) <= 500)),
  photo text check (photo is null or (photo ~ '^data:image/(jpeg|png|webp);base64,' and char_length(photo) <= 300000)),
  status text not null default 'published' check (status in ('published', 'hidden')),
  hidden_reason text check (hidden_reason is null or char_length(hidden_reason) <= 300),
  pinned boolean not null default false,
  comment_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists community_posts_list_idx on public.community_posts (status, pinned desc, created_at desc);
create index if not exists community_posts_user_idx on public.community_posts (user_id);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 60),
  official boolean not null default false,
  body text not null check (char_length(body) between 1 and 2000),
  status text not null default 'published' check (status in ('published', 'hidden')),
  created_at timestamptz not null default now()
);
create index if not exists community_comments_post_idx on public.community_comments (post_id, created_at);
create index if not exists community_comments_user_idx on public.community_comments (user_id);

create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.community_posts(id) on delete cascade,
  comment_id uuid references public.community_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 300),
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((post_id is null) <> (comment_id is null))
);
create index if not exists community_reports_open_idx on public.community_reports (status, created_at desc);
create unique index if not exists community_reports_once_post on public.community_reports (user_id, post_id) where post_id is not null;
create unique index if not exists community_reports_once_comment on public.community_reports (user_id, comment_id) where comment_id is not null;

create table if not exists public.community_mutes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  until timestamptz not null,
  reason text check (reason is null or char_length(reason) <= 300),
  muted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_reports enable row level security;
alter table public.community_mutes enable row level security;

-- Lectura: todas las cuentas ven lo publicado; cada una ve lo suyo aunque esté oculto; la moderación ve todo.
create policy community_posts_select on public.community_posts for select to authenticated
  using (status = 'published' or user_id = (select auth.uid()) or public.is_moderator());
create policy community_comments_select on public.community_comments for select to authenticated
  using ((status = 'published' and exists (select 1 from community_posts p where p.id = post_id and p.status = 'published'))
         or user_id = (select auth.uid()) or public.is_moderator());
create policy community_reports_select on public.community_reports for select to authenticated
  using (user_id = (select auth.uid()) or public.is_moderator());
create policy community_mutes_select on public.community_mutes for select to authenticated
  using (user_id = (select auth.uid()) or public.is_moderator());
-- Las escrituras pasan solo por las funciones de abajo (controlan límites, silencios y dejan registro).
revoke insert, update, delete, truncate on public.community_posts, public.community_comments, public.community_reports, public.community_mutes from anon, authenticated;

-- Nombre que se muestra: el de su perfil (nunca el email) y si es del equipo.
create or replace function public.community_author() returns table (name text, official boolean)
language sql stable security definer set search_path to 'public'
as $$
  select left(coalesce(nullif(trim(full_name), ''), 'Emprendedora'), 60), role in ('admin', 'moderator')
    from profiles where id = auth.uid() and account_status = 'active';
$$;
revoke all on function public.community_author() from public, anon, authenticated;

create or replace function public.community_can_write() returns void
language plpgsql stable security definer set search_path to 'public'
as $$
declare v_until timestamptz;
begin
  if auth.uid() is null then raise exception 'Iniciá sesión.'; end if;
  select until into v_until from community_mutes where user_id = auth.uid() and until > now();
  if v_until is not null then
    raise exception 'La moderación pausó tus publicaciones hasta el %.', to_char(v_until at time zone 'America/Argentina/Buenos_Aires', 'DD/MM HH24:MI');
  end if;
end;
$$;
revoke all on function public.community_can_write() from public, anon, authenticated;

create or replace function public.community_create_post(p_category text, p_title text, p_body text, p_link text, p_photo text) returns uuid
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_author record;
  v_id uuid;
begin
  perform public.community_can_write();
  select * into v_author from public.community_author();
  if v_author is null then raise exception 'Tu cuenta no está activa.'; end if;
  if not v_author.official and (select count(*) from community_posts where user_id = auth.uid() and created_at > now() - interval '1 day') >= 5 then
    raise exception 'Llegaste a 5 publicaciones por día. Probá mañana.';
  end if;
  -- Los tutoriales «oficiales» son del equipo; el resto los publica como consejo.
  insert into community_posts (user_id, author_name, official, category, title, body, link, photo)
  values (auth.uid(), v_author.name, v_author.official,
          case when p_category = 'tutorial' and not v_author.official then 'consejo' else p_category end,
          trim(p_title), trim(p_body), nullif(trim(p_link), ''), nullif(p_photo, ''))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.community_update_post(p_post_id uuid, p_title text, p_body text, p_link text) returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  perform public.community_can_write();
  update community_posts set title = trim(p_title), body = trim(p_body), link = nullif(trim(p_link), ''), updated_at = now()
   where id = p_post_id and user_id = auth.uid();
  if not found then raise exception 'No se encontró la publicación.'; end if;
end;
$$;

-- Cada persona puede borrar lo suyo (la moderación no borra: oculta).
create or replace function public.community_delete_own(p_post_id uuid, p_comment_id uuid) returns void
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_post uuid;
  v_rows integer;
begin
  if auth.uid() is null then raise exception 'Iniciá sesión.'; end if;
  if p_post_id is not null then
    delete from community_posts where id = p_post_id and user_id = auth.uid();
    get diagnostics v_rows = row_count;
  else
    delete from community_comments where id = p_comment_id and user_id = auth.uid() returning post_id into v_post;
    get diagnostics v_rows = row_count;
    if v_post is not null then
      update community_posts set comment_count = (select count(*) from community_comments where post_id = v_post and status = 'published') where id = v_post;
    end if;
  end if;
  if v_rows = 0 then raise exception 'No se encontró.'; end if;
end;
$$;

create or replace function public.community_add_comment(p_post_id uuid, p_body text) returns uuid
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_author record;
  v_id uuid;
begin
  perform public.community_can_write();
  select * into v_author from public.community_author();
  if v_author is null then raise exception 'Tu cuenta no está activa.'; end if;
  if not exists (select 1 from community_posts where id = p_post_id and status = 'published') then raise exception 'La publicación ya no está disponible.'; end if;
  if not v_author.official and (select count(*) from community_comments where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Escribiste muchos comentarios seguidos. Esperá un rato.';
  end if;
  insert into community_comments (post_id, user_id, author_name, official, body)
  values (p_post_id, auth.uid(), v_author.name, v_author.official, trim(p_body))
  returning id into v_id;
  update community_posts set comment_count = comment_count + 1 where id = p_post_id;
  return v_id;
end;
$$;

create or replace function public.community_report(p_post_id uuid, p_comment_id uuid, p_reason text) returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  if auth.uid() is null then raise exception 'Iniciá sesión.'; end if;
  if (select count(*) from community_reports where user_id = auth.uid() and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Ya mandaste muchas denuncias hoy. Gracias, la moderación las está revisando.';
  end if;
  insert into community_reports (post_id, comment_id, user_id, reason)
  values (p_post_id, case when p_post_id is null then p_comment_id end, auth.uid(), left(coalesce(nullif(trim(p_reason), ''), 'Sin motivo'), 300))
  on conflict do nothing;
end;
$$;

-- 3) Herramientas de moderación (moderadoras y administración). Cada una deja registro en la auditoría.
create or replace function public.mod_set_post(p_post_id uuid, p_status text, p_pinned boolean, p_reason text) returns void
language plpgsql security definer set search_path to 'public'
as $$
declare v_old record;
begin
  if not public.is_moderator() then raise exception 'Solo la moderación puede hacer esto.'; end if;
  if p_status not in ('published', 'hidden') then raise exception 'Estado inválido.'; end if;
  select status, pinned into v_old from community_posts where id = p_post_id;
  if v_old is null then raise exception 'No se encontró la publicación.'; end if;
  update community_posts set status = p_status, pinned = coalesce(p_pinned, pinned),
         hidden_reason = case when p_status = 'hidden' then left(nullif(trim(p_reason), ''), 300) end
   where id = p_post_id;
  update community_reports set status = 'resolved', resolved_by = auth.uid() where post_id = p_post_id and status = 'open';
  perform public.log_audit('community.post', 'community_post', p_post_id, to_jsonb(v_old), jsonb_build_object('status', p_status, 'pinned', p_pinned, 'reason', p_reason));
end;
$$;

create or replace function public.mod_set_comment(p_comment_id uuid, p_status text) returns void
language plpgsql security definer set search_path to 'public'
as $$
declare v_post uuid;
begin
  if not public.is_moderator() then raise exception 'Solo la moderación puede hacer esto.'; end if;
  if p_status not in ('published', 'hidden') then raise exception 'Estado inválido.'; end if;
  update community_comments set status = p_status where id = p_comment_id returning post_id into v_post;
  if v_post is null then raise exception 'No se encontró el comentario.'; end if;
  update community_posts set comment_count = (select count(*) from community_comments where post_id = v_post and status = 'published') where id = v_post;
  update community_reports set status = 'resolved', resolved_by = auth.uid() where comment_id = p_comment_id and status = 'open';
  perform public.log_audit('community.comment', 'community_comment', p_comment_id, null, jsonb_build_object('status', p_status));
end;
$$;

create or replace function public.mod_resolve_report(p_report_id uuid) returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.is_moderator() then raise exception 'Solo la moderación puede hacer esto.'; end if;
  update community_reports set status = 'resolved', resolved_by = auth.uid() where id = p_report_id;
  perform public.log_audit('community.report_resolve', 'community_report', p_report_id, null, null);
end;
$$;

-- Silenciar en la comunidad (1 a 30 días; 0 = levantar). No toca la cuenta ni sus datos, y no se aplica al equipo.
create or replace function public.mod_mute_user(p_user_id uuid, p_days integer, p_reason text) returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.is_moderator() then raise exception 'Solo la moderación puede hacer esto.'; end if;
  if p_days is null or p_days < 0 or p_days > 30 then raise exception 'Elegí entre 1 y 30 días.'; end if;
  if exists (select 1 from profiles where id = p_user_id and role in ('admin', 'moderator')) then raise exception 'No se puede silenciar a alguien del equipo.'; end if;
  if p_days = 0 then
    delete from community_mutes where user_id = p_user_id;
  else
    insert into community_mutes (user_id, until, reason, muted_by) values (p_user_id, now() + make_interval(days => p_days), left(nullif(trim(p_reason), ''), 300), auth.uid())
    on conflict (user_id) do update set until = excluded.until, reason = excluded.reason, muted_by = excluded.muted_by, created_at = now();
  end if;
  perform public.log_audit('community.mute', 'profile', p_user_id, null, jsonb_build_object('days', p_days, 'reason', p_reason));
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'community_create_post(text, text, text, text, text)', 'community_update_post(uuid, text, text, text)', 'community_delete_own(uuid, uuid)',
    'community_add_comment(uuid, text)', 'community_report(uuid, uuid, text)', 'mod_set_post(uuid, text, boolean, text)',
    'mod_set_comment(uuid, text)', 'mod_resolve_report(uuid)', 'mod_mute_user(uuid, integer, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- La lista no trae la foto (pesa): solo si tiene.
alter table public.community_posts add column if not exists has_photo boolean generated always as (photo is not null) stored;
