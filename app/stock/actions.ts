'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAccessSnapshot, hasFeature } from '@/lib/access/permissions';
import { MOVEMENT_KINDS, convert } from './constants';

const text = (formData: FormData, key: string) => String(formData.get(key) ?? '').trim();
const number = (value: string) => {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : NaN;
};

// Stock es parte del módulo «Stock básico» o de Emprendedor. Se comprueba en el servidor en cada acción.
async function auth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const snapshot = await getAccessSnapshot();
  if (!snapshot || !hasFeature(snapshot, 'STOCK_BASICO')) redirect('/stock');
  return { supabase, userId: user.id };
}

export async function addStockItem(formData: FormData) {
  const kind = text(formData, 'kind') === 'product' ? 'product' : 'material';
  const targetId = text(formData, 'target_id');
  const initial = number(text(formData, 'initial') || '0');
  const minimumText = text(formData, 'minimum');
  const minimum = minimumText ? number(minimumText) : null;
  const tab = kind === 'product' ? 'productos' : 'materiales';
  const fail = (message: string): never => redirect(`/stock?tipo=${tab}&error=${encodeURIComponent(message.slice(0, 300))}`);

  if (!targetId) fail(kind === 'product' ? 'Elegí un producto.' : 'Elegí un material.');
  if (!Number.isFinite(initial) || initial < 0) fail('La cantidad inicial no puede ser negativa.');
  if (minimum !== null && (!Number.isFinite(minimum) || minimum < 0)) fail('El mínimo no puede ser negativo.');

  const { supabase, userId } = await auth();
  // El material o producto tiene que ser de la usuaria; la unidad del stock es la del material.
  let unit = 'unidad';
  if (kind === 'material') {
    const { data } = await supabase.from('materials').select('default_unit').eq('id', targetId).eq('user_id', userId).maybeSingle();
    if (!data) fail('El material no existe o no es tuyo.');
    unit = data!.default_unit;
  } else {
    const { data } = await supabase.from('products').select('id').eq('id', targetId).eq('user_id', userId).maybeSingle();
    if (!data) fail('El producto no existe o no es tuyo.');
  }

  const { data: item, error } = await supabase
    .from('stock_items')
    .insert({ user_id: userId, stock_type: kind === 'product' ? 'finished_product' : 'material', material_id: kind === 'material' ? targetId : null, product_id: kind === 'product' ? targetId : null, unit, minimum_quantity: minimum })
    .select('id')
    .single();
  if (error || !item) fail(error?.code === '23505' ? 'Ya está en tu stock.' : `No se pudo agregar: ${error?.message}`);

  if (initial > 0) {
    const { error: movementError } = await supabase.from('stock_movements').insert({ user_id: userId, stock_item_id: item!.id, movement_type: 'adjustment', quantity: initial, unit, notes: 'Stock inicial' });
    if (movementError) redirect(`/stock/${item!.id}?error=${encodeURIComponent(`Se agregó, pero no se pudo cargar la cantidad inicial: ${movementError.message}`)}`);
  }

  revalidatePath('/stock');
  redirect(`/stock/${item!.id}?ok=${encodeURIComponent('Agregado al stock.')}`);
}

export async function registerMovement(formData: FormData) {
  const itemId = text(formData, 'item_id');
  const kind = text(formData, 'kind');
  const amount = number(text(formData, 'quantity'));
  const inputUnit = text(formData, 'unit');
  const notes = text(formData, 'notes') || null;
  const back = (key: 'ok' | 'error', message: string): never => redirect(`/stock/${itemId}?${key}=${encodeURIComponent(message.slice(0, 300))}`);

  const option = MOVEMENT_KINDS.find((k) => k.value === kind);
  if (!option) back('error', 'Elegí el tipo de movimiento.');
  if (!Number.isFinite(amount) || amount < 0 || (amount === 0 && kind !== 'count')) back('error', 'Escribí una cantidad mayor que cero.');

  const { supabase, userId } = await auth();
  const { data: item } = await supabase.from('stock_items').select('id,quantity,unit').eq('id', itemId).eq('user_id', userId).maybeSingle();
  if (!item) back('error', 'No se encontró el ítem de stock.');

  const converted = convert(amount, inputUnit || item!.unit, item!.unit);
  if (converted === null) back('error', `No se puede pasar de ${inputUnit} a ${item!.unit}.`);

  // Un conteo registra la diferencia entre lo que hay de verdad y lo que figura.
  const delta = option!.sign === 0 ? converted! - Number(item!.quantity) : option!.sign * converted!;
  if (Math.abs(delta) < 1e-9) back('ok', 'La cantidad ya coincidía; no hizo falta registrar nada.');

  const { error } = await supabase.from('stock_movements').insert({
    user_id: userId,
    stock_item_id: itemId,
    movement_type: option!.sign === 0 ? 'adjustment' : kind,
    quantity: delta,
    unit: item!.unit,
    notes: option!.sign === 0 ? (notes ? `Conteo: ${notes}` : 'Corrección por conteo') : notes,
  });
  if (error) back('error', `No se pudo registrar: ${error.message}`);

  revalidatePath('/stock');
  revalidatePath(`/stock/${itemId}`);
  back('ok', 'Movimiento registrado.');
}

export async function updateMinimum(formData: FormData) {
  const itemId = text(formData, 'item_id');
  const minimumText = text(formData, 'minimum');
  const minimum = minimumText ? number(minimumText) : null;
  const back = (key: 'ok' | 'error', message: string): never => redirect(`/stock/${itemId}?${key}=${encodeURIComponent(message.slice(0, 300))}`);
  if (minimum !== null && (!Number.isFinite(minimum) || minimum < 0)) back('error', 'El mínimo no puede ser negativo.');

  const { supabase, userId } = await auth();
  const { data, error } = await supabase.from('stock_items').update({ minimum_quantity: minimum }).eq('id', itemId).eq('user_id', userId).select('id');
  if (error) back('error', `No se pudo guardar: ${error.message}`);
  if (!data?.length) back('error', 'No se encontró el ítem de stock.');
  revalidatePath('/stock');
  back('ok', minimum === null ? 'Mínimo quitado.' : 'Mínimo guardado.');
}
