'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

function number(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

async function auth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, userId: user.id };
}

async function yesoActivityId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase.from('activities').select('id').eq('code', 'YESO').eq('active', true).single();
  if (error || !data) throw new Error('No se encontró la actividad YESO.');
  return data.id;
}

export async function createMold(formData: FormData) {
  const { supabase, userId } = await auth();
  const name = String(formData.get('name') ?? '').trim();
  const photoUrl = String(formData.get('photo_url') ?? '').trim() || null;
  const waterCapacity = number(formData.get('water_capacity'));
  const waterUnit = String(formData.get('water_unit') ?? 'g');
  const plasterPerPieceRaw = String(formData.get('plaster_per_piece') ?? '').trim();
  const plasterPerPiece = plasterPerPieceRaw ? number(plasterPerPieceRaw) : null;
  const cost = number(formData.get('cost'));
  const estimatedUsesRaw = String(formData.get('estimated_uses') ?? '').trim();
  const estimatedUses = estimatedUsesRaw ? Math.max(0, Math.floor(number(formData.get('estimated_uses')))) : null;
  const notes = String(formData.get('notes') ?? '').trim() || null;

  if (!name || waterCapacity <= 0 || cost < 0 || (plasterPerPiece !== null && plasterPerPiece <= 0) || (estimatedUses !== null && estimatedUses < 0)) {
    throw new Error('Completá los datos del molde correctamente.');
  }

  const activityId = await yesoActivityId(supabase);
  const { error } = await supabase.from('molds').insert({
    user_id: userId,
    activity_id: activityId,
    name,
    photo_url: photoUrl,
    water_capacity: waterCapacity,
    water_unit: waterUnit,
    plaster_per_piece: plasterPerPiece,
    cost,
    estimated_uses: estimatedUses,
    notes,
    status: 'active',
  });
  if (error) throw new Error(error.message);

  revalidatePath('/gestion/moldes');
  revalidatePath('/gestion/productos');
  redirect('/gestion/moldes');
}

export async function updateMold(formData: FormData) {
  const { supabase, userId } = await auth();
  const moldId = String(formData.get('mold_id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const photoUrl = String(formData.get('photo_url') ?? '').trim() || null;
  const waterCapacity = number(formData.get('water_capacity'));
  const waterUnit = String(formData.get('water_unit') ?? 'g');
  const plasterPerPieceRaw = String(formData.get('plaster_per_piece') ?? '').trim();
  const plasterPerPiece = plasterPerPieceRaw ? number(plasterPerPieceRaw) : null;
  const cost = number(formData.get('cost'));
  const estimatedUsesRaw = String(formData.get('estimated_uses') ?? '').trim();
  const estimatedUses = estimatedUsesRaw ? Math.max(0, Math.floor(number(formData.get('estimated_uses')))) : null;
  const notes = String(formData.get('notes') ?? '').trim() || null;

  if (!moldId || !name || waterCapacity <= 0 || cost < 0) throw new Error('Datos de molde inválidos.');

  const { error } = await supabase.from('molds').update({
    name, photo_url: photoUrl, water_capacity: waterCapacity, water_unit: waterUnit,
    plaster_per_piece: plasterPerPiece, cost, estimated_uses: estimatedUses, notes,
  }).eq('id', moldId).eq('user_id', userId);
  if (error) throw new Error(error.message);

  revalidatePath('/gestion/moldes');
  revalidatePath('/gestion/productos');
  redirect('/gestion/moldes');
}

export async function archiveMold(formData: FormData) {
  const { supabase, userId } = await auth();
  const moldId = String(formData.get('mold_id') ?? '');
  const { error } = await supabase.from('molds').update({ status: 'archived' }).eq('id', moldId).eq('user_id', userId);
  if (error) throw new Error(error.message);
  revalidatePath('/gestion/moldes');
  revalidatePath('/gestion/productos');
  redirect('/gestion/moldes');
}
