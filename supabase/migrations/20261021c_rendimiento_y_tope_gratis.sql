-- Etapa 1 de la auditoría: rendimiento de la base y tope de cuentas gratis.

-- 1) Índices para las relaciones que no tenían (consultas y borrados más rápidos).
create index if not exists announcements_created_by_idx on public.announcements (created_by);
create index if not exists approved_emails_approved_by_idx on public.approved_emails (approved_by);
create index if not exists approved_emails_license_id_idx on public.approved_emails (license_id);
create index if not exists approved_emails_user_id_idx on public.approved_emails (user_id);
create index if not exists auto_notice_log_code_idx on public.auto_notice_log (code);
create index if not exists commissions_withdrawal_id_idx on public.commissions (withdrawal_id);
create index if not exists community_mutes_muted_by_idx on public.community_mutes (muted_by);
create index if not exists community_reports_comment_id_idx on public.community_reports (comment_id);
create index if not exists community_reports_post_id_idx on public.community_reports (post_id);
create index if not exists community_reports_resolved_by_idx on public.community_reports (resolved_by);
create index if not exists regret_requests_resolved_by_idx on public.regret_requests (resolved_by);
create index if not exists regret_requests_user_id_idx on public.regret_requests (user_id);
create index if not exists reseller_clients_approved_email_id_idx on public.reseller_clients (approved_email_id);
create index if not exists session_alerts_device_a_idx on public.session_alerts (device_a);
create index if not exists session_alerts_device_b_idx on public.session_alerts (device_b);
create index if not exists subscriptions_upgraded_from_idx on public.subscriptions (upgraded_from_subscription_id);
create index if not exists test_logs_color_recipe_id_idx on public.test_logs (color_recipe_id);

-- 2) Reglas de acceso: la usuaria actual se calcula una vez por consulta y no en cada fila.
--    Lo que cada regla permite no cambia.
alter policy activity_settings_insert on public.activity_settings with check ((user_id = (select auth.uid())));
alter policy activity_settings_select on public.activity_settings using ((user_id = (select auth.uid())));
alter policy activity_settings_update on public.activity_settings using ((user_id = (select auth.uid()))) with check ((user_id = (select auth.uid())));
alter policy approved_emails_select on public.approved_emails using ((is_admin() OR (user_id = (select auth.uid()))));
alter policy color_recipes_delete on public.color_recipes using ((user_id = (select auth.uid())));
alter policy color_recipes_insert on public.color_recipes with check (((user_id = (select auth.uid())) AND has_module('COLORES'::text)));
alter policy color_recipes_select on public.color_recipes using ((user_id = (select auth.uid())));
alter policy color_recipes_update on public.color_recipes using ((user_id = (select auth.uid()))) with check (((user_id = (select auth.uid())) AND has_module('COLORES'::text)));
alter policy cure_timers_delete on public.cure_timers using ((user_id = (select auth.uid())));
alter policy cure_timers_insert on public.cure_timers with check (((user_id = (select auth.uid())) AND (( SELECT count(*) AS count FROM cure_timers t WHERE ((t.user_id = (select auth.uid())) AND (t.done_at IS NULL))) < 200)));
alter policy cure_timers_select on public.cure_timers using ((user_id = (select auth.uid())));
alter policy cure_timers_update on public.cure_timers using ((user_id = (select auth.uid()))) with check ((user_id = (select auth.uid())));
alter policy offline_sync_log_delete on public.offline_sync_log using ((user_id = (select auth.uid())));
alter policy offline_sync_log_insert on public.offline_sync_log with check ((user_id = (select auth.uid())));
alter policy offline_sync_log_select on public.offline_sync_log using ((user_id = (select auth.uid())));
alter policy push_subscriptions_delete on public.push_subscriptions using ((user_id = (select auth.uid())));
alter policy push_subscriptions_select on public.push_subscriptions using ((user_id = (select auth.uid())));
alter policy regret_requests_select_own on public.regret_requests using (((user_id = (select auth.uid())) OR is_admin()));
alter policy reseller_accounts_select on public.reseller_accounts using (((user_id = (select auth.uid())) OR is_admin()));
alter policy reseller_clients_select on public.reseller_clients using (((reseller_id = (select auth.uid())) OR is_admin()));
alter policy reseller_orders_select on public.reseller_orders using (((user_id = (select auth.uid())) OR is_admin()));
alter policy session_alerts_select on public.session_alerts using (((user_id = (select auth.uid())) OR is_admin()));
alter policy test_logs_delete on public.test_logs using ((user_id = (select auth.uid())));
alter policy test_logs_insert on public.test_logs with check (((user_id = (select auth.uid())) AND has_module('CUADERNO'::text) AND ((color_recipe_id IS NULL) OR (EXISTS ( SELECT 1 FROM color_recipes c WHERE ((c.id = test_logs.color_recipe_id) AND (c.user_id = (select auth.uid()))))))));
alter policy test_logs_select on public.test_logs using ((user_id = (select auth.uid())));
alter policy test_logs_update on public.test_logs using ((user_id = (select auth.uid()))) with check (((user_id = (select auth.uid())) AND has_module('CUADERNO'::text) AND ((color_recipe_id IS NULL) OR (EXISTS ( SELECT 1 FROM color_recipes c WHERE ((c.id = test_logs.color_recipe_id) AND (c.user_id = (select auth.uid()))))))));
alter policy user_devices_select on public.user_devices using (((user_id = (select auth.uid())) OR is_admin()));

-- 3) Tope de cuentas gratis: cuando se llena, el registro gratis se cierra (las compras siguen siempre).
insert into public.pricing_config (key, value_numeric, description) values
  ('max_free_accounts', 1000, 'Máximo de cuentas gratis (sin Edición Personal ni Personal Plus). Vacío = sin tope.')
on conflict (key) do nothing;

create or replace function public.free_accounts_status() returns jsonb
language sql stable security definer set search_path to 'public'
as $$
  with free as (
    select count(*)::int n from profiles p
     where coalesce(p.role, 'user') not in ('admin', 'moderator') and not coalesce(p.is_tester, false)
       and not exists (select 1 from licenses l where l.user_id = p.id and l.status = 'active')
       and not exists (select 1 from subscriptions s where s.user_id = p.id and s.status = 'active' and s.expires_at > now())
  ), cap as (select value_numeric::int m from pricing_config where key = 'max_free_accounts')
  select jsonb_build_object('count', free.n, 'max', cap.m, 'open', cap.m is null or free.n < cap.m)
    from free left join cap on true;
$$;
revoke all on function public.free_accounts_status() from public, anon, authenticated;
grant execute on function public.free_accounts_status() to service_role;

create or replace function public.admin_set_max_free_accounts(p_max integer) returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.is_admin() then raise exception 'Solo la administración puede hacer esto.'; end if;
  if p_max is not null and (p_max < 0 or p_max > 1000000) then raise exception 'Poné un número entre 0 y 1.000.000, o dejalo vacío para no tener tope.'; end if;
  update pricing_config set value_numeric = p_max, updated_at = now() where key = 'max_free_accounts';
  perform public.log_audit('accounts.max_free', 'pricing', null, null, jsonb_build_object('max', p_max));
end;
$$;
revoke all on function public.admin_set_max_free_accounts(integer) from public, anon;
grant execute on function public.admin_set_max_free_accounts(integer) to authenticated;
