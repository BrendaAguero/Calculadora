-- Botón de baja (Resolución 316/2018 de la Secretaría de Comercio): la persona puede dar de baja el servicio
-- contratado por internet desde un enlace visible en la página principal, y recibe un código de baja.

-- Los pedidos sin sesión se guardan junto con los de arrepentimiento, diferenciados por tipo.
alter table public.regret_requests add column if not exists kind text not null default 'regret';
alter table public.regret_requests add constraint regret_requests_kind_check check (kind in ('regret', 'cancellation'));

-- Con sesión: cancela la renovación de todas las suscripciones de la persona y devuelve el código de baja.
-- Emprendedor sigue activo hasta que vence (ya está pago); no se cobra más.
create or replace function public.cancel_my_subscriptions()
returns text
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ids uuid[];
  v_code text := 'BAJA-' || upper(substr(md5(gen_random_uuid()::text), 1, 8));
begin
  if v_uid is null then raise exception 'Iniciá sesión para dar de baja tu suscripción.'; end if;
  with canceled as (
    update subscriptions set auto_renew = false, auto_renew_canceled_at = now(), updated_at = now()
     where user_id = v_uid and auto_renew and status in ('active', 'pending')
    returning id
  )
  select array_agg(id) into v_ids from canceled;
  if v_ids is null then raise exception 'No tenés ninguna suscripción con renovación activa.'; end if;
  insert into audit_logs (actor_user_id, action, entity_type, entity_id, new_data)
  values (v_uid, 'subscription.cancel_button', 'subscription', v_ids[1], jsonb_build_object('code', v_code, 'subscriptions', to_jsonb(v_ids)));
  return v_code;
end;
$$;

-- Sin sesión: pedido de baja con nombre y email (lo resuelve la administración).
create or replace function public.submit_cancellation_request(p_full_name text, p_email text, p_details text default null)
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
  if (select count(*) from regret_requests where lower(email) = v_email and created_at > now() - interval '1 day') >= 5 then
    raise exception 'Ya recibimos varios pedidos con este email hoy. Si necesitás algo más, escribinos.';
  end if;
  loop
    v_code := 'BAJA-' || upper(substr(md5(gen_random_uuid()::text), 1, 8));
    exit when not exists (select 1 from regret_requests where code = v_code);
  end loop;
  insert into regret_requests (code, user_id, full_name, email, details, kind)
  values (v_code, auth.uid(), left(v_name, 120), left(v_email, 200), nullif(left(btrim(coalesce(p_details, '')), 1000), ''), 'cancellation');
  return v_code;
end;
$$;

revoke all on function public.cancel_my_subscriptions() from public, anon;
grant execute on function public.cancel_my_subscriptions() to authenticated;
revoke all on function public.submit_cancellation_request(text, text, text) from public;
grant execute on function public.submit_cancellation_request(text, text, text) to anon, authenticated;
