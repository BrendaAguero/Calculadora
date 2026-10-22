'use server';

import { parseAR } from '@/lib/num';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAccessSnapshot, hasFeature } from '@/lib/access/permissions';
import { planProduction } from './compute';

const text = (formData: FormData, key: string) => String(formData.get(key) ?? '').trim();

// Producción es parte de Personal Plus. Se recalcula todo en el servidor: no se confía en lo que muestra la pantalla.
export async function registerProduction(formData: FormData) {
  const productId = text(formData, 'product_id');
  const formulaId = text(formData, 'formula_id') || null;
  const quantity = parseAR(text(formData, 'quantity'));
  const deduct = text(formData, 'deduct') === '1';
  const addOutput = formData.get('add_output') === 'on';
  const notes = text(formData, 'notes');
  const back = `/produccion/nueva?producto=${productId}&formula=${formulaId ?? ''}&cantidad=${text(formData, 'quantity')}`;
  const fail = (message: string): never => redirect(`${back}&error=${encodeURIComponent(message.slice(0, 300))}`);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const snapshot = await getAccessSnapshot();
  if (!snapshot || !hasFeature(snapshot, 'PRODUCCION')) redirect('/produccion');
  if (!Number.isFinite(quantity) || quantity <= 0) fail('Escribí cuántas piezas produjiste.');

  const { plan, error } = await planProduction(supabase, user.id, productId, formulaId, quantity);
  if (error || !plan) fail(error ?? 'No se pudo calcular la producción.');

  // Solo se registran (y descuentan) los materiales con unidad compatible con la del material.
  const items = plan!.lines.filter((line) => line.convertible).map((line) => ({ material_id: line.materialId, quantity: line.quantity, unit: line.unit, unit_cost: line.unitCost ?? 0, total_cost: line.totalCost }));
  const { data: id, error: saveError } = await supabase.rpc('register_production', {
    p: { product_id: plan!.productId, activity_id: plan!.activityId, formula_id: plan!.formulaId, formula_version_id: plan!.formulaVersionId, quantity, total_cost: plan!.totalCost, deduct, add_output: addOutput, notes, items },
  });
  if (saveError) fail(`No se pudo registrar: ${saveError.message}`);

  revalidatePath('/produccion');
  revalidatePath('/stock');
  redirect(`/produccion/${id}?ok=1`);
}
