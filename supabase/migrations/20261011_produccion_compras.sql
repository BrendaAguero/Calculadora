-- Etapas 14 (Producción) y 15 (Compras y proveedores).
-- Dos funciones que guardan todo en una sola transacción: si algo falla, no queda nada a medias.
-- Son SECURITY INVOKER: corren con los permisos de quien llama, así que RLS sigue aplicando.
-- La app calcula cantidades, conversiones y costos en el servidor y los pasa ya convertidos a la unidad del material.

-- Busca (o crea en cero) el ítem de stock de un material o producto de quien llama.
create or replace function public.ensure_stock_item(p_material_id uuid, p_product_id uuid, p_unit text)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from stock_items
  where user_id = auth.uid() and ((p_material_id is not null and material_id = p_material_id) or (p_product_id is not null and product_id = p_product_id));
  if v_id is null then
    insert into stock_items (user_id, stock_type, material_id, product_id, unit)
    values (auth.uid(), case when p_material_id is not null then 'material' else 'finished_product' end, p_material_id, p_product_id, p_unit)
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

-- p = {product_id, activity_id, formula_id, formula_version_id, quantity, total_cost, deduct, add_output, notes,
--      items: [{material_id, quantity, unit, unit_cost, total_cost}]}  (cantidades en la unidad del material)
create or replace function public.register_production(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_item jsonb;
  v_stock uuid;
begin
  if v_uid is null then raise exception 'Iniciá sesión.'; end if;
  if coalesce((p->>'quantity')::numeric, 0) <= 0 then raise exception 'La cantidad tiene que ser mayor que cero.'; end if;

  insert into productions (user_id, activity_id, product_id, formula_id, formula_version_id, quantity, total_cost, stock_deducted, notes)
  values (v_uid, (p->>'activity_id')::uuid, (p->>'product_id')::uuid, nullif(p->>'formula_id', '')::uuid, nullif(p->>'formula_version_id', '')::uuid,
          (p->>'quantity')::numeric, (p->>'total_cost')::numeric, coalesce((p->>'deduct')::boolean, false), nullif(p->>'notes', ''))
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(coalesce(p->'items', '[]'::jsonb)) loop
    insert into production_items (production_id, material_id, quantity, unit, unit_cost_snapshot, total_cost)
    values (v_id, (v_item->>'material_id')::uuid, (v_item->>'quantity')::numeric, v_item->>'unit', (v_item->>'unit_cost')::numeric, (v_item->>'total_cost')::numeric);

    if coalesce((p->>'deduct')::boolean, false) and (v_item->>'quantity')::numeric > 0 then
      v_stock := public.ensure_stock_item((v_item->>'material_id')::uuid, null, v_item->>'unit');
      insert into stock_movements (user_id, stock_item_id, movement_type, quantity, unit, reference_type, reference_id, notes)
      values (v_uid, v_stock, 'production_consumption', -(v_item->>'quantity')::numeric, v_item->>'unit', 'production', v_id, 'Producción');
    end if;
  end loop;

  if coalesce((p->>'add_output')::boolean, false) then
    v_stock := public.ensure_stock_item(null, (p->>'product_id')::uuid, 'unidad');
    insert into stock_movements (user_id, stock_item_id, movement_type, quantity, unit, reference_type, reference_id, notes)
    values (v_uid, v_stock, 'production_output', (p->>'quantity')::numeric, 'unidad', 'production', v_id, 'Producción');
  end if;

  return v_id;
end;
$$;

-- p = {supplier_id, purchase_date, notes, update_stock,
--      items: [{material_id, quantity, unit, unit_price, total, update_price,
--               stock_quantity, stock_unit, unit_cost}]}  (stock_quantity y unit_cost en la unidad del material)
create or replace function public.register_supplier_purchase(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_item jsonb;
  v_stock uuid;
  v_price uuid;
  v_total numeric := 0;
begin
  if v_uid is null then raise exception 'Iniciá sesión.'; end if;
  if jsonb_array_length(coalesce(p->'items', '[]'::jsonb)) = 0 then raise exception 'Agregá al menos un material.'; end if;
  select coalesce(sum((i->>'total')::numeric), 0) into v_total from jsonb_array_elements(p->'items') i;

  insert into supplier_purchases (user_id, supplier_id, purchase_date, total, currency, stock_updated, notes)
  values (v_uid, nullif(p->>'supplier_id', '')::uuid, coalesce((p->>'purchase_date')::timestamptz, now()), v_total, 'ARS',
          coalesce((p->>'update_stock')::boolean, false), nullif(p->>'notes', ''))
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(p->'items') loop
    insert into supplier_purchase_items (supplier_purchase_id, material_id, quantity, unit, unit_price, total)
    values (v_id, (v_item->>'material_id')::uuid, (v_item->>'quantity')::numeric, v_item->>'unit', (v_item->>'unit_price')::numeric, (v_item->>'total')::numeric);

    -- Precio nuevo del material: cierra el anterior y pasa a ser el actual (el historial no se toca).
    if coalesce((v_item->>'update_price')::boolean, false) then
      update material_prices set valid_until = now()
      where material_id = (v_item->>'material_id')::uuid and valid_until is null
        and exists (select 1 from materials m where m.id = material_prices.material_id and m.user_id = v_uid);
      insert into material_prices (material_id, purchase_price, purchase_quantity, purchase_unit, unit_cost, currency, is_estimated, supplier_id, valid_from)
      values ((v_item->>'material_id')::uuid, (v_item->>'total')::numeric, (v_item->>'quantity')::numeric, v_item->>'unit',
              (v_item->>'unit_cost')::numeric, 'ARS', false, nullif(p->>'supplier_id', '')::uuid, now())
      returning id into v_price;
      update materials set current_price_id = v_price where id = (v_item->>'material_id')::uuid and user_id = v_uid;
      if not found then raise exception 'El material no existe o no es tuyo.'; end if;
    end if;

    if coalesce((p->>'update_stock')::boolean, false) then
      v_stock := public.ensure_stock_item((v_item->>'material_id')::uuid, null, v_item->>'stock_unit');
      insert into stock_movements (user_id, stock_item_id, movement_type, quantity, unit, reference_type, reference_id, notes)
      values (v_uid, v_stock, 'purchase', (v_item->>'stock_quantity')::numeric, v_item->>'stock_unit', 'supplier_purchase', v_id, 'Compra');
    end if;
  end loop;

  return v_id;
end;
$$;

revoke all on function public.ensure_stock_item(uuid, uuid, text) from public, anon;
revoke all on function public.register_production(jsonb) from public, anon;
revoke all on function public.register_supplier_purchase(jsonb) from public, anon;
grant execute on function public.ensure_stock_item(uuid, uuid, text) to authenticated;
grant execute on function public.register_production(jsonb) to authenticated;
grant execute on function public.register_supplier_purchase(jsonb) to authenticated;
