-- Etapa 2: prueba gratis de Personal Plus (14 días, una sola vez por cuenta, sin tarjeta).
-- Va en una tabla aparte para no mezclarse con las suscripciones pagas (ventas, renovaciones, actualizaciones).
-- Al terminar, la cuenta vuelve sola a lo que tenga (gratis o Edición Personal), sin borrar nada.

insert into public.pricing_config (key, value_numeric, description) values
  ('plus_trial_days', 14, 'Días de prueba gratis de Personal Plus para cuentas que nunca lo tuvieron. 0 = sin prueba.')
on conflict (key) do nothing;

create table if not exists public.plus_trials (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null
);
alter table public.plus_trials enable row level security;
create policy plus_trials_select_own on public.plus_trials for select using (user_id = (select auth.uid()) or public.is_admin());
-- Nadie la escribe directo: solo start_plus_trial().

-- ¿Puede empezar la prueba? Nunca tuvo Personal Plus (pago o prueba) y la prueba está encendida.
create or replace function public.plus_trial_status() returns jsonb
language plpgsql stable security definer set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_days int;
  v_trial plus_trials%rowtype;
begin
  if v_uid is null then return jsonb_build_object('available', false); end if;
  select coalesce(value_numeric, 0)::int into v_days from pricing_config where key = 'plus_trial_days';
  select * into v_trial from plus_trials where user_id = v_uid;
  return jsonb_build_object(
    'days', coalesce(v_days, 0),
    'active_until', case when v_trial.expires_at > now() then v_trial.expires_at end,
    'available', coalesce(v_days, 0) > 0 and v_trial.user_id is null
      and exists (select 1 from profiles p where p.id = v_uid and p.account_status = 'active')
      and not exists (select 1 from subscriptions s where s.user_id = v_uid and s.status in ('active', 'suspended', 'expired', 'refunded')));
end;
$$;
revoke all on function public.plus_trial_status() from public, anon;
grant execute on function public.plus_trial_status() to authenticated;

create or replace function public.start_plus_trial() returns timestamptz
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_status jsonb;
  v_end timestamptz;
begin
  if v_uid is null then raise exception 'Iniciá sesión.'; end if;
  v_status := public.plus_trial_status();
  if not coalesce((v_status->>'available')::boolean, false) then
    raise exception 'La prueba gratis es una sola vez por cuenta, para quien nunca tuvo Personal Plus.';
  end if;
  v_end := now() + make_interval(days => (v_status->>'days')::int);
  insert into plus_trials (user_id, expires_at) values (v_uid, v_end);
  perform public.log_audit('plus.trial_start', 'plus_trials', v_uid, null, jsonb_build_object('until', v_end));
  return v_end;
end;
$$;
revoke all on function public.start_plus_trial() from public, anon;
grant execute on function public.start_plus_trial() to authenticated;

create or replace function public.admin_set_plus_trial_days(p_days integer) returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.is_admin() then raise exception 'Solo la administración puede hacer esto.'; end if;
  if p_days is null or p_days < 0 or p_days > 60 then raise exception 'Poné de 0 a 60 días (0 apaga la prueba).'; end if;
  update pricing_config set value_numeric = p_days, updated_at = now() where key = 'plus_trial_days';
  perform public.log_audit('plus.trial_days', 'pricing', null, null, jsonb_build_object('days', p_days));
end;
$$;
revoke all on function public.admin_set_plus_trial_days(integer) from public, anon;
grant execute on function public.admin_set_plus_trial_days(integer) to authenticated;

-- Durante la prueba, la base da lo mismo que Personal Plus.
create or replace function public.has_module(p_code text) returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select auth.uid() is not null and exists (select 1 from profiles where id = auth.uid() and account_status = 'active') and (
    exists (select 1 from profiles where id = auth.uid() and (role = 'admin' or is_tester))
    or exists (select 1 from subscriptions s where s.user_id = auth.uid() and s.status = 'active' and s.expires_at > now())
    or exists (select 1 from plus_trials t where t.user_id = auth.uid() and t.expires_at > now())
    or (
      exists (select 1 from licenses l join plans p on p.id = l.plan_id
               where l.user_id = auth.uid() and l.status = 'active' and p.code in ('BASIC', 'ADVANCED')
                 and (l.expires_at is null or l.expires_at > now()))
      and (
        p_code in ('COLORES', 'CUADERNO')
        or exists (select 1 from user_modules um join modules m on m.id = um.module_id where um.user_id = auth.uid() and um.status = 'active' and m.code = p_code)
      )
    )
  );
$$;

-- Avisos automáticos: la prueba cuenta como Personal Plus (no muestra avisos de la versión gratis
-- y el aviso «plus_ending» avisa cuando termina la prueba).
do $do$
declare
  v_def text := pg_get_functiondef('public.my_auto_notice()'::regprocedure);
  v_old text := 'select max(s.expires_at) into v_plus_end from subscriptions s where s.user_id = v_uid and s.status = ''active'' and s.expires_at > now();';
begin
  if position(v_old in v_def) = 0 then raise exception 'my_auto_notice cambió: revisar a mano'; end if;
  execute replace(v_def, v_old, v_old || E'\n  select greatest(v_plus_end, (select t.expires_at from plus_trials t where t.user_id = v_uid and t.expires_at > now())) into v_plus_end;');
end
$do$;
