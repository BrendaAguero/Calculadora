'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ownsActivity } from '@/lib/access/activities';
import { createLimitError } from '@/lib/access/permissions';
import { PRICE_TYPES, PRODUCT_STATUSES } from './constants';

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type ProductFormValues = { name: string; activity_id: string; photo_url: string; notes: string; formula_id: string; mold_id: string };
export type ProductFormState = { error: string | null; values: ProductFormValues | null };

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function number(value: string) {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : NaN;
}

async function auth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, userId: user.id };
}

function back(productId: string, message: string, ok = false): never {
  redirect(`/gestion/productos/${productId}?${ok ? 'ok' : 'error'}=${encodeURIComponent(message.slice(0, 300))}`);
}

async function ownProduct(supabase: Supabase, userId: string, productId: string) {
  const { data } = await supabase.from('products').select('id,activity_id').eq('id', productId).eq('user_id', userId).maybeSingle();
  return data;
}

// Una fórmula o molde solo se puede vincular si es de la usuaria y de la misma actividad que el producto.
async function checkLinkable(supabase: Supabase, userId: string, kind: 'formula' | 'mold', id: string, activityId: string) {
  const table = kind === 'formula' ? 'formulas' : 'molds';
  const label = kind === 'formula' ? 'La fórmula' : 'El molde';
  const { data } = await supabase.from(table).select('id,activity_id').eq('id', id).eq('user_id', userId).maybeSingle();
  if (!data) return `${label} elegido no existe o no es tuyo.`;
  if (data.activity_id !== activityId) return `${label} es de otra actividad que el producto.`;
  return null;
}

export async function createProduct(_prev: ProductFormState, formData: FormData): Promise<ProductFormState> {
  const values: ProductFormValues = { name: text(formData, 'name'), activity_id: text(formData, 'activity_id'), photo_url: text(formData, 'photo_url'), notes: text(formData, 'notes'), formula_id: text(formData, 'formula_id'), mold_id: text(formData, 'mold_id') };
  if (!values.name) return { error: 'Escribí un nombre para el producto.', values };
  if (values.photo_url && !/^https?:\/\//i.test(values.photo_url)) return { error: 'La foto debe ser una dirección que empiece con http:// o https://.', values };

  const { supabase, userId } = await auth();
  if (!values.activity_id || !(await ownsActivity(supabase, userId, values.activity_id))) return { error: 'Elegí una de tus actividades.', values };
  for (const [kind, id] of [['formula', values.formula_id], ['mold', values.mold_id]] as const) {
    if (!id) continue;
    const problem = await checkLinkable(supabase, userId, kind, id, values.activity_id);
    if (problem) return { error: problem, values };
  }
  const limitError = await createLimitError(supabase, userId, 'products');
  if (limitError) return { error: limitError, values };

  const { data: product, error } = await supabase
    .from('products')
    .insert({ user_id: userId, activity_id: values.activity_id, name: values.name, photo_url: values.photo_url || null, notes: values.notes || null, status: 'active' })
    .select('id')
    .single();
  if (error || !product) return { error: `No se pudo crear el producto: ${error?.message}`, values };

  const links = [
    values.formula_id ? supabase.from('product_formulas').insert({ product_id: product.id, formula_id: values.formula_id, is_default: true }) : null,
    values.mold_id ? supabase.from('product_molds').insert({ product_id: product.id, mold_id: values.mold_id, is_default: true }) : null,
  ];
  const failed = (await Promise.all(links)).find(result => result?.error);
  if (failed?.error) {
    // Sin sus vínculos el producto quedaría a medias: se deshace.
    await supabase.from('products').delete().eq('id', product.id).eq('user_id', userId);
    return { error: `No se pudo vincular la fórmula o el molde: ${failed.error.message}`, values };
  }

  revalidatePath('/gestion/productos');
  redirect(`/gestion/productos/${product.id}?ok=${encodeURIComponent('Producto creado. Ahora podés cargarle precios.')}`);
}

export async function updateProduct(formData: FormData) {
  const productId = text(formData, 'product_id');
  const name = text(formData, 'name');
  const photoUrl = text(formData, 'photo_url');
  const status = text(formData, 'status');
  if (!name) back(productId, 'Escribí un nombre para el producto.');
  if (photoUrl && !/^https?:\/\//i.test(photoUrl)) back(productId, 'La foto debe ser una dirección que empiece con http:// o https://.');
  if (!PRODUCT_STATUSES.some(s => s.value === status)) back(productId, 'Estado inválido.');

  const { supabase, userId } = await auth();
  // Sacar un producto de «archivado» vuelve a sumarlo al límite del plan.
  if (status !== 'archived') {
    const { data: current } = await supabase.from('products').select('status').eq('id', productId).eq('user_id', userId).maybeSingle();
    if (current?.status === 'archived') {
      const limitError = await createLimitError(supabase, userId, 'products');
      if (limitError) back(productId, limitError);
    }
  }
  // Archivar o pausar no borra el producto, sus precios ni sus vínculos.
  const { data, error } = await supabase.from('products').update({ name, photo_url: photoUrl || null, notes: text(formData, 'notes') || null, status }).eq('id', productId).eq('user_id', userId).select('id');
  if (error) back(productId, `No se pudieron guardar los datos: ${error.message}`);
  if (!data?.length) back(productId, 'No se encontró el producto.');
  revalidatePath('/gestion/productos');
  back(productId, 'Datos guardados.', true);
}

// Vincular, marcar como predeterminado o quitar una fórmula o un molde del producto.
export async function changeLink(formData: FormData) {
  const productId = text(formData, 'product_id');
  const kind = text(formData, 'kind') === 'mold' ? 'mold' : 'formula';
  const op = text(formData, 'op');
  const targetId = text(formData, 'target_id');
  const table = kind === 'formula' ? 'product_formulas' : 'product_molds';
  const column = kind === 'formula' ? 'formula_id' : 'mold_id';

  const { supabase, userId } = await auth();
  const product = await ownProduct(supabase, userId, productId);
  if (!product) back(productId, 'No se encontró el producto.');
  if (!targetId) back(productId, kind === 'formula' ? 'Elegí una fórmula.' : 'Elegí un molde.');

  if (op === 'add') {
    const problem = await checkLinkable(supabase, userId, kind, targetId, product.activity_id);
    if (problem) back(productId, problem);
    const { count } = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('product_id', productId);
    // La primera que se vincula queda como predeterminada.
    const { error } = await supabase.from(table).insert({ product_id: productId, [column]: targetId, is_default: !count });
    if (error) back(productId, error.code === '23505' ? 'Ya estaba vinculado.' : `No se pudo vincular: ${error.message}`);
  } else if (op === 'default') {
    // Solo una predeterminada por tipo: primero se desmarcan todas.
    const { error: clearError } = await supabase.from(table).update({ is_default: false }).eq('product_id', productId);
    const { error } = clearError ? { error: clearError } : await supabase.from(table).update({ is_default: true }).eq('product_id', productId).eq(column, targetId);
    if (error) back(productId, `No se pudo cambiar la predeterminada: ${error.message}`);
  } else if (op === 'remove') {
    const { error } = await supabase.from(table).delete().eq('product_id', productId).eq(column, targetId);
    if (error) back(productId, `No se pudo quitar: ${error.message}`);
  } else {
    back(productId, 'Acción inválida.');
  }

  revalidatePath(`/gestion/productos/${productId}`);
  revalidatePath('/gestion/productos');
  back(productId, 'Cambios guardados.', true);
}

// Un precio nuevo nunca reemplaza a otro: si ya había uno vigente del mismo tipo y rango, se cierra y queda en el historial.
export async function addPrice(formData: FormData) {
  const productId = text(formData, 'product_id');
  const priceType = text(formData, 'price_type');
  const price = number(text(formData, 'price'));
  const minRaw = text(formData, 'quantity_min');
  const maxRaw = text(formData, 'quantity_max');
  const quantityMin = minRaw ? number(minRaw) : 1;
  const quantityMax = maxRaw ? number(maxRaw) : null;
  const fromRaw = text(formData, 'valid_from');
  const untilRaw = text(formData, 'valid_until');

  if (!PRICE_TYPES.some(t => t.value === priceType)) back(productId, 'Elegí el tipo de precio.');
  if (!(price > 0)) back(productId, 'El precio debe ser mayor que 0.');
  if (!(quantityMin >= 1) || !Number.isInteger(quantityMin)) back(productId, '«Desde» debe ser un número entero de 1 o más.');
  if (quantityMax !== null && (!Number.isInteger(quantityMax) || quantityMax < quantityMin)) back(productId, '«Hasta» debe ser un número entero mayor o igual que «Desde».');
  const validFrom = fromRaw ? new Date(`${fromRaw}T00:00:00-03:00`) : new Date();
  const validUntil = untilRaw ? new Date(`${untilRaw}T23:59:59-03:00`) : null;
  if (Number.isNaN(validFrom.getTime()) || (validUntil && Number.isNaN(validUntil.getTime()))) back(productId, 'Fecha inválida.');
  if (validUntil && validUntil <= validFrom) back(productId, 'La fecha «hasta» debe ser posterior a «desde».');

  const { supabase, userId } = await auth();
  if (!(await ownProduct(supabase, userId, productId))) back(productId, 'No se encontró el producto.');

  let previous = supabase.from('product_prices').update({ valid_until: validFrom.toISOString() }).eq('product_id', productId).eq('price_type', priceType).eq('quantity_min', quantityMin).is('valid_until', null).lte('valid_from', validFrom.toISOString());
  previous = quantityMax === null ? previous.is('quantity_max', null) : previous.eq('quantity_max', quantityMax);
  const { error: closeError } = await previous;
  if (closeError) back(productId, `No se pudo cerrar el precio anterior: ${closeError.message}`);

  const { error } = await supabase.from('product_prices').insert({ product_id: productId, price_type: priceType, quantity_min: quantityMin, quantity_max: quantityMax, price, currency: 'ARS', valid_from: validFrom.toISOString(), valid_until: validUntil?.toISOString() ?? null });
  if (error) back(productId, `No se pudo guardar el precio: ${error.message}`);

  revalidatePath(`/gestion/productos/${productId}`);
  revalidatePath('/gestion/productos');
  back(productId, 'Precio guardado.', true);
}

// Finalizar deja de aplicar un precio desde ahora; no lo borra.
export async function endPrice(formData: FormData) {
  const productId = text(formData, 'product_id');
  const priceId = text(formData, 'price_id');
  const { supabase, userId } = await auth();
  if (!(await ownProduct(supabase, userId, productId))) back(productId, 'No se encontró el producto.');
  const { data, error } = await supabase.from('product_prices').update({ valid_until: new Date().toISOString() }).eq('id', priceId).eq('product_id', productId).select('id');
  if (error) back(productId, `No se pudo finalizar el precio: ${error.message}`);
  if (!data?.length) back(productId, 'No se encontró el precio.');
  revalidatePath(`/gestion/productos/${productId}`);
  back(productId, 'Precio finalizado. Queda en el historial.', true);
}
