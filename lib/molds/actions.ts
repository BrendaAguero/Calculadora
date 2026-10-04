'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

function text(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : '';
}

function numberOrNull(value: FormDataEntryValue | null) {
  const raw = text(value).replace(',', '.');
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, user };
}

async function validateActivity(supabase: any, userId: string, activityId: string) {
  const { data } = await supabase
    .from('user_activities')
    .select('id')
    .eq('user_id', userId)
    .eq('activity_id', activityId)
    .eq('status', 'active')
    .maybeSingle();
  return Boolean(data);
}

export async function createMold(formData: FormData) {
  const { supabase, user } = await getContext();
  const activityId = text(formData.get('activity_id'));
  const name = text(formData.get('name'));
  if (!name || !activityId || !(await validateActivity(supabase, user.id, activityId))) return;

  const { error } = await supabase.from('molds').insert({
    user_id: user.id,
    activity_id: activityId,
    name,
    photo_url: text(formData.get('photo_url')) || null,
    reference_measurement_value: numberOrNull(formData.get('reference_measurement_value')),
    reference_measurement_unit: text(formData.get('reference_measurement_unit')) || null,
    cost: numberOrNull(formData.get('cost')),
    estimated_uses: numberOrNull(formData.get('estimated_uses')),
    notes: text(formData.get('notes')) || null,
    status: 'active',
  });

  if (!error) {
    revalidatePath('/molds');
    redirect('/molds');
  }
}

export async function updateMold(formData: FormData) {
  const { supabase, user } = await getContext();
  const id = text(formData.get('id'));
  const activityId = text(formData.get('activity_id'));
  const name = text(formData.get('name'));
  if (!id || !name || !activityId || !(await validateActivity(supabase, user.id, activityId))) return;

  const { error } = await supabase
    .from('molds')
    .update({
      activity_id: activityId,
      name,
      photo_url: text(formData.get('photo_url')) || null,
      reference_measurement_value: numberOrNull(formData.get('reference_measurement_value')),
      reference_measurement_unit: text(formData.get('reference_measurement_unit')) || null,
      cost: numberOrNull(formData.get('cost')),
      estimated_uses: numberOrNull(formData.get('estimated_uses')),
      notes: text(formData.get('notes')) || null,
    })
    .eq('id', id)
    .eq('user_id', user.id);

  if (!error) {
    revalidatePath('/molds');
    revalidatePath(`/molds/${id}`);
    redirect(`/molds/${id}`);
  }
}

export async function archiveMold(formData: FormData) {
  const { supabase, user } = await getContext();
  const id = text(formData.get('id'));
  if (!id) return;

  await supabase.from('molds').update({ status: 'archived' }).eq('id', id).eq('user_id', user.id);
  revalidatePath('/molds');
  revalidatePath(`/molds/${id}`);
  redirect('/molds');
}
