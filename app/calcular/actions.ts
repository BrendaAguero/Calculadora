'use server';

import { createClient } from '@/lib/supabase/server';
import { getOwnedActivities } from '@/lib/access/activities';
import { compute, num, type CalcInput } from './compute';

export type SaveInput = CalcInput & { moldId: string; formulaId: string; materialId: string };
export type SaveResult = { ok: true } | { ok: false; error: string };

// Precio por kg a partir del costo unitario del material (que está expresado en su unidad de referencia).
const PER_KG: Record<string, number> = { mg: 1_000_000, g: 1000, kg: 1 };

export async function saveCalculation(input: SaveInput): Promise<SaveResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Iniciá sesión para guardar el cálculo.' };

  const { activities, error: activitiesError } = await getOwnedActivities(supabase, user.id);
  if (activitiesError) return { ok: false, error: `No se pudieron verificar tus actividades: ${activitiesError}` };
  const yeso = activities.find(activity => activity.code === 'YESO');
  if (!yeso) return { ok: false, error: 'La calculadora de Yeso requiere tener la actividad Yeso.' };

  const values: CalcInput = { ...input };
  let materialName: string | null = null;

  // Con un material elegido, se usa su precio actual de la base (no el que mande el navegador) y queda congelado en el cálculo.
  if (input.materialId) {
    const { data: material } = await supabase.from('materials').select('id,name,default_unit,current_price_id').eq('id', input.materialId).eq('user_id', user.id).maybeSingle();
    if (!material) return { ok: false, error: 'El material elegido no existe o no es tuyo.' };
    const factor = PER_KG[material.default_unit];
    if (!factor) return { ok: false, error: `«${material.name}» se mide en ${material.default_unit}; para el yeso elegí un material que se mida en peso.` };
    if (!material.current_price_id) return { ok: false, error: `«${material.name}» no tiene precio cargado.` };
    const { data: price } = await supabase.from('material_prices').select('unit_cost').eq('id', material.current_price_id).maybeSingle();
    if (!price) return { ok: false, error: `No se pudo leer el precio de «${material.name}».` };
    values.plasterPriceKg = String(Number(price.unit_cost) * factor);
    materialName = material.name;
  }

  let moldId: string | null = null;
  if (input.moldId) {
    const { data: mold } = await supabase.from('molds').select('id').eq('id', input.moldId).eq('user_id', user.id).maybeSingle();
    if (!mold) return { ok: false, error: 'El molde elegido no existe o no es tuyo.' };
    moldId = mold.id;
  }

  let formulaId: string | null = null;
  let formulaVersionId: string | null = null;
  if (input.formulaId) {
    const { data: formula } = await supabase.from('formulas').select('id,current_version_id').eq('id', input.formulaId).eq('user_id', user.id).maybeSingle();
    if (!formula) return { ok: false, error: 'La fórmula elegida no existe o no es tuya.' };
    formulaId = formula.id;
    formulaVersionId = formula.current_version_id;
  }

  const result = compute(values);
  if (!(result.plaster > 0)) return { ok: false, error: 'Indicá los gramos de yeso por pieza (o el agua que entra en el molde).' };
  if (input.priceMethod === 'manual' && !(num(input.manualPrice) > 0)) return { ok: false, error: 'Indicá el precio manual.' };

  const { data: calculation, error } = await supabase
    .from('calculations')
    .insert({
      user_id: user.id,
      activity_id: yeso.id,
      mold_id: moldId,
      formula_id: formulaId,
      formula_version_id: formulaVersionId,
      calculation_mode: values.mode,
      quantity: result.pieces,
      total_cost: result.totalCost,
      unit_cost: result.unitCost,
      suggested_price: result.price,
      profit_per_unit: result.profit,
      margin_percentage: result.margin,
    })
    .select('id')
    .single();
  if (error || !calculation) return { ok: false, error: `No se pudo guardar el cálculo: ${error?.message}` };

  // Cada línea congela nombre, cantidad y precio usados hoy: cambiar un precio después no altera este cálculo.
  const rows = result.items.map(item => {
    const isPlaster = item.cost_type === 'material';
    const fromMaterial = isPlaster && Boolean(input.materialId);
    return {
      calculation_id: calculation.id,
      // Sin material elegido, el yeso con precio cargado a mano se guarda como «otro», porque «material» exige un material.
      cost_type: isPlaster && !fromMaterial ? 'other' : item.cost_type,
      material_id: fromMaterial ? input.materialId : null,
      name_snapshot: isPlaster ? (materialName ?? 'Yeso (precio cargado a mano)') : item.name,
      quantity: item.quantity,
      unit: item.unit,
      unit_cost_snapshot: item.unit_cost,
      total_cost: item.total_cost,
      metadata: isPlaster
        ? { kind: 'plaster', plaster_per_piece_g: result.plaster, water_percentage: result.waterPercentage, water_total_g: result.waterTotal, price_per_kg: num(values.plasterPriceKg) }
        : null,
    };
  });
  const { error: itemsError } = await supabase.from('calculation_items').insert(rows);
  if (itemsError) {
    // Un cálculo sin su detalle no sirve como historial: se deshace.
    await supabase.from('calculations').delete().eq('id', calculation.id).eq('user_id', user.id);
    return { ok: false, error: `No se pudo guardar el detalle del cálculo: ${itemsError.message}` };
  }

  return { ok: true };
}
