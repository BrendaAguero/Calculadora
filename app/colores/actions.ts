'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAccessSnapshot, hasFeature } from '@/lib/access/permissions';
import { cleanPigments, COLOR_MATERIALS } from '@/lib/colors';
import { parseAR } from '@/lib/num';
import { readPhoto } from '@/lib/photo';

const text = (formData: FormData, key: string) => String(formData.get(key) ?? '').trim();

// Recetas de color: viene con la Edición Personal o la Mensualidad Plus. Se comprueba en cada acción (y en la base).
async function auth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const snapshot = await getAccessSnapshot();
  if (!snapshot || !hasFeature(snapshot, 'COLORES')) redirect('/colores');
  return { supabase, userId: user.id };
}

function readRecipe(formData: FormData) {
  const names = formData.getAll('pigment_name').map(String);
  const amounts = formData.getAll('pigment_amount').map((v) => parseAR(v));
  const units = formData.getAll('pigment_unit').map(String);
  const pigments = cleanPigments(names.map((name, i) => ({ name, amount: amounts[i], unit: units[i] })));
  const material = text(formData, 'material');
  const values = {
    name: text(formData, 'name').slice(0, 120),
    material: COLOR_MATERIALS.includes(material) ? material : null,
    base_grams: parseAR(formData.get('base_grams')),
    pigments,
    notes: text(formData, 'notes').slice(0, 1000) || null,
    photo: readPhoto(formData.get('photo')),
  };
  const error = !values.name ? 'Ponele un nombre al color (por ejemplo, «Rosa empolvado»).'
    : !(values.base_grams > 0) ? 'Escribí para cuántos gramos de mezcla es la receta.'
    : !pigments.length ? 'Sumá al menos un pigmento con su cantidad.'
    : null;
  return { values, error };
}

export async function createRecipe(formData: FormData) {
  const { values, error } = readRecipe(formData);
  if (error) redirect(`/colores?error=${encodeURIComponent(error)}`);
  const { supabase, userId } = await auth();
  const { data, error: saveError } = await supabase.from('color_recipes').insert({ ...values, user_id: userId }).select('id').single();
  if (saveError || !data) redirect(`/colores?error=${encodeURIComponent('No se pudo guardar la receta. Probá de nuevo.')}`);
  revalidatePath('/colores');
  redirect(`/colores/${data!.id}?ok=${encodeURIComponent('Receta guardada.')}`);
}

export async function updateRecipe(formData: FormData) {
  const id = text(formData, 'recipe_id');
  const back = (key: 'ok' | 'error', message: string): never => redirect(`/colores/${id}?${key}=${encodeURIComponent(message)}`);
  const { values, error } = readRecipe(formData);
  if (error) back('error', error);
  const { supabase, userId } = await auth();
  const { data, error: saveError } = await supabase.from('color_recipes').update({ ...values, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId).select('id');
  if (saveError || !data?.length) back('error', 'No se pudieron guardar los cambios.');
  revalidatePath('/colores');
  back('ok', 'Cambios guardados.');
}

// Borrar es a pedido de la persona y solo su propia receta (las pruebas que la usaban quedan, sin la receta).
export async function deleteRecipe(formData: FormData) {
  const id = text(formData, 'recipe_id');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { error } = await supabase.from('color_recipes').delete().eq('id', id).eq('user_id', user.id);
  if (error) redirect(`/colores/${id}?error=${encodeURIComponent('No se pudo borrar.')}`);
  revalidatePath('/colores');
  redirect(`/colores?ok=${encodeURIComponent('Receta borrada.')}`);
}
