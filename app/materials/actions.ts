'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ownsActivity } from '@/lib/access/activities';
import { createLimitError } from '@/lib/access/permissions';

const UNIT_FACTORS: Record<string, { group: string; factor: number }> = {
  g: { group: 'mass', factor: 1 },
  kg: { group: 'mass', factor: 1000 },
  mg: { group: 'mass', factor: 0.001 },
  ml: { group: 'volume', factor: 1 },
  l: { group: 'volume', factor: 1000 },
  unidad: { group: 'count', factor: 1 },
  unidades: { group: 'count', factor: 1 },
};

function number(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function unitCost(purchasePrice: number, purchaseQuantity: number, purchaseUnit: string, targetUnit: string) {
  if (purchasePrice < 0 || purchaseQuantity <= 0) return 0;
  if (purchaseUnit === targetUnit) return purchasePrice / purchaseQuantity;

  const from = UNIT_FACTORS[purchaseUnit];
  const to = UNIT_FACTORS[targetUnit];
  if (!from || !to || from.group !== to.group) return purchasePrice / purchaseQuantity;

  const quantityInTarget = (purchaseQuantity * from.factor) / to.factor;
  return purchasePrice / quantityInTarget;
}

async function userId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, id: user.id };
}

// Vacío = material compartido entre todas las actividades de la usuaria; si no, debe ser una actividad suya.
async function activityError(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, activityId: string | null) {
  if (!activityId) return null;
  return (await ownsActivity(supabase, userId, activityId)) ? null : 'Elegí una de tus actividades o «Compartido».';
}

export async function createMaterial(formData: FormData) {
  const { supabase, id } = await userId();
  const name = String(formData.get('name') ?? '').trim();
  const defaultUnit = String(formData.get('default_unit') ?? 'g');
  const activityId = String(formData.get('activity_id') ?? '').trim() || null;
  const purchasePrice = number(formData.get('purchase_price'));
  const purchaseQuantity = number(formData.get('purchase_quantity'));
  const purchaseUnit = String(formData.get('purchase_unit') ?? defaultUnit);

  if (!name || purchaseQuantity <= 0 || purchasePrice < 0) throw new Error('Datos de material inválidos.');
  const invalidActivity = await activityError(supabase, id, activityId);
  if (invalidActivity) redirect(`/materials/new?error=${encodeURIComponent(invalidActivity)}`);
  const limitError = await createLimitError(supabase, id, 'materials');
  if (limitError) redirect(`/materials/new?error=${encodeURIComponent(limitError)}`);

  const { data: material, error } = await supabase
    .from('materials')
    .insert({ user_id: id, activity_id: activityId, name, default_unit: defaultUnit, status: 'active' })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  const cost = unitCost(purchasePrice, purchaseQuantity, purchaseUnit, defaultUnit);
  const { data: price, error: priceError } = await supabase
    .from('material_prices')
    .insert({
      material_id: material.id,
      purchase_price: purchasePrice,
      purchase_quantity: purchaseQuantity,
      purchase_unit: purchaseUnit,
      unit_cost: cost,
      currency: 'ARS',
      is_estimated: false,
      valid_from: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (priceError) throw new Error(priceError.message);

  const { error: updateError } = await supabase.from('materials').update({ current_price_id: price.id }).eq('id', material.id).eq('user_id', id);
  if (updateError) throw new Error(updateError.message);

  revalidatePath('/materials');
  redirect('/materials');
}

export async function updateMaterial(formData: FormData) {
  const { supabase, id } = await userId();
  const materialId = String(formData.get('material_id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const defaultUnit = String(formData.get('default_unit') ?? 'g');
  const activityId = String(formData.get('activity_id') ?? '').trim() || null;

  if (!materialId || !name) throw new Error('Datos de material inválidos.');
  // Se acepta la actividad que el material ya tenía aunque la usuaria ya no la tenga, para no perderla al guardar.
  const { data: existing } = await supabase.from('materials').select('activity_id').eq('id', materialId).eq('user_id', id).maybeSingle();
  const invalidActivity = activityId === existing?.activity_id ? null : await activityError(supabase, id, activityId);
  if (invalidActivity) redirect(`/materials/${materialId}?error=${encodeURIComponent(invalidActivity)}`);

  const { error } = await supabase.from('materials').update({ name, default_unit: defaultUnit, activity_id: activityId }).eq('id', materialId).eq('user_id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/materials');
  redirect('/materials');
}

export async function addMaterialPrice(formData: FormData) {
  const { supabase, id } = await userId();
  const materialId = String(formData.get('material_id') ?? '');
  const purchasePrice = number(formData.get('purchase_price'));
  const purchaseQuantity = number(formData.get('purchase_quantity'));
  const purchaseUnit = String(formData.get('purchase_unit') ?? 'g');
  const defaultUnit = String(formData.get('default_unit') ?? 'g');

  const { data: material } = await supabase.from('materials').select('id,current_price_id').eq('id', materialId).eq('user_id', id).single();
  if (!material || purchaseQuantity <= 0 || purchasePrice < 0) throw new Error('Datos de precio inválidos.');

  const now = new Date().toISOString();
  const { data: price, error } = await supabase.from('material_prices').insert({
    material_id: materialId,
    purchase_price: purchasePrice,
    purchase_quantity: purchaseQuantity,
    purchase_unit: purchaseUnit,
    unit_cost: unitCost(purchasePrice, purchaseQuantity, purchaseUnit, defaultUnit),
    currency: 'ARS',
    is_estimated: false,
    valid_from: now,
  }).select('id').single();
  if (error) throw new Error(error.message);

  // El precio nuevo pasa a ser el actual; el anterior se cierra y queda en el historial (nunca se borra ni se modifica su valor).
  const { error: currentError } = await supabase.from('materials').update({ current_price_id: price.id }).eq('id', materialId).eq('user_id', id);
  if (currentError) throw new Error(currentError.message);
  if (material.current_price_id) {
    await supabase.from('material_prices').update({ valid_until: now }).eq('id', material.current_price_id).eq('material_id', materialId).is('valid_until', null);
  }

  revalidatePath(`/materials/${materialId}`);
  revalidatePath('/materials');
  redirect(`/materials/${materialId}`);
}

export async function archiveMaterial(formData: FormData) {
  const { supabase, id } = await userId();
  const materialId = String(formData.get('material_id') ?? '');
  const { error } = await supabase.from('materials').update({ status: 'archived' }).eq('id', materialId).eq('user_id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/materials');
  redirect(`/materials?archivado=${materialId}`);
}

// «Deshacer» después de archivar un material.
export async function restoreMaterial(formData: FormData) {
  const { supabase, id } = await userId();
  const materialId = String(formData.get('material_id') ?? '');
  const { error } = await supabase.from('materials').update({ status: 'active' }).eq('id', materialId).eq('user_id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/materials');
  redirect('/materials');
}
