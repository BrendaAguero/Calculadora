-- «Deshacer» después de anular una venta: la venta vuelve a contar y, si al anularla se había devuelto
-- stock, se vuelve a descontar (con un movimiento que compensa la devolución). SECURITY INVOKER: RLS sigue aplicando.
create or replace function public.unvoid_sale(p_sale_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_sale sales%rowtype;
  v_returned numeric;
  v_stock uuid;
begin
  select * into v_sale from sales where id = p_sale_id and user_id = v_uid for update;
  if v_sale.id is null then raise exception 'No se encontró la venta.'; end if;
  if v_sale.voided_at is null then raise exception 'La venta no está anulada.'; end if;

  select stock_item_id, sum(quantity) into v_stock, v_returned
  from stock_movements where user_id = v_uid and reference_type = 'sale_void' and reference_id = p_sale_id
  group by stock_item_id;
  if coalesce(v_returned, 0) > 0 then
    insert into stock_movements (user_id, stock_item_id, movement_type, quantity, unit, reference_type, reference_id, notes)
    values (v_uid, v_stock, 'sale', -v_returned, 'unidad', 'sale_void', p_sale_id, 'Anulación deshecha');
  end if;

  update sales set voided_at = null where id = p_sale_id and user_id = v_uid;
end;
$$;

revoke all on function public.unvoid_sale(uuid) from public, anon;
grant execute on function public.unvoid_sale(uuid) to authenticated;
