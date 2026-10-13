-- Avisos que se repiten: si la persona no toca «Listo», se vuelve a avisar cada minuto (hasta 5 veces).
alter table public.cure_timers add column if not exists notify_count integer not null default 0;
alter table public.cure_timers add column if not exists last_notified_at timestamptz;
-- Los ya avisados con la versión anterior cuentan como avisados una vez.
update public.cure_timers set notify_count = 1, last_notified_at = notified_at where notified_at is not null and notify_count = 0;

-- Reserva los temporizadores que toca avisar ahora y suma el aviso (atómico, para no duplicar).
create or replace function public.claim_due_timer_pushes() returns table (id uuid, user_id uuid, label text, notify_count integer)
language sql security definer set search_path to 'public'
as $$
  update cure_timers t
     set notify_count = t.notify_count + 1, last_notified_at = now(), notified_at = coalesce(t.notified_at, now())
   where t.id in (
     select c.id from cure_timers c
      where c.done_at is null and c.ends_at <= now() and c.ends_at > now() - interval '1 day'
        and c.notify_count < 5 and (c.last_notified_at is null or c.last_notified_at <= now() - interval '50 seconds')
      for update skip locked
   )
  returning t.id, t.user_id, t.label, t.notify_count;
$$;
revoke all on function public.claim_due_timer_pushes() from public, anon, authenticated;
grant execute on function public.claim_due_timer_pushes() to service_role;

-- La revisión de cada minuto incluye los avisos repetidos (se aplicó después de publicar el código nuevo).
select cron.schedule('avisos-temporizadores', '* * * * *', $job$
  select net.http_post(
    url := 'https://calculadora-emprender.vercel.app/api/push/enviar',
    headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', (select value from public.app_secrets where key = 'cron_push')),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  )
  where exists (
    select 1 from public.cure_timers
     where done_at is null and ends_at <= now() and ends_at > now() - interval '1 day'
       and notify_count < 5 and (last_notified_at is null or last_notified_at <= now() - interval '50 seconds')
  );
$job$);
