-- Revendedoras v2 (pedido del 11/10/2026):
-- - Compran la cantidad de licencias que quieran (1, 2, 3...). Desde 5, 10 y 20 tienen descuento.
-- (Los recursos se guardan como content_entries de tipo «affiliate_material», slug «revendedoras», porque el tipo de contenido tiene una lista cerrada.)
-- - En el panel tienen contacto con la administración (email, WhatsApp, grupo) y recursos de venta,
--   que la administración edita.
alter table public.reseller_orders drop constraint if exists reseller_orders_quantity_check;
alter table public.reseller_orders add constraint reseller_orders_quantity_check check (quantity between 1 and 100);

update public.pricing_config set value_numeric = 35900, description = 'Precio por licencia para revendedoras (de a una)', updated_at = now() where key = 'reseller_unit_price';
insert into public.pricing_config (key, value_numeric, description) values
  ('reseller_discount_5', 10, 'Descuento (%) para revendedoras desde 5 licencias'),
  ('reseller_discount_10', 15, 'Descuento (%) para revendedoras desde 10 licencias'),
  ('reseller_discount_20', 25, 'Descuento (%) para revendedoras desde 20 licencias')
on conflict do nothing;

-- Precio por licencia según la cantidad.
create or replace function public.reseller_unit_price_for(p_quantity int)
returns numeric
language sql stable security definer
set search_path = public
as $$
  select round((select value_numeric from pricing_config where key = 'reseller_unit_price')
    * (1 - coalesce(case
        when p_quantity >= 20 then (select value_numeric from pricing_config where key = 'reseller_discount_20')
        when p_quantity >= 10 then (select value_numeric from pricing_config where key = 'reseller_discount_10')
        when p_quantity >= 5 then (select value_numeric from pricing_config where key = 'reseller_discount_5')
        else 0 end, 0) / 100) / 10) * 10
$$;

create or replace function public.request_reseller_order(p_quantity int)
returns uuid
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_price numeric;
  v_id uuid;
begin
  if v_uid is null then raise exception 'Iniciá sesión.'; end if;
  if not exists (select 1 from reseller_accounts where user_id = v_uid and status = 'active') then raise exception 'Primero activá el modo revendedora.'; end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 100 then raise exception 'Elegí entre 1 y 100 licencias.'; end if;
  v_price := public.reseller_unit_price_for(p_quantity);
  select id into v_id from reseller_orders where user_id = v_uid and quantity = p_quantity and status = 'pending' order by created_at desc limit 1;
  if v_id is not null then
    update reseller_orders set unit_price = v_price, total = v_price * p_quantity, updated_at = now() where id = v_id;
    return v_id;
  end if;
  insert into reseller_orders (user_id, quantity, unit_price, total) values (v_uid, p_quantity, v_price, v_price * p_quantity) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.admin_set_reseller_prices(p_unit numeric, p_d5 numeric, p_d10 numeric, p_d20 numeric)
returns void
language plpgsql volatile security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Solo la administración puede hacer esto.'; end if;
  if p_unit <= 0 then raise exception 'El precio tiene que ser mayor a cero.'; end if;
  if least(p_d5, p_d10, p_d20) < 0 or greatest(p_d5, p_d10, p_d20) >= 100 then raise exception 'Los descuentos van de 0 a 99 %%.'; end if;
  update pricing_config set value_numeric = p_unit, updated_at = now() where key = 'reseller_unit_price';
  update pricing_config set value_numeric = p_d5, updated_at = now() where key = 'reseller_discount_5';
  update pricing_config set value_numeric = p_d10, updated_at = now() where key = 'reseller_discount_10';
  update pricing_config set value_numeric = p_d20, updated_at = now() where key = 'reseller_discount_20';
  perform public.log_audit('prices.reseller', 'pricing', null, null, jsonb_build_object('unit', p_unit, 'd5', p_d5, 'd10', p_d10, 'd20', p_d20));
end;
$$;

-- Contacto y recursos de venta para revendedoras (los edita la administración).
create or replace function public.admin_save_reseller_resources(p jsonb)
returns void
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_group text := nullif(btrim(coalesce(p->>'group_link', '')), '');
begin
  if not public.is_admin() then raise exception 'Solo la administración puede hacer esto.'; end if;
  if v_group is not null and v_group !~ '^https://' then raise exception 'El enlace del grupo tiene que empezar con https://.'; end if;
  insert into content_entries (content_type, slug, title, content, status, updated_by)
  values ('affiliate_material', 'revendedoras', 'Recursos para revendedoras', jsonb_build_object(
      'whatsapp', left(regexp_replace(coalesce(p->>'whatsapp', ''), '[^0-9+]', '', 'g'), 20),
      'group_link', v_group,
      'wait_time', left(btrim(coalesce(p->>'wait_time', '')), 120),
      'client_message', left(btrim(coalesce(p->>'client_message', '')), 1500),
      'tips', left(btrim(coalesce(p->>'tips', '')), 4000),
      'materials', left(btrim(coalesce(p->>'materials', '')), 4000)
    )::text, 'published', auth.uid())
  on conflict (content_type, slug) do update set content = excluded.content, updated_by = excluded.updated_by, updated_at = now();
  perform public.log_audit('reseller.resources', 'content_entry', null, null, null);
end;
$$;

revoke all on function public.reseller_unit_price_for(int) from public, anon;
grant execute on function public.reseller_unit_price_for(int) to authenticated;
revoke all on function public.admin_set_reseller_prices(numeric, numeric, numeric, numeric) from public, anon;
grant execute on function public.admin_set_reseller_prices(numeric, numeric, numeric, numeric) to authenticated;
revoke all on function public.admin_save_reseller_resources(jsonb) from public, anon;
grant execute on function public.admin_save_reseller_resources(jsonb) to authenticated;
