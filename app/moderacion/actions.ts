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

// Ocultar, volver a mostrar o destacar. La base comprueba que sea del equipo y deja registro en la auditoría.
export async function moderatePost(formData: FormData) {
  const back = backTo(formData);
  const { supabase } = await requireModerator(back);
  const status = text(formData, 'status');
  const pinned = text(formData, 'pinned');
  const { error } = await supabase.rpc('mod_set_post', {
    p_post_id: text(formData, 'post_id'), p_status: status, p_pinned: pinned === '1' ? true : pinned === '0' ? false : null, p_reason: text(formData, 'reason') || null,
  });
  const ok = status === 'hidden' ? 'Publicación ocultada.' : pinned === '1' ? 'Publicación destacada.' : pinned === '0' ? 'Ya no está destacada.' : 'Publicación visible otra vez.';
  revalidatePath('/comunidad', 'layout');
  revalidatePath('/moderacion');
  redirect(`${back}?${error ? 'error' : 'ok'}=${encodeURIComponent((error?.message ?? ok).slice(0, 300))}`);
}
