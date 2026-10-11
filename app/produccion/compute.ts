import { createClient } from '@/lib/supabase/server';
import { convert } from '@/app/stock/constants';
import { INGREDIENT_LABELS } from '@/app/formulas/constants';

type Supabase = Awaited<ReturnType<typeof createClient>>;
const one = <T,>(value: T | T[] | null | undefined) => (Array.isArray(value) ? value[0] : value);

export type PlanLine = {
  materialId: string;
  name: string;
  quantity: number; // en la unidad del material (o la de la fórmula si no se pudo convertir)
  unit: string;
  convertible: boolean;
  unitCost: number | null;
  totalCost: number;
  stock: number | null; // null = no está en el stock
  missing: number; // cuánto falta (0 si alcanza o no se lleva stock)
};

export type ProductionPlan = {
  productId: string;
  productName: string;
  activityId: string;
  formulaId: string | null;
  formulaName: string | null;
  formulaVersionId: string | null;
  versionNumber: number | null;
  yieldQuantity: number;
  quantity: number;
  lines: PlanLine[];
  others: { label: string; quantity: number; unit: string }[]; // agua y otros sin material
  totalCost: number;
  missingPrices: number;
};

// Calcula los materiales de una producción a partir de la fórmula (versión actual) del producto.
// Rendimiento = piezas por tanda; cada ingrediente se multiplica por cantidad ÷ rendimiento.
export async function planProduction(supabase: Supabase, userId: string, productId: string, formulaId: string | null, quantity: number): Promise<{ plan: ProductionPlan | null; error: string | null }> {
  const { data: product } = await supabase
    .from('products')
    .select('id,name,activity_id,product_formulas(formula_id,is_default)')
    .eq('id', productId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!product) return { plan: null, error: 'No se encontró el producto.' };

  const linked = product.product_formulas ?? [];
  const chosen = formulaId || linked.find((f) => f.is_default)?.formula_id || linked[0]?.formula_id || null;
  const base: ProductionPlan = { productId, productName: product.name, activityId: product.activity_id, formulaId: null, formulaName: null, formulaVersionId: null, versionNumber: null, yieldQuantity: 1, quantity, lines: [], others: [], totalCost: 0, missingPrices: 0 };
  if (!chosen) return { plan: base, error: null };

  const { data: formula } = await supabase.from('formulas').select('id,name,current_version_id').eq('id', chosen).eq('user_id', userId).maybeSingle();
  if (!formula?.current_version_id) return { plan: base, error: formula ? 'La fórmula no tiene una versión guardada.' : 'No se encontró la fórmula.' };

  const [{ data: version }, { data: items, error: itemsError }] = await Promise.all([
    supabase.from('formula_versions').select('id,version_number,yield_quantity').eq('id', formula.current_version_id).maybeSingle(),
    supabase.from('formula_items').select('ingredient_type,material_id,quantity,unit,materials(name,default_unit,current_price_id)').eq('formula_version_id', formula.current_version_id),
  ]);
  if (itemsError) return { plan: null, error: `No se pudieron leer los ingredientes: ${itemsError.message}` };

  const yieldQuantity = Number(version?.yield_quantity) > 0 ? Number(version!.yield_quantity) : 1;
  const factor = quantity / yieldQuantity;
  const materialItems = (items ?? []).filter((item) => item.material_id);
  const priceIds = materialItems.map((item) => one(item.materials)?.current_price_id).filter((id): id is string => Boolean(id));
  const materialIds = materialItems.map((item) => item.material_id as string);
  const [{ data: prices }, { data: stock }] = await Promise.all([
    priceIds.length ? supabase.from('material_prices').select('id,unit_cost').in('id', priceIds) : Promise.resolve({ data: [] as { id: string; unit_cost: number }[] }),
    materialIds.length ? supabase.from('stock_items').select('material_id,quantity').eq('user_id', userId).in('material_id', materialIds) : Promise.resolve({ data: [] as { material_id: string; quantity: number }[] }),
  ]);
  const priceById = new Map((prices ?? []).map((p) => [p.id, Number(p.unit_cost)]));
  const stockByMaterial = new Map((stock ?? []).map((s) => [s.material_id, Number(s.quantity)]));

  // Si un material aparece dos veces en la fórmula, se suma en una sola línea.
  const lines = new Map<string, PlanLine>();
  for (const item of materialItems) {
    const material = one(item.materials);
    const raw = Number(item.quantity) * factor;
    const target = material?.default_unit ?? item.unit;
    const converted = convert(raw, item.unit, target);
    const unitCost = material?.current_price_id ? priceById.get(material.current_price_id) ?? null : null;
    const key = item.material_id as string;
    const previous = lines.get(key);
    const qtyInUnit = converted ?? raw;
    const line: PlanLine = previous ?? { materialId: key, name: material?.name ?? 'Material', quantity: 0, unit: converted === null ? item.unit : target, convertible: converted !== null, unitCost, totalCost: 0, stock: stockByMaterial.has(key) ? stockByMaterial.get(key)! : null, missing: 0 };
    line.quantity += qtyInUnit;
    lines.set(key, line);
  }
  for (const line of lines.values()) {
    line.totalCost = line.unitCost != null && line.convertible ? line.quantity * line.unitCost : 0;
    line.missing = line.stock !== null && line.convertible ? Math.max(0, line.quantity - line.stock) : 0;
  }
  const others = (items ?? []).filter((item) => !item.material_id).map((item) => ({ label: INGREDIENT_LABELS[item.ingredient_type] ?? item.ingredient_type, quantity: Number(item.quantity) * factor, unit: item.unit }));
  const list = [...lines.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));

  return {
    plan: {
      ...base,
      formulaId: formula.id,
      formulaName: formula.name,
      formulaVersionId: version?.id ?? null,
      versionNumber: version?.version_number ?? null,
      yieldQuantity,
      lines: list,
      others,
      totalCost: list.reduce((sum, line) => sum + line.totalCost, 0),
      missingPrices: list.filter((line) => line.unitCost == null).length,
    },
    error: null,
  };
}
