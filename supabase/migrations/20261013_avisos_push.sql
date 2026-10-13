-- Avisos push: los temporizadores avisan aunque la app esté cerrada o el celular bloqueado.
-- La base revisa cada minuto (pg_cron) y le pide a la app que mande los avisos vencidos (pg_net).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- A qué navegador / celular avisarle (lo da el navegador cuando la persona acepta los avisos).
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_select on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy push_subscriptions_delete on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());
-- El alta pasa por save_push_subscription (un mismo aparato puede cambiar de cuenta).

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  if auth.uid() is null then raise exception 'Iniciá sesión.'; end if;
  if p_endpoint !~ '^https://' or char_length(p_endpoint) > 1000 or char_length(p_p256dh) > 200 or char_length(p_auth) > 100 then
    raise exception 'Datos de aviso no válidos.';
  end if;
  if (select count(*) from push_subscriptions where user_id = auth.uid()) >= 10 then
    delete from push_subscriptions where id = (select id from push_subscriptions where user_id = auth.uid() order by created_at limit 1);
  end if;
  insert into push_subscriptions (user_id, endpoint, p256dh, auth) values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
end;
$$;
revoke all on function public.save_push_subscription(text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;

alter table public.cure_timers add column if not exists notified_at timestamptz;

-- Claves internas (solo el servidor con la clave de servicio): claves de los avisos y la del aviso de cada minuto.
create table if not exists public.app_secrets (
  key text primary key,
  value text not null,
  created_at timestamptz not null default now()
);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;

insert into public.app_secrets (key, value) values ('cron_push', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;

-- Cada minuto: si hay temporizadores vencidos sin avisar, le pide a la app que mande los avisos.
select cron.schedule('avisos-temporizadores', '* * * * *', $job$
  select net.http_post(
    url := 'https://calculadora-emprender.vercel.app/api/push/enviar',
    headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', (select value from public.app_secrets where key = 'cron_push')),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  )
  where exists (select 1 from public.cure_timers where done_at is null and notified_at is null and ends_at <= now() and ends_at > now() - interval '1 day');
$job$);
