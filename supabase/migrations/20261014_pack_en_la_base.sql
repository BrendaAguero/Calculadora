-- El Pack Ventas y Stock también se exige en la base: sin el pack (o Plus, administración, cuenta de prueba)
-- no se puede cargar, cambiar ni borrar ventas, stock, producción, proveedores ni compras, aunque se intente
-- por fuera de la app. Ver lo que ya se tenía sigue permitido (se puede consultar y exportar).
-- Son políticas «restrictivas»: se suman a las que ya existen (cada persona solo lo suyo).
do $$
declare
  t text;
begin
  foreach t in array array['sales', 'stock_items', 'stock_movements', 'productions', 'suppliers', 'supplier_purchases'] loop
    execute format('create policy %I on public.%I as restrictive for insert to authenticated with check ((select public.has_module(''PACK_VENTAS'')))', t || '_pack_insert', t);
    execute format('create policy %I on public.%I as restrictive for update to authenticated using ((select public.has_module(''PACK_VENTAS'')))', t || '_pack_update', t);
    execute format('create policy %I on public.%I as restrictive for delete to authenticated using ((select public.has_module(''PACK_VENTAS'')))', t || '_pack_delete', t);
  end loop;
end $$;
