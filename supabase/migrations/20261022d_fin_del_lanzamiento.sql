-- Fecha de fin del precio de lanzamiento de la Edición Personal.
-- Mientras dura, la compra muestra el precio normal tachado y «Precio de lanzamiento hasta el …».
-- Cuando llega la fecha (a la medianoche de Argentina), una tarea de cada hora pasa el precio online
-- y por transferencia al precio normal y saca el tachado. Queda en la auditoría.

insert into public.pricing_config (key, value_numeric, value_text, description) values
  ('launch_ends_at', null, null, 'Fin del precio de lanzamiento (fecha y hora en value_text). Vacío = sin fecha.')
on conflict (key) do nothing;

-- Guarda el precio normal y, opcionalmente, el último día del lanzamiento.
create or replace function public.admin_set_launch(p_regular numeric, p_last_day date) returns void
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_online numeric;
  v_end timestamptz;
begin
  if not public.is_admin() then raise exception 'Solo la administración puede hacer esto.'; end if;
  if p_regular is null or p_regular < 0 then raise exception 'Precio inválido.'; end if;
  select value_numeric into v_online from pricing_config where key = 'personal_price_online';
  if p_last_day is not null then
    if p_last_day < (now() at time zone 'America/Argentina/Buenos_Aires')::date then raise exception 'La fecha de fin no puede ser de un día que ya pasó.'; end if;
    if p_regular <= coalesce(v_online, 0) then raise exception 'Para ponerle fecha de fin, el precio normal tiene que ser mayor al precio online de hoy.'; end if;
    -- Termina al final de ese día, hora de Argentina.
    v_end := ((p_last_day + 1)::timestamp) at time zone 'America/Argentina/Buenos_Aires';
  end if;
  update pricing_config set value_numeric = p_regular, updated_at = now() where key = 'personal_price_regular';
  update pricing_config set value_text = case when v_end is null then null else to_char(v_end at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') end, updated_at = now()
   where key = 'launch_ends_at';
  perform public.log_audit('prices.launch', 'pricing', null, null, jsonb_build_object('regular', p_regular, 'last_day', p_last_day));
end;
$$;
revoke all on function public.admin_set_launch(numeric, date) from public, anon;
grant execute on function public.admin_set_launch(numeric, date) to authenticated;

-- La llama la tarea de cada hora. Si ya pasó la fecha, el precio normal pasa a ser el precio de venta.
create or replace function public.end_launch_if_due() returns boolean
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_end text;
  v_regular numeric;
  v_online numeric;
begin
  select value_text into v_end from pricing_config where key = 'launch_ends_at';
  if v_end is null or v_end::timestamptz > now() then return false; end if;
  select value_numeric into v_regular from pricing_config where key = 'personal_price_regular';
  select value_numeric into v_online from pricing_config where key = 'personal_price_online';
  if coalesce(v_regular, 0) > 0 then
    update pricing_config set value_numeric = v_regular, updated_at = now()
     where key in ('personal_price_online', 'personal_price_transfer') and coalesce(value_numeric, 0) < v_regular;
    -- El precio de revendedora sube en la misma proporción (por ejemplo, de 15.000 a 30.000 → el doble),
    -- redondeado a $100. Va después del precio al público, así el control de margen ya ve el precio nuevo.
    if coalesce(v_online, 0) > 0 and v_regular > v_online then
      update pricing_config set value_numeric = round(value_numeric * v_regular / v_online / 100) * 100, updated_at = now()
       where key = 'reseller_unit_price' and coalesce(value_numeric, 0) > 0;
    end if;
    update plans set price = (select value_numeric from pricing_config where key = 'personal_price_online'), updated_at = now() where code = 'ADVANCED';
    update pricing_config set value_numeric = 0, updated_at = now() where key = 'personal_price_regular';
  end if;
  update pricing_config set value_text = null, updated_at = now() where key = 'launch_ends_at';
  perform public.log_audit('prices.launch_ended', 'pricing', null, null, jsonb_build_object('price', v_regular, 'reseller', (select value_numeric from pricing_config where key = 'reseller_unit_price')));
  return true;
end;
$$;
revoke all on function public.end_launch_if_due() from public, anon, authenticated;

select cron.schedule('fin-lanzamiento', '17 * * * *', 'select public.end_launch_if_due();');
