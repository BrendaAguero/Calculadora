import { createClient } from '@/lib/supabase/server';

type Supabase = Awaited<ReturnType<typeof createClient>>;
const one = <T,>(value: T | T[] | null | undefined) => (Array.isArray(value) ? value[0] : value);

export type StockRow = {
  id: string;
  type: 'material' | 'finished_product';
  targetId: string;
  name: string;
  archived: boolean;
  quantity: number;
  unit: string;
  minimum: number | null;
  unitValue: number | null; // costo por unidad del stock
  valueSource: string | null;
};

// Valor al costo: materiales con su precio actual; productos con el costo por pieza de su último cálculo guardado.
export async function loadStock(supabase: Supabase, userId: string, ids?: string[]) {
  let query = supabase
    .from('stock_items')
    .select('id,stock_type,material_id,product_id,quantity,unit,minimum_quantity,materials(name,status,current_price_id),products(name,status)')
    .eq('user_id', userId);
  if (ids) query = query.in('id', ids);
  const { data, error } = await query;
  if (error) return { rows: [] as StockRow[], error: error.message };

  const priceIds = (data ?? []).map((row) => one(row.materials)?.current_price_id).filter((id): id is string => Boolean(id));
  const productIds = (data ?? []).map((row) => row.product_id).filter((id): id is string => Boolean(id));
  const [prices, calculations, productions] = await Promise.all([
    priceIds.length ? supabase.from('material_prices').select('id,unit_cost').in('id', priceIds) : Promise.resolve({ data: [] as { id: string; unit_cost: number }[] }),
    productIds.length
      ? supabase.from('calculations').select('product_id,unit_cost,created_at').eq('user_id', userId).in('product_id', productIds).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as { product_id: string; unit_cost: number; created_at: string }[] }),
    productIds.length
      ? supabase.from('productions').select('product_id,total_cost,quantity,produced_at').eq('user_id', userId).in('product_id', productIds).order('produced_at', { ascending: false })
      : Promise.resolve({ data: [] as { product_id: string; total_cost: number; quantity: number; produced_at: string }[] }),
  ]);
  const priceById = new Map((prices.data ?? []).map((p) => [p.id, Number(p.unit_cost)]));
  // Costo por pieza de un producto: el más reciente entre su último cálculo y su última producción.
  const lastCost = new Map<string, { cost: number; at: string; source: string }>();
  for (const c of calculations.data ?? []) if (c.product_id && !lastCost.has(c.product_id)) lastCost.set(c.product_id, { cost: Number(c.unit_cost), at: c.created_at, source: 'costo por pieza del último cálculo' });
  const seen = new Set<string>();
  for (const p of productions.data ?? []) {
    if (seen.has(p.product_id) || !(Number(p.quantity) > 0) || !(Number(p.total_cost) > 0)) continue;
    seen.add(p.product_id);
    const current = lastCost.get(p.product_id);
    if (!current || p.produced_at > current.at) lastCost.set(p.product_id, { cost: Number(p.total_cost) / Number(p.quantity), at: p.produced_at, source: 'costo por pieza de la última producción' });
  }

  const rows: StockRow[] = (data ?? []).map((row) => {
    const material = one(row.materials);
    const product = one(row.products);
    const isMaterial = row.stock_type === 'material';
    const unitValue = isMaterial
      ? (material?.current_price_id ? priceById.get(material.current_price_id) ?? null : null)
      : (row.product_id ? lastCost.get(row.product_id)?.cost ?? null : null);
    return {
      id: row.id,
      type: row.stock_type as StockRow['type'],
      targetId: (isMaterial ? row.material_id : row.product_id) as string,
      name: (isMaterial ? material?.name : product?.name) ?? 'Sin nombre',
      archived: (isMaterial ? material?.status : product?.status) === 'archived',
      quantity: Number(row.quantity),
      unit: row.unit,
      minimum: row.minimum_quantity == null ? null : Number(row.minimum_quantity),
      unitValue,
      valueSource: unitValue == null ? null : isMaterial ? 'precio actual del material' : lastCost.get(row.product_id as string)?.source ?? null,
    };
  });
  rows.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  return { rows, error: null };
}

export const isLow = (row: StockRow) => row.minimum !== null && row.quantity <= row.minimum;
