'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { saveCalculation } from '@/app/calcular/actions';
import { num } from '@/app/calcular/compute';
import { inputsFromCalculation, loadCalculation } from './data';

// Recalcular con precios actuales crea un cálculo NUEVO; el original no se modifica.
export async function recalculate(formData: FormData) {
  const id = String(formData.get('calculation_id') ?? '');
  const fail = (message: string): never => redirect(`/historial/${id}?error=${encodeURIComponent(message.slice(0, 300))}`);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { calculation, items, error } = await loadCalculation(supabase, user.id, id);
  if (error) fail(`No se pudo leer el cálculo: ${error}`);
  if (!calculation) fail('No se encontró el cálculo.');
  const { inputs } = inputsFromCalculation(calculation!, items);

  // El precio del yeso se actualiza solo si salió de un material (saveCalculation lee su precio actual).
  // Si el costo del molde se calculó desde el molde guardado, se recalcula con su costo y usos actuales.
  if (inputs.moldCostAuto && inputs.moldId) {
    const { data: mold } = await supabase.from('molds').select('cost,estimated_uses').eq('id', inputs.moldId).eq('user_id', user.id).maybeSingle();
    if (mold?.cost && mold.estimated_uses) inputs.moldCost = String((Number(mold.cost) / mold.estimated_uses) * (Math.max(1, Math.floor(num(inputs.quantity))) || 1));
  }

  // Si el material, el molde, la fórmula o el producto ya no existen, se recalcula sin ellos.
  for (const [key, table] of [['materialId', 'materials'], ['moldId', 'molds'], ['formulaId', 'formulas'], ['productId', 'products']] as const) {
    if (!inputs[key]) continue;
    const { data } = await supabase.from(table).select('id').eq('id', inputs[key]).eq('user_id', user.id).maybeSingle();
    if (!data) inputs[key] = '';
  }

  const result = await saveCalculation({ ...inputs, recalculatedFrom: id });
  if (!result.ok) fail(`No se pudo recalcular: ${result.error}`);

  revalidatePath('/historial');
  redirect(`/historial/${(result as { id: string }).id}?recalculado=1`);
}
