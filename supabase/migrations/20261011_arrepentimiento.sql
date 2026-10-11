-- Etapa 21: botón de arrepentimiento (Resolución 424/2020 de la Secretaría de Comercio Interior).
-- Cualquier persona puede pedir la revocación de una compra dentro de los 10 días, sin iniciar sesión.
-- Se le entrega un código de trámite en el momento. La administradora lo revisa y devuelve el dinero.

create table if not exists public.regret_requests (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null check (char_length(email) between 5 and 200 and email like '%@%'),
  purchase_reference text check (purchase_reference is null or char_length(purchase_reference) <= 120),
  purchase_date date,
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'received' check (status in ('received', 'refunded', 'rejected')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 1000),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists regret_requests_email_created_idx on public.regret_requests (lower(email), created_at desc);

alter table public.regret_requests enable row level security;

-- Solo lectura: la persona ve sus propios pedidos y la administración ve todos.
-- Nadie inserta ni modifica directo: se usa submit_regret_request / admin_resolve_regret_request.
create policy regret_requests_select_own on public.regret_requests
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

create or replace function public.submit_regret_request(
  p_full_name text, p_email text, p_purchase_reference text default null, p_purchase_date date default null, p_details text default null
)
returns text
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_full_name, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_code text;
begin
  if char_length(v_name) < 2 then raise exception 'Escribí tu nombre.'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Revisá el email.'; end if;
  if p_purchase_date is not null and p_purchase_date > (now() at time zone 'America/Argentina/Buenos_Aires')::date then
    raise exception 'La fecha de compra no puede ser futura.';
  end if;
  -- Freno contra envíos repetidos o automáticos: hasta 5 pedidos por email por día.
  if (select count(*) from regret_requests where lower(email) = v_email and created_at > now() - interval '1 day') >= 5 then
    raise exception 'Ya recibimos varios pedidos con este email hoy. Si necesitás algo más, escribinos.';
  end if;

  loop
    v_code := 'ARR-' || upper(substr(md5(gen_random_uuid()::text), 1, 8));
    exit when not exists (select 1 from regret_requests where code = v_code);
  end loop;

  insert into regret_requests (code, user_id, full_name, email, purchase_reference, purchase_date, details)
  values (v_code, auth.uid(), left(v_name, 120), left(v_email, 200),
          nullif(left(btrim(coalesce(p_purchase_reference, '')), 120), ''), p_purchase_date,
          nullif(left(btrim(coalesce(p_details, '')), 1000), ''));
  return v_code;
end;
$$;

revoke all on function public.submit_regret_request(text, text, text, date, text) from public;
grant execute on function public.submit_regret_request(text, text, text, date, text) to anon, authenticated;

create or replace function public.admin_resolve_regret_request(p_id uuid, p_status text, p_note text default null)
returns void
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_old regret_requests;
begin
  if not public.is_admin() then raise exception 'Solo la administración puede hacer esto.'; end if;
  if p_status not in ('refunded', 'rejected') then raise exception 'Estado no válido.'; end if;
  select * into v_old from regret_requests where id = p_id for update;
  if not found then raise exception 'No se encontró el pedido.'; end if;
  if v_old.status <> 'received' then raise exception 'Este pedido ya fue resuelto.'; end if;

  update regret_requests
     set status = p_status, admin_note = nullif(left(btrim(coalesce(p_note, '')), 1000), ''), resolved_at = now(), resolved_by = auth.uid()
   where id = p_id;
  perform public.log_audit('regret.' || p_status, 'regret_request', p_id, jsonb_build_object('status', v_old.status), jsonb_build_object('status', p_status, 'note', p_note));
end;
$$;

revoke all on function public.admin_resolve_regret_request(uuid, text, text) from public, anon;
grant execute on function public.admin_resolve_regret_request(uuid, text, text) to authenticated;
