-- Etapa 22: ajustes de la revisión de seguridad (asesor de Supabase).

-- bootstrap_calculadora_admin sirvió para crear la primera administradora; ya existe, así que nadie
-- más la puede llamar desde la API (sigue disponible para el SQL del panel de Supabase).
revoke execute on function public.bootstrap_calculadora_admin() from public, anon, authenticated;

-- handle_new_user es un trigger de alta de cuentas: no tiene que poder llamarse por la API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- search_path fijo para que el trigger no dependa del rol que lo ejecuta.
alter function public.sync_calculation_item_snapshot_name() set search_path = public;
