'use server';

import { createClient } from '@/lib/supabase/server';
import { canUseActivity } from '@/lib/access/activities';
import { computeMix, mergeSettings, mixByCode, num, type MixInput, type MixSettings } from '@/lib/mixes';

type Result = { ok: true; id?: string } | { ok: false; error: string };
// Guarda las proporciones y precios propios de la usuaria para esta actividad.
export async function saveMixSettings(code: string, settings: MixSettings): Promise<Result> {
  const def = mixByCode(code);
  if (!def) return { ok: false, error: 'Actividad desconocida.' };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Iniciá sesión para guardar.' };
  const clean = mergeSettings(def, settings);
  const { error } = await supabase.from('activity_settings').upsert({ user_id: user.id, activity_code: code, settings: clean, updated_at: new Date().toISOString() });
  return error ? { ok: false, error: `No se pudo guardar: ${error.message}` } : { ok: true };
}

// Vuelve a las proporciones de fábrica de esta actividad, conservando los precios cargados.
export async function resetMixSettings(code: string, prices: Record<string, string>): Promise<Result> {
  const def = mixByCode(code);
  if (!def) return { ok: false, error: 'Actividad desconocida.' };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Iniciá sesión para guardar.' };
  const { error } = await supabase.from('activity_settings').upsert({ user_id: user.id, activity_code: code, settings: { prices: mergeSettings(def, { prices }).prices }, updated_at: new Date().toISOString() });
  return error ? { ok: false, error: `No se pudo guardar: ${error.message}` } : { ok: true };
}

export async function saveMixCalculation(code: string, settings: MixSettings, input: MixInput): Promise<Result> {
  const def = mixByCode(code);
  if (!def) return { ok: false, error: 'Actividad desconocida.' };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Iniciá sesión para guardar el cálculo.' };
  const access = await canUseActivity(supabase, user.id, code);
  if (!access.allowed || !access.activityId) return { ok: false, error: `La calculadora de ${def.name} requiere la actividad ${def.name} o Mensualidad Plus.` };

  const clean = mergeSettings(def, settings);
  const result = computeMix(clean, input);
  if (!(result.perPiece > 0)) return { ok: false, error: 'Indicá los gramos por pieza (o el agua que entra en el molde).' };
  if (input.priceMethod === 'manual' && !(num(input.manualPrice) > 0)) return { ok: false, error: 'Indicá el precio manual.' };

  const { data: calculation, error } = await supabase
    .from('calculations')
    .insert({
      user_id: user.id,
      activity_id: access.activityId,
      calculation_mode: 'standard',
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

  // Cada línea congela nombre, cantidad y precio de hoy. La primera guarda además la receta completa.
  const rows = result.items.map((item, index) => ({
    calculation_id: calculation.id,
    cost_type: item.cost_type,
    material_id: null,
    name_snapshot: item.name,
    quantity: item.quantity,
    unit: item.unit,
    unit_cost_snapshot: item.unit_cost,
    total_cost: item.total_cost,
    metadata: index === 0
      ? { kind: 'mix', activity: code, per_piece_g: result.perPiece, total_mix_g: result.total, amounts: result.amounts.map(a => ({ label: a.label, grams: a.grams, ml: a.ml })), pigment_g: result.pigment, settings: clean, inputs: input }
      : { key: item.key },
  }));
  const { error: itemsError } = await supabase.from('calculation_items').insert(rows);
  if (itemsError) {
    await supabase.from('calculations').delete().eq('id', calculation.id).eq('user_id', user.id);
    return { ok: false, error: `No se pudo guardar el detalle del cálculo: ${itemsError.message}` };
  }
  return { ok: true, id: calculation.id };
}
