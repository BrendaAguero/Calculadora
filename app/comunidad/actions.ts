'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireModerator } from '@/lib/admin';
import { CATEGORIES, LIMITS, readLink } from '@/lib/community';
import { removePhoto, uploadPhoto } from '@/lib/photos';

const text = (formData: FormData, key: string) => String(formData.get(key) ?? '').trim();
const go = (path: string, key: 'ok' | 'error', message: string): never => redirect(`${path}?${key}=${encodeURIComponent(message.slice(0, 300))}`);
const uuid = (value: string) => (/^[0-9a-f-]{36}$/i.test(value) ? value : '');

// Los mensajes propios de la base se muestran tal cual; los técnicos, con una explicación simple.
const friendly = (message: string, fallback: string) => (/constraint|violates|syntax|permission|function/i.test(message) ? fallback : message);

type Post = { category: string; title: string; body: string; link: string };
function readPost(formData: FormData): { error: string } | Post {
  const category = text(formData, 'category');
  const title = text(formData, 'title');
  const body = text(formData, 'body');
  const link = readLink(formData.get('link'));
  if (!CATEGORIES.some((c) => c.value === category)) return { error: 'Elegí de qué se trata.' };
  if (title.length < 3 || title.length > LIMITS.title) return { error: `El título tiene que tener entre 3 y ${LIMITS.title} letras.` };
  if (!body || body.length > LIMITS.body) return { error: `Escribí el texto (hasta ${LIMITS.body} letras).` };
  if (link === null) return { error: 'El enlace tiene que empezar con https:// (por ejemplo, un video de YouTube o Instagram).' };
  return { category, title, body, link };
}

// Solo el equipo publica, y solo si entró por el ingreso del equipo. La base lo vuelve a comprobar.
export async function createPost(formData: FormData) {
  const { supabase } = await requireModerator('/comunidad');
  const post = readPost(formData);
  if ('error' in post) return go('/comunidad', 'error', post.error);
  const { data: id, error } = await supabase.rpc('community_create_post', {
    p_category: post.category, p_title: post.title, p_body: post.body, p_link: post.link || null, p_photo: await uploadPhoto(formData.get('photo'), 'publicas', 'comunidad'),
  });
  if (error || !id) go('/comunidad', 'error', friendly(error?.message ?? '', 'No se pudo publicar. Probá de nuevo.'));
  revalidatePath('/comunidad');
  go('/comunidad', 'ok', 'Publicado.');
}

export async function editPost(formData: FormData) {
  const id = uuid(text(formData, 'post_id'));
  const back = `/comunidad/${id}`;
  const { supabase } = await requireModerator(back);
  const post = readPost(formData);
  if ('error' in post) return go(back, 'error', post.error);
  const keep = text(formData, 'photo_action') === 'keep';
  const { data: before } = await supabase.from('community_posts').select('photo').eq('id', id).maybeSingle();
  const photo = keep ? null : await uploadPhoto(formData.get('photo'), 'publicas', 'comunidad');
  const { error } = await supabase.rpc('community_edit_post', {
    p_post_id: id, p_category: post.category, p_title: post.title, p_body: post.body, p_link: post.link || null, p_photo: photo, p_keep_photo: keep,
  });
  if (error) {
    await removePhoto(photo);
    go(back, 'error', friendly(error.message, 'No se pudieron guardar los cambios.'));
  }
  if (!keep) await removePhoto(before?.photo);
  revalidatePath('/comunidad', 'layout');
  go(back, 'ok', 'Cambios guardados.');
}

export async function deleteOwnPost(formData: FormData) {
  const id = uuid(text(formData, 'post_id'));
  const { supabase } = await requireModerator(`/comunidad/${id}`);
  const { data: before } = await supabase.from('community_posts').select('photo').eq('id', id).maybeSingle();
  const { error } = await supabase.rpc('community_delete_own', { p_post_id: id, p_comment_id: null });
  if (error) go(`/comunidad/${id}`, 'error', 'Solo quien la publicó puede borrarla.');
  await removePhoto(before?.photo);
  revalidatePath('/comunidad');
  go('/comunidad', 'ok', 'Publicación borrada.');
}
