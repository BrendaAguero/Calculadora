'use server';

import { parseAR } from '@/lib/num';
import { isOldPrice } from '@/lib/price-age';
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
  // NaN si no es un número: así un precio mal escrito no se guarda como $0.
  return parseAR(String(value ?? ''));
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

// Vuelve al formulario con un mensaje claro (y deja el error técnico en el registro del servidor).
function fail(path: string, message: string, detail?: string): never {
  if (detail) console.error(`[materiales] ${detail}`);
  redirect(`${path}${path.includes('?') ? '&' : '?'}error=${encodeURIComponent(message)}`);
}
const DB_ERROR = 'No se pudo guardar. Probá de nuevo en un momento.';

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

  if (!name) fail('/materials/new', 'Escribí el nombre del material.');
  if (!(purchaseQuantity > 0)) fail('/materials/new', 'Escribí cuánto material compraste (por ejemplo, 1 kg).');
  if (!(purchasePrice >= 0)) fail('/materials/new', 'Escribí cuánto pagaste, solo con números (por ejemplo, 12.500).');
  const invalidActivity = await activityError(supabase, id, activityId);
  if (invalidActivity) redirect(`/materials/new?error=${encodeURIComponent(invalidActivity)}`);
  const limitError = await createLimitError(supabase, id, 'materials');
  if (limitError) redirect(`/materials/new?error=${encodeURIComponent(limitError)}`);

  const { data: material, error } = await supabase
    .from('materials')
    .insert({ user_id: id, activity_id: activityId, name, default_unit: defaultUnit, status: 'active' })
    .select('id')
    .single();
  if (error) fail('/materials/new', DB_ERROR, error.message);

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
  if (priceError) fail(`/materials/${material.id}`, 'Se creó el material pero no se pudo guardar el precio. Agregalo acá abajo.', priceError.message);

  const { error: updateError } = await supabase.from('materials').update({ current_price_id: price.id }).eq('id', material.id).eq('user_id', id);
  if (updateError) fail(`/materials/${material.id}`, 'Se creó el material pero no se pudo guardar el precio. Agregalo acá abajo.', updateError.message);

  revalidatePath('/materials');
  redirect('/materials');
}

export async function updateMaterial(formData: FormData) {
  const { supabase, id } = await userId();
  const materialId = String(formData.get('material_id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const defaultUnit = String(formData.get('default_unit') ?? 'g');
  const activityId = String(formData.get('activity_id') ?? '').trim() || null;

  if (!materialId || !name) fail(`/materials/${materialId}`, 'Escribí el nombre del material.');
  // Se acepta la actividad que el material ya tenía aunque la usuaria ya no la tenga, para no perderla al guardar.
  const { data: existing } = await supabase.from('materials').select('activity_id').eq('id', materialId).eq('user_id', id).maybeSingle();
  const invalidActivity = activityId === existing?.activity_id ? null : await activityError(supabase, id, activityId);
  if (invalidActivity) redirect(`/materials/${materialId}?error=${encodeURIComponent(invalidActivity)}`);

  const { error } = await supabase.from('materials').update({ name, default_unit: defaultUnit, activity_id: activityId }).eq('id', materialId).eq('user_id', id);
  if (error) fail(`/materials/${materialId}`, DB_ERROR, error.message);
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
  if (!material) fail('/materials', 'No se encontró el material.');
  if (!(purchaseQuantity > 0)) fail(`/materials/${materialId}`, 'Escribí cuánto material compraste (por ejemplo, 1 kg).');
  if (!(purchasePrice >= 0)) fail(`/materials/${materialId}`, 'Escribí cuánto pagaste, solo con números (por ejemplo, 12.500).');

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
  if (error) fail(`/materials/${materialId}`, DB_ERROR, error.message);

  // El precio nuevo pasa a ser el actual; el anterior se cierra y queda en el historial (nunca se borra ni se modifica su valor).
  const { error: currentError } = await supabase.from('materials').update({ current_price_id: price.id }).eq('id', materialId).eq('user_id', id);
  if (currentError) fail(`/materials/${materialId}`, DB_ERROR, currentError.message);
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
  if (error) fail('/materials', DB_ERROR, error.message);
  revalidatePath('/materials');
  redirect(`/materials?archivado=${materialId}`);
}

// «Deshacer» después de archivar un material.
export async function restoreMaterial(formData: FormData) {
  const { supabase, id } = await userId();
  const materialId = String(formData.get('material_id') ?? '');
  const { error } = await supabase.from('materials').update({ status: 'active' }).eq('id', materialId).eq('user_id', id);
  if (error) fail('/materials', DB_ERROR, error.message);
  revalidatePath('/materials');
  redirect('/materials');
}

// Sube un porcentaje el precio actual de los materiales (todos o solo los de precio viejo).
// No modifica los precios anteriores: crea uno nuevo, marcado como estimado, y el anterior queda en el historial.
export async function raiseMaterialPrices(formData: FormData) {
  const { supabase, id } = await userId();
  const percent = number(formData.get('percent'));
  const onlyOld = formData.get('only_old') === 'on';
  if (!Number.isFinite(percent) || percent <= 0 || percent > 300) redirect(`/materials?error=${encodeURIComponent('Escribí un aumento entre 1 y 300 %.')}`);

  const { data: materials, error } = await supabase.from('materials').select('id,current_price_id').eq('user_id', id).eq('status', 'active').not('current_price_id', 'is', null);
  if (error) redirect(`/materials?error=${encodeURIComponent(error.message)}`);
  const priceIds = (materials ?? []).map(m => m.current_price_id as string);
  const { data: prices } = priceIds.length
    ? await supabase.from('material_prices').select('id,material_id,purchase_price,purchase_quantity,purchase_unit,unit_cost,currency,valid_from').in('id', priceIds)
    : { data: [] };
  const now = new Date();
  const factor = 1 + percent / 100;
  let changed = 0;
  for (const price of prices ?? []) {
    if (onlyOld && !isOldPrice(price.valid_from, now.getTime())) continue;
    const { data: created, error: insertError } = await supabase.from('material_prices').insert({
      material_id: price.material_id,
      purchase_price: Math.round(Number(price.purchase_price) * factor * 100) / 100,
      purchase_quantity: price.purchase_quantity,
      purchase_unit: price.purchase_unit,
      unit_cost: Number(price.unit_cost) * factor,
      currency: price.currency ?? 'ARS',
      is_estimated: true,
      valid_from: now.toISOString(),
    }).select('id').single();
    if (insertError) redirect(`/materials?error=${encodeURIComponent(`Se actualizaron ${changed}; después falló: ${insertError.message}`)}`);
    await supabase.from('materials').update({ current_price_id: created!.id }).eq('id', price.material_id).eq('user_id', id);
    await supabase.from('material_prices').update({ valid_until: now.toISOString() }).eq('id', price.id).is('valid_until', null);
    changed++;
  }
  revalidatePath('/materials');
  redirect(`/materials?ok=${encodeURIComponent(changed ? `Listo: subiste ${percent} % el precio de ${changed} ${changed === 1 ? 'material' : 'materiales'}. Los cálculos guardados no cambian.` : 'No había precios para subir.')}`);
}
