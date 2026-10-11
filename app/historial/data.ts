import { createClient } from '@/lib/supabase/server';
import type { SaveInput } from '@/app/calcular/actions';
import type { CostType, Mode } from '@/app/calcular/compute';

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type CalcItemRow = { id: string; cost_type: string; name_snapshot: string; quantity: number | null; unit: string | null; unit_cost_snapshot: number | null; total_cost: number; material_id: string | null; metadata: Record<string, unknown> | null };

export const MODE_LABELS: Record<string, string> = { easy: 'Fácil', standard: 'Estándar', personalized: 'Personalizado' };

const one = <T,>(value: T | T[] | null | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

export async function loadCalculation(supabase: Supabase, userId: string, id: string) {
  const { data: calculation, error } = await supabase
    .from('calculations')
    .select('id,created_at,calculation_mode,quantity,total_cost,unit_cost,suggested_price,profit_per_unit,margin_percentage,product_id,mold_id,formula_id,formula_version_id,products(name),molds(name),formulas(name),formula_versions(version_number)')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !calculation) return { calculation: null, items: [] as CalcItemRow[], error: error?.message ?? null };

  const { data: items, error: itemsError } = await supabase
    .from('calculation_items')
    .select('id,cost_type,name_snapshot,quantity,unit,unit_cost_snapshot,total_cost,material_id,metadata')
    .eq('calculation_id', id)
    .order('created_at');

  return {
    calculation: {
      ...calculation,
      productName: one(calculation.products)?.name ?? null,
      moldName: one(calculation.molds)?.name ?? null,
      formulaName: one(calculation.formulas)?.name ?? null,
      formulaVersion: one(calculation.formula_versions)?.version_number ?? null,
    },
    items: (items ?? []) as CalcItemRow[],
    error: itemsError?.message ?? null,
  };
}

const EXTRA_KEYS: Partial<Record<CostType, keyof SaveInput>> = { mold: 'moldCost', packaging: 'packaging', labor: 'labor', electricity: 'electricity', gas: 'gas', commission: 'commissions' };

// Datos de entrada del cálculo. Los cálculos nuevos los guardan completos; para los anteriores se
// reconstruyen a partir de sus líneas congeladas (precio como % de ganancia sobre el costo).
export function inputsFromCalculation(
  calculation: { calculation_mode: string; quantity: number; unit_cost: number; suggested_price: number | null; product_id: string | null; mold_id: string | null; formula_id: string | null },
  items: CalcItemRow[],
): { inputs: SaveInput; reconstructed: boolean } {
  const plaster = items.find(item => item.metadata?.kind === 'plaster');
  const saved = plaster?.metadata?.inputs as SaveInput | undefined;
  if (saved) return { inputs: saved, reconstructed: false };

  const meta = plaster?.metadata ?? {};
  const pieces = Number(calculation.quantity) || 1;
  const plasterTotal = Number(plaster?.quantity ?? 0);
  const waste = items.find(item => item.cost_type === 'waste');
  const unitCost = Number(calculation.unit_cost);
  const price = Number(calculation.suggested_price ?? 0);

  const inputs: SaveInput = {
    mode: (['easy', 'standard', 'personalized'].includes(calculation.calculation_mode) ? calculation.calculation_mode : 'easy') as Mode,
    quantity: String(pieces),
    moldWater: '',
    plasterPerPiece: String(Number(meta.plaster_per_piece_g ?? (plasterTotal / pieces)) || ''),
    waterPercentage: meta.water_percentage != null ? String(meta.water_percentage) : '',
    plasterPriceKg: String(Number(meta.price_per_kg ?? Number(plaster?.unit_cost_snapshot ?? 0) * 1000) || ''),
    waste: waste && plasterTotal > 0 ? String(Math.round((Number(waste.quantity) / plasterTotal) * 10000) / 100) : '0',
    moldCost: '', packaging: '', labor: '', electricity: '', gas: '', commissions: '', other: '',
    priceMethod: 'percentage',
    profitPercentage: unitCost > 0 ? String(Math.round((price / unitCost - 1) * 10000) / 100) : '0',
    fixedProfit: '',
    manualPrice: '',
    moldId: calculation.mold_id ?? '',
    formulaId: calculation.formula_id ?? '',
    materialId: plaster?.material_id ?? '',
    productId: calculation.product_id ?? '',
    moldCostAuto: false,
  };
  for (const item of items) {
    const key = item.cost_type === 'other' && item.metadata?.kind !== 'plaster' ? 'other' : EXTRA_KEYS[item.cost_type as CostType];
    if (key) (inputs as Record<string, unknown>)[key] = String(Number(item.total_cost));
  }
  return { inputs, reconstructed: true };
}
