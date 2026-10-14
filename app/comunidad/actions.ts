'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CATEGORIES, LIMITS, readLink } from '@/lib/community';
import { readPhoto } from '@/lib/photo';

const text = (formData: FormData, key: string) => String(formData.get(key) ?? '').trim();
const go = (path: string, key: 'ok' | 'error', message: string): never => redirect(`${path}?${key}=${encodeURIComponent(message.slice(0, 300))}`);
const uuid = (value: string) => (/^[0-9a-f-]{36}$/i.test(value) ? value : '');

// Los mensajes propios de la base se muestran tal cual; los técnicos, con una explicación simple.
const friendly = (message: string, fallback: string) => (/constraint|violates|syntax|permission|function/i.test(message) ? fallback : message);

async function client() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return supabase;
}

function readPost(formData: FormData): { error: string } | { title: string; body: string; link: string } {
  const title = text(formData, 'title');
  const body = text(formData, 'body');
  const link = readLink(formData.get('link'));
  if (title.length < 3 || title.length > LIMITS.title) return { error: `El título tiene que tener entre 3 y ${LIMITS.title} letras.` };
  if (!body || body.length > LIMITS.body) return { error: `Escribí el texto (hasta ${LIMITS.body} letras).` };
  if (link === null) return { error: 'El enlace tiene que empezar con https:// (por ejemplo, un video de YouTube o Instagram).' };
  return { title, body, link };
}

export async function createPost(formData: FormData) {
  const post = readPost(formData);
  if ('error' in post) return go('/comunidad', 'error', post.error);
  const category = text(formData, 'category');
  if (!CATEGORIES.some((c) => c.value === category)) go('/comunidad', 'error', 'Elegí de qué se trata.');
  const supabase = await client();
  const { data: id, error } = await supabase.rpc('community_create_post', {
    p_category: category, p_title: post.title, p_body: post.body, p_link: post.link || null, p_photo: readPhoto(formData.get('photo')),
  });
  if (error || !id) go('/comunidad', 'error', friendly(error?.message ?? '', 'No se pudo publicar. Probá de nuevo.'));
  revalidatePath('/comunidad');
  go(`/comunidad/${id}`, 'ok', '¡Publicado! Gracias por compartir.');
}

export async function updatePost(formData: FormData) {
  const id = uuid(text(formData, 'post_id'));
  const post = readPost(formData);
  if ('error' in post) return go(`/comunidad/${id}`, 'error', post.error);
  const supabase = await client();
  const { error } = await supabase.rpc('community_update_post', { p_post_id: id, p_title: post.title, p_body: post.body, p_link: post.link || null });
  if (error) go(`/comunidad/${id}`, 'error', friendly(error.message, 'No se pudieron guardar los cambios.'));
  revalidatePath('/comunidad');
  go(`/comunidad/${id}`, 'ok', 'Cambios guardados.');
}

export async function deleteOwn(formData: FormData) {
  const postId = uuid(text(formData, 'post_id'));
  const commentId = uuid(text(formData, 'comment_id'));
  const supabase = await client();
  const { error } = await supabase.rpc('community_delete_own', { p_post_id: commentId ? null : postId, p_comment_id: commentId || null });
  if (error) go(`/comunidad/${postId}`, 'error', 'No se pudo borrar.');
  revalidatePath('/comunidad');
  if (commentId) go(`/comunidad/${postId}`, 'ok', 'Comentario borrado.');
  go('/comunidad', 'ok', 'Publicación borrada.');
}

export async function addComment(formData: FormData) {
  const postId = uuid(text(formData, 'post_id'));
  const body = text(formData, 'body');
  if (!body || body.length > LIMITS.comment) go(`/comunidad/${postId}`, 'error', `Escribí tu comentario (hasta ${LIMITS.comment} letras).`);
  const supabase = await client();
  const { error } = await supabase.rpc('community_add_comment', { p_post_id: postId, p_body: body });
  if (error) go(`/comunidad/${postId}`, 'error', friendly(error.message, 'No se pudo comentar. Probá de nuevo.'));
  revalidatePath(`/comunidad/${postId}`);
  go(`/comunidad/${postId}`, 'ok', 'Comentario publicado.');
}

export async function report(formData: FormData) {
  const postId = uuid(text(formData, 'post_id'));
  const commentId = uuid(text(formData, 'comment_id'));
  const supabase = await client();
  const { error } = await supabase.rpc('community_report', {
    p_post_id: commentId ? null : postId, p_comment_id: commentId || null, p_reason: text(formData, 'reason').slice(0, LIMITS.reason) || 'Sin motivo',
  });
  if (error) go(`/comunidad/${postId}`, 'error', friendly(error.message, 'No se pudo enviar la denuncia.'));
  go(`/comunidad/${postId}`, 'ok', 'Gracias. La moderación lo va a revisar.');
}
