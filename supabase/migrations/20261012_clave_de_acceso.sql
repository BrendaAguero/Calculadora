-- Clave de acceso de la Edición Personal (decisión del 11/10/2026): la clienta entra escribiendo una clave
-- (no su email). Se guarda la huella (hash) para validarla y la clave cifrada con un secreto del servidor
-- para que la administración pueda volver a verla y reenviarla. Nadie más puede leer estas columnas.
alter table public.approved_emails add column if not exists key_hash text;
alter table public.approved_emails add column if not exists key_hint text;
alter table public.approved_emails add column if not exists key_cipher text;
alter table public.approved_emails add column if not exists key_created_at timestamptz;
create unique index if not exists approved_emails_key_hash_unique on public.approved_emails (key_hash) where key_hash is not null;

-- La persona solo puede ver su fila sin la clave: se revoca la lectura de las columnas de clave para authenticated.
revoke select on public.approved_emails from authenticated;
grant select (id, email, source, status, note, user_id, license_id, approved_by, created_at, updated_at, key_hint, key_created_at) on public.approved_emails to authenticated;

-- Guarda una clave nueva (la administración o el servidor después de un pago).
create or replace function public.set_email_key(p_id uuid, p_hash text, p_hint text, p_cipher text)
returns void
language plpgsql volatile security definer
set search_path = public
as $$
begin
  if not (public.is_admin() or coalesce(auth.role(), '') = 'service_role') then raise exception 'No autorizado.'; end if;
  if p_hash !~ '^[0-9a-f]{64}$' then raise exception 'Clave inválida.'; end if;
  update approved_emails set key_hash = p_hash, key_hint = left(p_hint, 8), key_cipher = p_cipher, key_created_at = now(), updated_at = now()
   where id = p_id;
  if not found then raise exception 'No se encontró el email.'; end if;
  if public.is_admin() then perform public.log_audit('email.key', 'approved_email', p_id, null, null); end if;
end;
$$;

-- Busca el email de una clave (solo el servidor).
create or replace function public.key_lookup(p_hash text)
returns table (id uuid, email text, status text)
language sql stable security definer
set search_path = public
as $$ select id, email, status from approved_emails where key_hash = p_hash $$;

-- Para el servidor: datos de un email aprobado (para mandarle la clave después de un pago online).
create or replace function public.approved_email_for(p_email text)
returns table (id uuid, email text, key_hash text)
language sql stable security definer
set search_path = public
as $$ select id, email, key_hash from approved_emails where lower(email) = lower(btrim(p_email)) and status = 'approved' $$;

revoke all on function public.set_email_key(uuid, text, text, text) from public, anon;
grant execute on function public.set_email_key(uuid, text, text, text) to authenticated, service_role;
revoke all on function public.key_lookup(text) from public, anon, authenticated;
grant execute on function public.key_lookup(text) to service_role;
revoke all on function public.approved_email_for(text) from public, anon, authenticated;
grant execute on function public.approved_email_for(text) to service_role;
