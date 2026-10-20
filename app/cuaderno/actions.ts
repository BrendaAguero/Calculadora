'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAccessSnapshot, hasFeature } from '@/lib/access/permissions';
import { COLOR_MATERIALS } from '@/lib/colors';
import { parseAR } from '@/lib/num';
import { readPhoto } from '@/lib/photo';
import { PROBLEMS } from '@/lib/problems';
import { RESULTS } from '@/lib/test-logs';

const text = (formData: FormData, key: string) => String(formData.get(key) ?? '').trim();
const optionalNumber = (value: FormDataEntryValue | null) => {
  const n = parseAR(value);
  return Number.isFinite(n) ? n : null;
};

// Cuaderno de pruebas: viene con la Edición Personal o la Mensualidad Plus. Se comprueba en cada acción (y en la base).
async function auth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const snapshot = await getAccessSnapshot();
  if (!snapshot || !hasFeature(snapshot, 'CUADERNO')) redirect('/cuaderno');
  return { supabase, userId: user.id };
}

function readLog(formData: FormData) {
  const date = text(formData, 'made_on');
  const material = text(formData, 'material');
  const result = text(formData, 'result');
  const temperature = optionalNumber(formData.get('temperature'));
  const cureHours = optionalNumber(formData.get('cure_hours'));
  const values = {
    made_on: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10),
    title: text(formData, 'title').slice(0, 120) || null,
    material: COLOR_MATERIALS.includes(material) ? material : null,
    mix: text(formData, 'mix').slice(0, 300) || null,
    color_recipe_id: text(formData, 'color_recipe_id') || null,
    temperature: temperature !== null && temperature >= -20 && temperature <= 60 ? temperature : null,
    cure_hours: cureHours !== null && cureHours >= 0 && cureHours <= 10000 ? cureHours : null,
    result,
    problems: formData.getAll('problems').map(String).filter((p) => PROBLEMS.some((x) => x.id === p)).slice(0, 12),
    notes: text(formData, 'notes').slice(0, 2000) || null,
    photo: readPhoto(formData.get('photo')),
  };
  const error = !RESULTS.some((r) => r.value === result) ? 'Contanos cómo salió (perfecta, buena, regular o mal).' : null;
  return { values, error };
}

export async function createLog(formData: FormData) {
  const { values, error } = readLog(formData);
  if (error) redirect(`/cuaderno?error=${encodeURIComponent(error)}`);
  const { supabase, userId } = await auth();
  const { error: saveError } = await supabase.from('test_logs').insert({ ...values, user_id: userId });
  if (saveError) redirect(`/cuaderno?error=${encodeURIComponent('No se pudo guardar la prueba. Probá de nuevo.')}`);
  revalidatePath('/cuaderno');
  redirect(`/cuaderno?ok=${encodeURIComponent('Prueba guardada en tu cuaderno.')}`);
}

export async function updateLog(formData: FormData) {
  const id = text(formData, 'log_id');
  const back = (key: 'ok' | 'error', message: string): never => redirect(`/cuaderno/${id}?${key}=${encodeURIComponent(message)}`);
  const { values, error } = readLog(formData);
  if (error) back('error', error);
  const { supabase, userId } = await auth();
  const { data, error: saveError } = await supabase.from('test_logs').update(values).eq('id', id).eq('user_id', userId).select('id');
  if (saveError || !data?.length) back('error', 'No se pudieron guardar los cambios.');
  revalidatePath('/cuaderno');
  back('ok', 'Cambios guardados.');
}

export async function deleteLog(formData: FormData) {
  const id = text(formData, 'log_id');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { error } = await supabase.from('test_logs').delete().eq('id', id).eq('user_id', user.id);
  if (error) redirect(`/cuaderno/${id}?error=${encodeURIComponent('No se pudo borrar.')}`);
  revalidatePath('/cuaderno');
  redirect(`/cuaderno?ok=${encodeURIComponent('Prueba borrada.')}`);
}
