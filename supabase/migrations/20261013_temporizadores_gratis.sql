-- Los temporizadores de curado pasan a ser gratis para cualquier cuenta (con un tope para evitar abusos).
update public.modules set active = false, updated_at = now() where code = 'TEMPORIZADORES';

create or replace function public.sellable_module(p_code text) returns boolean
language sql immutable set search_path to 'public'
as $$ select p_code in ('PACK_VENTAS', 'EXTRA_DEVICE', 'COLORES', 'CUADERNO') $$;

alter policy cure_timers_insert on public.cure_timers with check (
  user_id = auth.uid() and (select count(*) from public.cure_timers t where t.user_id = auth.uid()) < 200);
