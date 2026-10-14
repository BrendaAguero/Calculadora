import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { SubmitButton } from '@/components/submit-button';
import { getAccessSnapshot } from '@/lib/access/permissions';
import { LIMITS } from '@/lib/community';
import { hasStaffSession } from '@/lib/staff';
import { createClient } from '@/lib/supabase/server';
import { cardClass, errorBox, okBox, pageClass } from '@/lib/ui';
import { moderatePost } from '../../moderacion/actions';
import { deleteOwnPost, editPost } from '../actions';
import { PostCard, type FeedPost } from '../post-card';
import { PostForm } from '../post-form';

export const metadata = { title: 'Comunidad · Calculadora Emprender' };

const small = 'rounded-lg border border-neutral-300 px-2.5 py-1 text-xs dark:border-neutral-700';

export default async function PostPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [{ id }, { ok, error }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [snapshot, { data }] = await Promise.all([
    getAccessSnapshot(),
    supabase.from('community_posts').select('id,user_id,author_name,official,category,title,body,link,photo,has_photo,status,pinned,created_at,updated_at').eq('id', id).maybeSingle(),
  ]);
  if (!data) notFound();
  const post = data as FeedPost & { user_id: string; has_photo: boolean };
  // Las herramientas del equipo aparecen solo si entró por el ingreso del equipo.
  const staff = Boolean(snapshot?.isModerator) && (await hasStaffSession(user.id));
  const mine = post.user_id === user.id;
  const canEdit = staff && (mine || Boolean(snapshot?.isAdmin));
  const back = `/comunidad/${post.id}`;

  return (
    <main className={pageClass}>
      <header><Link href="/comunidad" className="text-sm text-neutral-500 dark:text-neutral-400">← Comunidad</Link></header>
      {ok && <div role="status" className={okBox}>{ok}</div>}
      {error && <div role="alert" className={errorBox}>{error}</div>}
      <PostCard post={post} full />

      {staff && (
        <section className={`${cardClass} grid gap-3 text-sm`}>
          <p className="inline-flex items-center gap-1 font-semibold"><ShieldCheck size={16} aria-hidden="true" />Equipo</p>
          <div className="flex flex-wrap gap-2">
            {post.status === 'published' ? (
              <form action={moderatePost} className="flex flex-wrap gap-2">
                <input type="hidden" name="post_id" value={post.id} /><input type="hidden" name="status" value="hidden" /><input type="hidden" name="back" value={back} />
                <input name="reason" maxLength={LIMITS.reason} placeholder="Motivo (opcional)" className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-950" />
                <SubmitButton className={small}>Ocultar</SubmitButton>
              </form>
            ) : (
              <form action={moderatePost}><input type="hidden" name="post_id" value={post.id} /><input type="hidden" name="status" value="published" /><input type="hidden" name="back" value={back} /><SubmitButton className={small}>Volver a mostrar</SubmitButton></form>
            )}
            <form action={moderatePost}>
              <input type="hidden" name="post_id" value={post.id} /><input type="hidden" name="status" value={post.status} /><input type="hidden" name="back" value={back} />
              <input type="hidden" name="pinned" value={post.pinned ? '0' : '1'} />
              <SubmitButton className={small}>{post.pinned ? 'Quitar destacado' : 'Destacar arriba'}</SubmitButton>
            </form>
            {mine && <form action={deleteOwnPost}><input type="hidden" name="post_id" value={post.id} /><SubmitButton className={`${small} text-red-700 dark:text-red-300`}>Borrar</SubmitButton></form>}
          </div>
          {canEdit && (
            <details>
              <summary className="cursor-pointer font-semibold">Editar</summary>
              <div className="mt-3"><PostForm action={editPost} post={post} submitLabel="Guardar cambios" /></div>
            </details>
          )}
        </section>
      )}
    </main>
  );
}
