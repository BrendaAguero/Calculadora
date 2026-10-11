-- Aviso de uso en paralelo (decisión del 11/10/2026): cada aparato avisa «estoy en uso» cada pocos minutos con
-- la ubicación aproximada que da internet (ciudad, nunca la dirección). Si dos aparatos de la misma cuenta se
-- usan a la vez en lugares lejanos, se crea un aviso para la persona y para la administración. No bloquea.
alter table public.user_devices add column if not exists last_city text;
alter table public.user_devices add column if not exists last_country text;
alter table public.user_devices add column if not exists last_lat double precision;
alter table public.user_devices add column if not exists last_lon double precision;

create table if not exists public.session_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_a uuid not null references public.user_devices(id) on delete cascade,
  device_b uuid not null references public.user_devices(id) on delete cascade,
  place_a text,
  place_b text,
  distance_km int,
  status text not null default 'open' check (status in ('open', 'mine', 'not_mine')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists session_alerts_user on public.session_alerts (user_id, created_at desc);
alter table public.session_alerts enable row level security;
create policy session_alerts_select on public.session_alerts for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- Distancia aproximada en km entre dos puntos (fórmula del haversine).
create or replace function public.distance_km(lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision)
returns double precision
language sql immutable
set search_path = public
as $$
  select 2 * 6371 * asin(sqrt(power(sin(radians(lat2 - lat1) / 2), 2) + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2)))
$$;

-- «Estoy en uso»: solo el servidor (que conoce la ubicación por la conexión, no por lo que mande el aparato).
-- Devuelve json: {state: 'ok' | 'released' | 'unknown', alert: id del aviso nuevo o null}.
create or replace function public.record_presence(p_user_id uuid, p_device_id text, p_city text, p_country text, p_lat double precision, p_lon double precision)
returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_device user_devices%rowtype;
  v_other user_devices%rowtype;
  v_km double precision;
  v_alert uuid;
begin
  select * into v_device from user_devices where user_id = p_user_id and device_id = p_device_id order by released_at nulls first, created_at desc limit 1;
  if not found then return jsonb_build_object('state', 'unknown'); end if;
  if v_device.released_at is not null then return jsonb_build_object('state', 'released'); end if;

  update user_devices set last_seen_at = now(),
         last_city = coalesce(nullif(left(p_city, 80), ''), last_city), last_country = coalesce(nullif(left(p_country, 8), ''), last_country),
         last_lat = coalesce(p_lat, last_lat), last_lon = coalesce(p_lon, last_lon)
   where id = v_device.id;
  if p_lat is null or p_lon is null then return jsonb_build_object('state', 'ok'); end if;

  -- Otro aparato activo en los últimos 15 minutos a más de 150 km.
  for v_other in
    select * from user_devices
     where user_id = p_user_id and id <> v_device.id and released_at is null
       and last_seen_at > now() - interval '15 minutes' and last_lat is not null and last_lon is not null
  loop
    v_km := public.distance_km(p_lat, p_lon, v_other.last_lat, v_other.last_lon);
    if v_km > 150 and not exists (
      select 1 from session_alerts where user_id = p_user_id and created_at > now() - interval '12 hours'
         and ((device_a = v_device.id and device_b = v_other.id) or (device_a = v_other.id and device_b = v_device.id))
    ) then
      insert into session_alerts (user_id, device_a, device_b, place_a, place_b, distance_km)
      values (p_user_id, v_device.id, v_other.id,
              nullif(concat_ws(', ', nullif(p_city, ''), nullif(p_country, '')), ''),
              nullif(concat_ws(', ', v_other.last_city, v_other.last_country), ''), round(v_km)::int)
      returning id into v_alert;
      return jsonb_build_object('state', 'ok', 'alert', v_alert);
    end if;
  end loop;
  return jsonb_build_object('state', 'ok');
end;
$$;

-- La persona responde el aviso: «fui yo» o «no fui yo».
create or replace function public.resolve_session_alert(p_id uuid, p_mine boolean)
returns void
language plpgsql volatile security definer
set search_path = public
as $$
begin
  update session_alerts set status = case when p_mine then 'mine' else 'not_mine' end, resolved_at = now()
   where id = p_id and user_id = auth.uid() and status = 'open';
end;
$$;

-- Cerrar todos los aparatos de la persona (se vuelve a entrar con la clave).
create or replace function public.release_all_my_devices()
returns int
language plpgsql volatile security definer
set search_path = public
as $$
declare v_count int;
begin
  update user_devices set released_at = now() where user_id = auth.uid() and released_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.record_presence(uuid, text, text, text, double precision, double precision) from public, anon, authenticated;
grant execute on function public.record_presence(uuid, text, text, text, double precision, double precision) to service_role;
revoke all on function public.resolve_session_alert(uuid, boolean) from public, anon;
grant execute on function public.resolve_session_alert(uuid, boolean) to authenticated;
revoke all on function public.release_all_my_devices() from public, anon;
grant execute on function public.release_all_my_devices() to authenticated;
