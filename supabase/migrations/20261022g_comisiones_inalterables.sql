-- Candados para el dinero de las afiliadas (además de que nadie puede escribir estas tablas directamente):
-- 1) Una comisión creada no cambia de monto, porcentaje, venta ni afiliada; solo avanza de estado.
-- 2) Un retiro no cambia de monto ni de afiliada.
-- 3) No se pueden borrar comisiones ni retiros (queda todo el historial).
-- 4) Para marcar un retiro como pagado, su monto tiene que ser igual a la suma de sus comisiones.

create or replace function public.commissions_guard() returns trigger
language plpgsql set search_path to 'public'
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Las comisiones no se borran: se anulan.';
  end if;
  if new.affiliate_id is distinct from old.affiliate_id
     or new.purchase_id is distinct from old.purchase_id
     or new.personal_order_id is distinct from old.personal_order_id
     or new.percentage is distinct from old.percentage
     or new.gross_sale_amount is distinct from old.gross_sale_amount
     or new.commission_amount is distinct from old.commission_amount
     or new.created_at is distinct from old.created_at then
    raise exception 'El monto de una comisión no se puede modificar.';
  end if;
  -- Una comisión pagada o anulada ya no cambia.
  if old.status in ('paid', 'reversed', 'canceled') and new.status is distinct from old.status then
    raise exception 'Esa comisión ya está cerrada (%).', old.status;
  end if;
  return new;
end;
$$;
create trigger commissions_guard before update or delete on public.commissions
  for each row execute function public.commissions_guard();

create or replace function public.withdrawals_guard() returns trigger
language plpgsql set search_path to 'public'
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Los retiros no se borran: se rechazan.';
  end if;
  if new.affiliate_id is distinct from old.affiliate_id or new.amount is distinct from old.amount then
    raise exception 'El monto de un retiro no se puede modificar.';
  end if;
  if new.status = 'paid' and old.status <> 'paid'
     and new.amount <> (select coalesce(sum(commission_amount), 0) from commissions where withdrawal_id = new.id) then
    raise exception 'El monto del retiro no coincide con sus comisiones: revisalo antes de pagar.';
  end if;
  return new;
end;
$$;
create trigger withdrawals_guard before update or delete on public.withdrawals
  for each row execute function public.withdrawals_guard();
