-- 1) Comunidad como microblog: solo publica el equipo (administración y moderadoras); el resto lee.
create or replace function public.community_create_post(p_category text, p_title text, p_body text, p_link text, p_photo text) returns uuid
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_author record;
  v_id uuid;
begin
  if not public.is_moderator() then raise exception 'Solo el equipo publica en la Comunidad.'; end if;
  select * into v_author from public.community_author();
  if v_author is null then raise exception 'Tu cuenta no está activa.'; end if;
  insert into community_posts (user_id, author_name, official, category, title, body, link, photo)
  values (auth.uid(), v_author.name, true, p_category, trim(p_title), trim(p_body), nullif(trim(p_link), ''), nullif(p_photo, ''))
  returning id into v_id;
  perform public.log_audit('community.publish', 'community_post', v_id, null, jsonb_build_object('title', p_title));
  return v_id;
end;
$$;

-- Editar: la autora, o la administración (las moderadoras solo lo suyo). Puede cambiar la foto.
create or replace function public.community_edit_post(p_post_id uuid, p_category text, p_title text, p_body text, p_link text, p_photo text, p_keep_photo boolean) returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.is_moderator() then raise exception 'Solo el equipo edita la Comunidad.'; end if;
  update community_posts
     set category = p_category, title = trim(p_title), body = trim(p_body), link = nullif(trim(p_link), ''),
         photo = case when p_keep_photo then photo else nullif(p_photo, '') end, updated_at = now()
   where id = p_post_id and (user_id = auth.uid() or public.is_admin());
  if not found then raise exception 'No se encontró la publicación (o no es tuya).'; end if;
  perform public.log_audit('community.edit', 'community_post', p_post_id, null, jsonb_build_object('title', p_title));
end;
$$;
revoke all on function public.community_edit_post(uuid, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.community_edit_post(uuid, text, text, text, text, text, boolean) to authenticated;

-- Sin comentarios de las usuarias (la Comunidad es para leer).
create or replace function public.community_add_comment(p_post_id uuid, p_body text) returns uuid
language plpgsql security definer set search_path to 'public'
as $$
begin
  raise exception 'La Comunidad no tiene comentarios.';
end;
$$;

-- 2) Avisos emergentes (novedades, cambios, promociones…), configurables desde administración.
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'novedad' check (kind in ('novedad', 'cambio', 'promocion', 'aviso')),
  title text not null check (char_length(title) between 2 and 100),
  body text not null check (char_length(body) between 1 and 1500),
  image text check (image is null or (image ~ '^data:image/(jpeg|png|webp);base64,' and char_length(image) <= 300000)),
  button_label text check (button_label is null or char_length(button_label) <= 40),
  button_link text check (button_link is null or ((button_link ~ '^/[^/]' or button_link ~ '^https://') and char_length(button_link) <= 500)),
  audience text not null default 'all' check (audience in ('all', 'free', 'licensed', 'plus')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists announcements_live_idx on public.announcements (active, starts_at desc);

create table if not exists public.announcement_reads (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);
create index if not exists announcement_reads_user_idx on public.announcement_reads (user_id);

alter table public.announcements enable row level security;
alter table public.announcement_reads enable row level security;

create policy announcements_select on public.announcements for select to authenticated
  using ((active and starts_at <= now() and (ends_at is null or ends_at > now())) or public.is_admin());
revoke insert, update, delete, truncate on public.announcements from anon, authenticated;

create policy announcement_reads_select on public.announcement_reads for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
create policy announcement_reads_insert on public.announcement_reads for insert to authenticated
  with check (user_id = (select auth.uid()));
revoke update, delete, truncate on public.announcement_reads from anon, authenticated;

create or replace function public.admin_save_announcement(
  p_id uuid, p_kind text, p_title text, p_body text, p_image text, p_keep_image boolean,
  p_button_label text, p_button_link text, p_audience text, p_starts_at timestamptz, p_ends_at timestamptz, p_active boolean
) returns uuid
language plpgsql security definer set search_path to 'public'
as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'Solo la administración puede hacer esto.'; end if;
  if p_ends_at is not null and p_ends_at <= coalesce(p_starts_at, now()) then raise exception 'La fecha de fin tiene que ser después del inicio.'; end if;
  if p_id is null then
    insert into announcements (kind, title, body, image, button_label, button_link, audience, starts_at, ends_at, active, created_by)
    values (p_kind, trim(p_title), trim(p_body), nullif(p_image, ''), nullif(trim(p_button_label), ''), nullif(trim(p_button_link), ''),
            p_audience, coalesce(p_starts_at, now()), p_ends_at, coalesce(p_active, true), auth.uid())
    returning id into v_id;
  else
    update announcements set kind = p_kind, title = trim(p_title), body = trim(p_body),
           image = case when p_keep_image then image else nullif(p_image, '') end,
           button_label = nullif(trim(p_button_label), ''), button_link = nullif(trim(p_button_link), ''),
           audience = p_audience, starts_at = coalesce(p_starts_at, starts_at), ends_at = p_ends_at, active = coalesce(p_active, active), updated_at = now()
     where id = p_id
    returning id into v_id;
    if v_id is null then raise exception 'No se encontró el aviso.'; end if;
  end if;
  perform public.log_audit('announcement.save', 'announcement', v_id, null, jsonb_build_object('title', p_title, 'active', p_active, 'audience', p_audience));
  return v_id;
end;
$$;
revoke all on function public.admin_save_announcement(uuid, text, text, text, text, boolean, text, text, text, timestamptz, timestamptz, boolean) from public, anon;
grant execute on function public.admin_save_announcement(uuid, text, text, text, text, boolean, text, text, text, timestamptz, timestamptz, boolean) to authenticated;

create or replace function public.admin_set_announcement_active(p_id uuid, p_active boolean) returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.is_admin() then raise exception 'Solo la administración puede hacer esto.'; end if;
  update announcements set active = p_active, updated_at = now() where id = p_id;
  if not found then raise exception 'No se encontró el aviso.'; end if;
  perform public.log_audit('announcement.active', 'announcement', p_id, null, jsonb_build_object('active', p_active));
end;
$$;
revoke all on function public.admin_set_announcement_active(uuid, boolean) from public, anon;
grant execute on function public.admin_set_announcement_active(uuid, boolean) to authenticated;
