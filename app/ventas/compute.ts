import { createClient } from '@/lib/supabase/server';

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const PAYMENT_METHODS = ['Efectivo', 'Transferencia', 'Mercado Pago', 'Tarjeta', 'Otro'];

// Precio sugerido: la promoción vigente, o el mayorista si la cantidad entra en su rango, o el minorista.
export async function suggestedPrice(supabase: Supabase, productId: string, quantity: number) {
  const now = new Date().toISOString();
  const { data } = await supabase
    .from('product_prices')
    .select('price_type,quantity_min,quantity_max,price,valid_from,valid_until')
    .eq('product_id', productId)
    .lte('valid_from', now)
    .or(`valid_until.is.null,valid_until.gt.${now}`)
    .order('valid_from', { ascending: false });
  const fits = (p: { quantity_min: number | null; quantity_max: number | null }) =>
    (p.quantity_min == null || quantity >= Number(p.quantity_min)) && (p.quantity_max == null || quantity <= Number(p.quantity_max));
  const prices = (data ?? []).filter(fits);
  const pick = prices.find((p) => p.price_type === 'promotional') ?? prices.find((p) => p.price_type === 'wholesale' && p.quantity_min != null) ?? prices.find((p) => p.price_type === 'retail') ?? prices[0];
  return pick ? { price: Number(pick.price), type: pick.price_type as string } : null;
}

// Costo por pieza: el más reciente entre el último cálculo guardado y la última producción del producto.
export async function productUnitCost(supabase: Supabase, userId: string, productId: string) {
  const [{ data: calculation }, { data: production }] = await Promise.all([
    supabase.from('calculations').select('id,unit_cost,created_at').eq('user_id', userId).eq('product_id', productId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('productions').select('total_cost,quantity,produced_at').eq('user_id', userId).eq('product_id', productId).order('produced_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const fromProduction = production && Number(production.quantity) > 0 && Number(production.total_cost) > 0
    ? { cost: Number(production.total_cost) / Number(production.quantity), at: production.produced_at, source: 'última producción', calculationId: null }
    : null;
  const fromCalculation = calculation ? { cost: Number(calculation.unit_cost), at: calculation.created_at, source: 'último cálculo', calculationId: calculation.id as string } : null;
  if (fromProduction && (!fromCalculation || fromProduction.at > fromCalculation.at)) return fromProduction;
  return fromCalculation;
}

// Ganancia = precio de venta − costo − descuentos − comisiones (la misma cuenta se usa en la pantalla).
export { saleTotalsClient as saleTotals } from './nueva/totals';
