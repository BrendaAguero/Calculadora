-- Cuentas de prueba (decisión de la dueña, 11/10/2026): no les aplican límites ni restricciones de plan,
-- para poder probar todo. No son administradoras. La marca solo la puede poner el sistema (service_role).

alter table public.profiles add column if not exists is_tester boolean not null default false;

create or replace function public.protect_profile_sensitive_fields()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if (new.role is distinct from old.role
      or new.account_status is distinct from old.account_status
      or new.is_tester is distinct from old.is_tester)
     and not (coalesce(auth.role(), '') = 'service_role' or current_user = 'service_role') then
    raise exception 'No autorizado para modificar role, account_status o is_tester directamente';
  end if;
  return new;
end;
$function$;
