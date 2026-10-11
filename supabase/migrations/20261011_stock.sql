-- Etapa 13: Stock. Las tablas stock_items y stock_movements ya existían (vacías); esto agrega integridad.
-- - Un solo registro de stock por material y por producto.
-- - La cantidad solo cambia a través de movimientos (quedan en el historial).
-- - Los movimientos no se editan ni se borran: los errores se corrigen con un ajuste.

create unique index if not exists stock_items_one_per_material on public.stock_items (user_id, material_id) where material_id is not null;
create unique index if not exists stock_items_one_per_product on public.stock_items (user_id, product_id) where product_id is not null;
create index if not exists stock_movements_item_created on public.stock_movements (stock_item_id, created_at desc);

-- Cada movimiento suma (o resta, si es negativo) a la cantidad del ítem.
create or replace function public.apply_stock_movement()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.quantity = 0 then
    raise exception 'El movimiento no puede ser de cantidad cero.';
  end if;
  perform set_config('app.stock_movement', 'on', true);
  update stock_items set quantity = quantity + new.quantity, updated_at = now()
  where id = new.stock_item_id and user_id = new.user_id;
  if not found then
    raise exception 'No se encontró el ítem de stock.';
  end if;
  perform set_config('app.stock_movement', 'off', true);
  return new;
end;
$$;

create or replace trigger apply_stock_movement after insert on public.stock_movements
for each row execute function public.apply_stock_movement();

-- La cantidad no se cambia a mano: siempre con un movimiento.
create or replace function public.guard_stock_quantity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.quantity <> 0 then
      raise exception 'El stock se crea en cero; la cantidad inicial se registra como movimiento.';
    end if;
    return new;
  end if;
  if new.quantity is distinct from old.quantity and coalesce(current_setting('app.stock_movement', true), 'off') <> 'on' then
    raise exception 'La cantidad de stock solo cambia registrando un movimiento.';
  end if;
  return new;
end;
$$;

create or replace trigger guard_stock_quantity before insert or update on public.stock_items
for each row execute function public.guard_stock_quantity();

-- El historial de movimientos no se edita ni se borra.
create or replace function public.block_stock_movement_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Los movimientos de stock no se modifican ni se borran; registrá un ajuste.';
end;
$$;

create or replace trigger block_stock_movement_changes before update or delete on public.stock_movements
for each row execute function public.block_stock_movement_changes();
