-- Precio de venta de las revendedoras: entre el precio oficial y un tope (el oficial + X %).
-- Se muestra en su panel y figura en sus condiciones. La app no puede controlar lo que cobran afuera:
-- es una regla de sus condiciones, y si no la cumplen se puede suspender el modo revendedora.
insert into public.pricing_config (key, value_numeric, description) values
  ('reseller_max_markup_pct', 10, 'Cuánto más que el precio oficial puede cobrar una revendedora (%). 0 = solo el precio oficial.')
on conflict (key) do nothing;

create or replace function public.admin_set_reseller_markup(p_pct numeric) returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.is_admin() then raise exception 'Solo la administración puede hacer esto.'; end if;
  if p_pct is null or p_pct < 0 or p_pct > 50 then raise exception 'Poné de 0 a 50 %%.'; end if;
  update pricing_config set value_numeric = p_pct, updated_at = now() where key = 'reseller_max_markup_pct';
  perform public.log_audit('prices.reseller_markup', 'pricing', null, null, jsonb_build_object('pct', p_pct));
end;
$$;
revoke all on function public.admin_set_reseller_markup(numeric) from public, anon;
grant execute on function public.admin_set_reseller_markup(numeric) to authenticated;
