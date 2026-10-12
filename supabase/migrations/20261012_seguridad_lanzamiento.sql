-- Revisión de seguridad antes del lanzamiento.

-- 1) El email del perfil solo lo cambia el sistema o la administración: las licencias se asignan por email,
--    así que nadie puede ponerse el email de otra persona para quedarse con su compra.
create or replace function public.protect_profile_sensitive_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.role is distinct from old.role
      or new.account_status is distinct from old.account_status
      or new.is_tester is distinct from old.is_tester
      or lower(coalesce(new.email, '')) is distinct from lower(coalesce(old.email, '')))
     and not (coalesce(auth.role(), '') = 'service_role' or current_user = 'service_role' or public.is_admin()) then
    raise exception 'No autorizado para modificar role, account_status, is_tester o email directamente';
  end if;
  return new;
end;
$$;

-- 2) Subida sin conexión: también materiales, stock, producción y compras.
alter table public.offline_sync_log drop constraint if exists offline_sync_log_kind_check,
  add constraint offline_sync_log_kind_check check (kind in ('sale', 'yeso_calc', 'mix_calc', 'material', 'stock_item', 'stock_move', 'production', 'purchase'));

-- 3) search_path fijo (aviso del linter de Supabase).
alter function public.sellable_module(text) set search_path = public;
