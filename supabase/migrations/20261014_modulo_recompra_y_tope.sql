-- Volver a comprar un módulo después de un reintegro lo reactiva (antes quedaba cobrado pero inactivo).
do $$
declare v_def text := pg_get_functiondef('public.apply_purchase_activation'::regproc);
begin
  if position('on conflict (user_id, module_id) do nothing' in v_def) = 0 then raise exception 'apply_purchase_activation cambió: revisar a mano'; end if;
  execute replace(v_def, 'on conflict (user_id, module_id) do nothing',
    'on conflict (user_id, module_id) do update set status = ''active'', purchase_id = excluded.purchase_id, dev_grant_id = null, acquired_at = now() where user_modules.status <> ''active''');
end $$;

-- El tope de temporizadores cuenta solo los que están en marcha.
alter policy cure_timers_insert on public.cure_timers with check (
  user_id = auth.uid() and (select count(*) from public.cure_timers t where t.user_id = auth.uid() and t.done_at is null) < 200);
