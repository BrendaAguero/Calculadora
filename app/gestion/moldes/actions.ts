'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ownsActivity } from '@/lib/access/activities';
import { createLimitError } from '@/lib/access/permissions';

export type MoldFormValues = {
  activity_id: string;
  name: string;
  photo_url: string;
  reference_measurement_value: string;
  reference_measurement_unit: string;
  cost: string;
  estimated_uses: string;
  notes: string;
};

export type MoldFormState = { error: string | null; values: MoldFormValues | null };

const MEASUREMENT_UNITS = ['g', 'kg', 'ml', 'l'];

function number(value: string) {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function readValues(formData: FormData): MoldFormValues {
  const text = (key: string) => String(formData.get(key) ?? '').trim();
  return {
    activity_id: text('activity_id'),
    name: text('name'),
    photo_url: text('photo_url'),
    reference_measurement_value: text('reference_measurement_value'),
    reference_measurement_unit: text('reference_measurement_unit') || 'g',
    cost: text('cost'),
    estimated_uses: text('estimated_uses'),
    notes: text('notes'),
  };
}

type MoldRow = {
  name: string;
  photo_url: string | null;
  reference_measurement_value: number;
  reference_measurement_unit: string;
  cost: number;
  estimated_uses: number | null;
  notes: string | null;
};

// Valida y convierte a las columnas reales de public.molds.
function toRow(values: MoldFormValues): { error: string } | { row: MoldRow } {
  if (!values.name) return { error: 'Escribí un nombre para el molde.' };

  const measurement = number(values.reference_measurement_value);
  if (!(measurement > 0)) return { error: 'La medición de referencia debe ser un número mayor que 0.' };
  if (!MEASUREMENT_UNITS.includes(values.reference_measurement_unit)) return { error: 'Elegí una unidad válida.' };

  const cost = values.cost === '' ? 0 : number(values.cost);
  if (!(cost >= 0)) return { error: 'El costo debe ser un número igual o mayor que 0.' };

  let estimatedUses: number | null = null;
  if (values.estimated_uses !== '') {
    estimatedUses = number(values.estimated_uses);
    if (!Number.isInteger(estimatedUses) || estimatedUses < 0) return { error: 'Los usos estimados deben ser un número entero igual o mayor que 0.' };
  }

  if (values.photo_url && !/^https?:\/\//i.test(values.photo_url)) return { error: 'La foto debe ser una dirección que empiece con http:// o https://.' };

  return {
    row: {
      name: values.name,
      photo_url: values.photo_url || null,
      reference_measurement_value: measurement,
      reference_measurement_unit: values.reference_measurement_unit,
      cost,
      estimated_uses: estimatedUses,
      notes: values.notes || null,
    },
  };
}

async function auth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, userId: user.id };
}

export async function createMold(_prev: MoldFormState, formData: FormData): Promise<MoldFormState> {
  const values = readValues(formData);
  const parsed = toRow(values);
  if ('error' in parsed) return { error: parsed.error, values };

  const { supabase, userId } = await auth();

  // La actividad debe ser una de las que tiene la usuaria (principal, secundaria o comprada después).
  if (!values.activity_id || !(await ownsActivity(supabase, userId, values.activity_id))) return { error: 'Elegí una de tus actividades.', values };
  const limitError = await createLimitError(supabase, userId, 'molds');
  if (limitError) return { error: limitError, values };

  // user_id sale de la sesión, nunca del formulario. RLS vuelve a comprobarlo en la base.
  const { error } = await supabase
    .from('molds')
    .insert({ ...parsed.row, user_id: userId, activity_id: values.activity_id, status: 'active' });
  if (error) return { error: `No se pudo guardar el molde: ${error.message}`, values };

  revalidatePath('/gestion/moldes');
  redirect('/gestion/moldes?guardado=1');
}

export async function updateMold(_prev: MoldFormState, formData: FormData): Promise<MoldFormState> {
  const moldId = String(formData.get('mold_id') ?? '');
  const values = readValues(formData);
  if (!moldId) return { error: 'No se encontró el molde a editar.', values };
  const parsed = toRow(values);
  if ('error' in parsed) return { error: parsed.error, values };

  const { supabase, userId } = await auth();
  const { data, error } = await supabase
    .from('molds')
    .update(parsed.row)
    .eq('id', moldId)
    .eq('user_id', userId)
    .select('id');
  if (error) return { error: `No se pudieron guardar los cambios: ${error.message}`, values };
  if (!data?.length) return { error: 'No se encontró el molde o no tenés permiso para editarlo.', values };

  revalidatePath('/gestion/moldes');
  revalidatePath(`/gestion/moldes/${moldId}`);
  redirect('/gestion/moldes?guardado=1');
}

async function setMoldStatus(formData: FormData, status: 'active' | 'archived') {
  const moldId = String(formData.get('mold_id') ?? '');
  const { supabase, userId } = await auth();
  // Restaurar vuelve a sumar un molde en uso, así que respeta el límite del plan.
  const limitError = status === 'active' ? await createLimitError(supabase, userId, 'molds') : null;
  if (limitError) redirect(`/gestion/moldes/${moldId}?error=${encodeURIComponent(limitError)}`);
  // Archivar no borra el registro: solo cambia su estado.
  const { data, error } = await supabase
    .from('molds')
    .update({ status })
    .eq('id', moldId)
    .eq('user_id', userId)
    .select('id');
  const failure = error?.message ?? (!data?.length ? 'No se encontró el molde o no tenés permiso para modificarlo.' : null);
  if (failure) redirect(`/gestion/moldes/${moldId}?error=${encodeURIComponent(failure.slice(0, 300))}`);

  revalidatePath('/gestion/moldes');
  revalidatePath(`/gestion/moldes/${moldId}`);
  redirect('/gestion/moldes');
}

export async function archiveMold(formData: FormData) {
  await setMoldStatus(formData, 'archived');
}

export async function restoreMold(formData: FormData) {
  await setMoldStatus(formData, 'active');
}
