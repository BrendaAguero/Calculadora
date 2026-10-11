-- Versión gratis (decisión del 11/10/2026): toda cuenta sin licencia usa el plan FREE.
-- Incluye 1 actividad (Yeso), la calculadora en modo Fácil y Estándar, y hasta 5 materiales, 2 productos,
-- 1 fórmula y 1 molde. Stock, ventas, producción y proveedores quedan para planes pagos. Muestra un banner.

insert into public.plans (code, name, type, price, currency, active, description)
values ('FREE', 'Gratis', 'free', 0, 'ARS', true, 'Versión gratuita con límites y banner.')
on conflict (code) do nothing;

insert into public.plan_limits (plan_id, resource, limit_value, unlimited)
select p.id, v.resource, v.limit_value, v.unlimited
from public.plans p
cross join (values ('materials', 5, false), ('products', 2, false), ('formulas', 1, false), ('molds', 1, false),
                   ('calculations', null::int, true), ('history', null::int, true)) as v(resource, limit_value, unlimited)
where p.code = 'FREE'
  and not exists (select 1 from public.plan_limits pl where pl.plan_id = p.id and pl.resource = v.resource);

-- Da la actividad gratuita (Yeso) a una cuenta que todavía no tiene ninguna.
-- Las actividades se registran con una compra o con un otorgamiento; acá es un otorgamiento automático
-- a nombre de la administradora principal (la primera cuenta admin).
create or replace function public.grant_free_activity(p_user_id uuid)
returns void
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_activity uuid;
  v_admin uuid;
  v_grant uuid;
begin
  if exists (select 1 from user_activities where user_id = p_user_id) then return; end if;
  select id into v_activity from activities where code = 'YESO' and active;
  select id into v_admin from profiles where role = 'admin' order by created_at limit 1;
  if v_activity is null or v_admin is null then return; end if;
  insert into dev_grants (user_id, grant_type, target_id, granted_by_admin_id, reason)
  values (p_user_id, 'activity', v_activity, v_admin, 'Actividad incluida en la versión gratis')
  returning id into v_grant;
  insert into user_activities (user_id, activity_id, dev_grant_id, is_primary, status)
  values (p_user_id, v_activity, v_grant, true, 'active')
  on conflict (user_id, activity_id) do nothing;
end;
$$;

revoke all on function public.grant_free_activity(uuid) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, terms_accepted_at)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    case when (new.raw_user_meta_data ->> 'terms_accepted') = 'true' then now() else null end
  );

  insert into public.user_preferences (user_id) values (new.id);

  -- Versión gratis: la cuenta nueva arranca con la actividad Yeso.
  perform public.grant_free_activity(new.id);

  return new;
end;
$$;

-- Cuentas existentes sin ninguna actividad: reciben la gratuita.
select public.grant_free_activity(p.id) from public.profiles p
where not exists (select 1 from public.user_activities ua where ua.user_id = p.id);
