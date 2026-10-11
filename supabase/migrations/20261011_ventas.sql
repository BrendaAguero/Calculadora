-- Etapa 16: Ventas. La tabla sales ya existía (vacía).
-- register_sale guarda la venta y, si se pide, descuenta del stock de productos terminados (movimiento 'sale').
-- void_sale anula una venta cargada por error: NO la borra, la marca con voided_at (deja de contar en los totales)
-- y, si había descontado stock, lo devuelve con un movimiento 'return'. Ambas son SECURITY INVOKER: RLS sigue aplicando.

alter table public.sales add column if not exists voided_at timestamptz;

create or replace function public.register_sale(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_stock uuid;
begin
  if v_uid is null then raise exception 'Iniciá sesión.'; end if;
  if coalesce((p->>'quantity')::numeric, 0) <= 0 then raise exception 'La cantidad tiene que ser mayor que cero.'; end if;

  insert into sales (user_id, product_id, calculation_id, quantity, unit_price, unit_cost_snapshot, total_cost_snapshot, subtotal, discount,
                     commission, total, net_income, currency, sale_date, customer_name, payment_method)
  values (v_uid, (p->>'product_id')::uuid, nullif(p->>'calculation_id', '')::uuid, (p->>'quantity')::numeric, (p->>'unit_price')::numeric,
          (p->>'unit_cost')::numeric, (p->>'total_cost')::numeric, (p->>'subtotal')::numeric, (p->>'discount')::numeric,
          (p->>'commission')::numeric, (p->>'total')::numeric, (p->>'net_income')::numeric, 'ARS',
          coalesce((p->>'sale_date')::timestamptz, now()), nullif(p->>'customer_name', ''), nullif(p->>'payment_method', ''))
  returning id into v_id;

  if coalesce((p->>'deduct')::boolean, false) then
    v_stock := public.ensure_stock_item(null, (p->>'product_id')::uuid, 'unidad');
    insert into stock_movements (user_id, stock_item_id, movement_type, quantity, unit, reference_type, reference_id, notes)
    values (v_uid, v_stock, 'sale', -(p->>'quantity')::numeric, 'unidad', 'sale', v_id, 'Venta');
  end if;
  return v_id;
end;
$$;

create or replace function public.void_sale(p_sale_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_sale sales%rowtype;
  v_moved numeric;
  v_stock uuid;
begin
  select * into v_sale from sales where id = p_sale_id and user_id = v_uid for update;
  if v_sale.id is null then raise exception 'No se encontró la venta.'; end if;
  if v_sale.voided_at is not null then raise exception 'La venta ya estaba anulada.'; end if;

  select stock_item_id, -sum(quantity) into v_stock, v_moved
  from stock_movements where user_id = v_uid and reference_type = 'sale' and reference_id = p_sale_id
  group by stock_item_id;
  if coalesce(v_moved, 0) > 0 then
    insert into stock_movements (user_id, stock_item_id, movement_type, quantity, unit, reference_type, reference_id, notes)
    values (v_uid, v_stock, 'return', v_moved, 'unidad', 'sale_void', p_sale_id, 'Venta anulada');
  end if;

  update sales set voided_at = now() where id = p_sale_id and user_id = v_uid;
end;
$$;

revoke all on function public.register_sale(jsonb) from public, anon;
revoke all on function public.void_sale(uuid) from public, anon;
grant execute on function public.register_sale(jsonb) to authenticated;
grant execute on function public.void_sale(uuid) to authenticated;
