import { parseAR } from '@/lib/num';
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { PAYMENT_METHODS, productUnitCost, saleTotals } from './compute';

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type SaleInput = {
  productId: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  commissionPct: string;
  date: string;
  paymentMethod: string;
  customerName: string;
  deduct: boolean;
};

const number = (value: string) => parseAR((value || '0'));

// Registra una venta (la usan el formulario y la subida de ventas hechas sin conexión).
// El costo se vuelve a leer en el servidor; precio, descuento y comisión son los que escribió la persona.
export async function recordSale(supabase: Supabase, userId: string, input: SaleInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const quantity = number(input.quantity);
  const unitPrice = number(input.unitPrice);
  const discount = number(input.discount);
  const commissionPct = number(input.commissionPct);
  const payment = (input.paymentMethod ?? '').trim();

  if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, error: 'La cantidad tiene que ser mayor que cero.' };
  if (!Number.isFinite(unitPrice) || unitPrice < 0) return { ok: false, error: 'Escribí el precio por unidad.' };
  if (!Number.isFinite(discount) || discount < 0 || discount > quantity * unitPrice) return { ok: false, error: 'El descuento no puede ser negativo ni mayor que el subtotal.' };
  if (!Number.isFinite(commissionPct) || commissionPct < 0 || commissionPct > 100) return { ok: false, error: 'La comisión va de 0 a 100 %.' };
  if (payment && !PAYMENT_METHODS.includes(payment)) return { ok: false, error: 'Elegí un medio de pago de la lista.' };
  if (input.date && !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { ok: false, error: 'La fecha no es válida.' };

  const { data: product } = await supabase.from('products').select('id').eq('id', input.productId).eq('user_id', userId).maybeSingle();
  if (!product) return { ok: false, error: 'El producto no existe o no es tuyo.' };

  const cost = await productUnitCost(supabase, userId, input.productId);
  const totals = saleTotals(quantity, unitPrice, cost?.cost ?? 0, discount, commissionPct);
  const saleDate = input.date ? new Date(`${input.date}T12:00:00-03:00`).toISOString() : new Date().toISOString();

  const { error } = await supabase.rpc('register_sale', {
    p: {
      product_id: input.productId, calculation_id: cost?.calculationId ?? null, quantity, unit_price: unitPrice, unit_cost: cost?.cost ?? 0,
      total_cost: totals.totalCost, subtotal: totals.subtotal, discount, commission: totals.commission, total: totals.total,
      net_income: totals.netIncome, sale_date: saleDate, customer_name: (input.customerName ?? '').trim().slice(0, 120), payment_method: payment,
      deduct: input.deduct,
    },
  });
  if (error) return { ok: false, error: `No se pudo registrar: ${error.message}` };
  return { ok: true };
}
