'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const text = (formData: FormData, key: string) => String(formData.get(key) ?? '').trim();
const back = (key: 'ok' | 'error', message: string): never => redirect(`/temporizadores?${key}=${encodeURIComponent(message)}`);
const MAX_MINUTES = 60 * 24 * 60; // 60 días

async function user() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, userId: user.id };
}

// Gratis para cualquier cuenta. Crea un temporizador por cada etapa marcada (por ejemplo «Maceta · Desmoldar»).
export async function startTimers(formData: FormData) {
  const { supabase, userId } = await user();
  const piece = text(formData, 'piece').slice(0, 80);
  const labels = formData.getAll('stage_label').map((v) => String(v).trim().slice(0, 70));
  const minutes = formData.getAll('stage_minutes').map((v) => Number(v));
  const on = formData.getAll('stage_on').map(String);
  const now = Date.now();
  const rows = labels.flatMap((label, i) => {
    const m = minutes[i];
    if (!on.includes(String(i)) || !label || !(m > 0) || m > MAX_MINUTES) return [];
    return [{ user_id: userId, label: piece ? `${piece} · ${label}` : label, ends_at: new Date(now + m * 60_000).toISOString() }];
  });
  if (!rows.length) back('error', 'Marcá al menos una etapa con su tiempo.');
  const { error } = await supabase.from('cure_timers').insert(rows);
  if (error) back('error', 'No se pudieron crear los temporizadores. Si tenés muchos, borrá los ya terminados.');
  revalidatePath('/temporizadores');
  back('ok', rows.length === 1 ? 'Temporizador en marcha.' : `${rows.length} temporizadores en marcha.`);
}

export async function finishTimer(formData: FormData) {
  const { supabase, userId } = await user();
  await supabase.from('cure_timers').update({ done_at: new Date().toISOString() }).eq('id', text(formData, 'timer_id')).eq('user_id', userId);
  revalidatePath('/temporizadores');
}

export async function deleteTimer(formData: FormData) {
  const { supabase, userId } = await user();
  await supabase.from('cure_timers').delete().eq('id', text(formData, 'timer_id')).eq('user_id', userId);
  revalidatePath('/temporizadores');
}

// Limpia los ya terminados (solo de esta persona).
export async function clearFinished() {
  const { supabase, userId } = await user();
  await supabase.from('cure_timers').delete().eq('user_id', userId).not('done_at', 'is', null);
  revalidatePath('/temporizadores');
}
