'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireModerator } from '@/lib/admin';

const text = (formData: FormData, key: string) => String(formData.get(key) ?? '').trim();
// Vuelve a la pantalla desde donde se moderó (la comunidad o el panel de moderación).
const backTo = (formData: FormData) => {
  const path = text(formData, 'back');
  return /^\/(moderacion|comunidad(\/[0-9a-f-]{36})?)$/i.test(path) ? path : '/moderacion';
};

// Todas pasan por funciones de la base que comprueban que sea del equipo y dejan registro en la auditoría.
async function run(formData: FormData, fn: string, args: Record<string, unknown>, ok: string) {
  const back = backTo(formData);
  const { supabase } = await requireModerator(back);
  const { error } = await supabase.rpc(fn, args);
  revalidatePath('/comunidad', 'layout');
  revalidatePath('/moderacion');
  redirect(`${back}?${error ? 'error' : 'ok'}=${encodeURIComponent((error?.message ?? ok).slice(0, 300))}`);
}

export async function moderatePost(formData: FormData) {
  const status = text(formData, 'status');
  const pinned = text(formData, 'pinned');
  await run(formData, 'mod_set_post', {
    p_post_id: text(formData, 'post_id'), p_status: status, p_pinned: pinned === '1' ? true : pinned === '0' ? false : null, p_reason: text(formData, 'reason') || null,
  }, status === 'hidden' ? 'Publicación ocultada.' : pinned === '1' ? 'Publicación destacada.' : pinned === '0' ? 'Ya no está destacada.' : 'Publicación visible otra vez.');
}

export async function moderateComment(formData: FormData) {
  const status = text(formData, 'status');
  await run(formData, 'mod_set_comment', { p_comment_id: text(formData, 'comment_id'), p_status: status }, status === 'hidden' ? 'Comentario ocultado.' : 'Comentario visible otra vez.');
}

export async function dismissReport(formData: FormData) {
  await run(formData, 'mod_resolve_report', { p_report_id: text(formData, 'report_id') }, 'Denuncia descartada.');
}

export async function muteUser(formData: FormData) {
  const days = Number(text(formData, 'days'));
  await run(formData, 'mod_mute_user', { p_user_id: text(formData, 'user_id'), p_days: Number.isInteger(days) ? days : -1, p_reason: text(formData, 'reason') || null },
    days === 0 ? 'Puede volver a publicar.' : `No va a poder publicar ni comentar por ${days} día${days === 1 ? '' : 's'}.`);
}
