import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { BadgeCheck, Flag, Pin, ShieldCheck, Video } from 'lucide-react';
import { SubmitButton } from '@/components/submit-button';
import { getAccessSnapshot } from '@/lib/access/permissions';
import { LIMITS, categoryInfo } from '@/lib/community';
import { hasStaffSession } from '@/lib/staff';
import { createClient } from '@/lib/supabase/server';
import { cardClass, dateTime, errorBox, inputClass, labelClass, okBox, pageClass, primaryButton, secondaryButton } from '@/lib/ui';
import { moderateComment, moderatePost, muteUser } from '../../moderacion/actions';
import { addComment, deleteOwn, report, updatePost } from '../actions';

export const metadata = { title: 'Comunidad · Calculadora Emprender' };

const small = 'rounded-lg border border-neutral-300 px-2.5 py-1 text-xs dark:border-neutral-700';

function ReportForm({ postId, commentId }: { postId: string; commentId?: string }) {
  return (
    <details className="text-xs">
      <summary className="inline-flex cursor-pointer items-center gap-1 text-neutral-500"><Flag size={12} aria-hidden="true" />Denunciar</summary>
      <form action={report} className="mt-2 flex flex-wrap gap-2">
        <input type="hidden" name="post_id" value={postId} />
        {commentId && <input type="hidden" name="comment_id" value={commentId} />}
        <select name="reason" className="rounded-lg border border-neutral-300 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-950">
          <option>Publicidad o spam</option><option>Falta de respeto</option><option>Información peligrosa</option><option>Datos personales</option><option>Otro motivo</option>
        </select>
        <SubmitButton className={small}>Enviar</SubmitButton>
      </form>
    </details>
  );
}

export default async function PostPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [{ id }, { ok, error }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [snapshot, { data: post }, { data: comments }] = await Promise.all([
    getAccessSnapshot(),
    supabase.from('community_posts').select('id,user_id,author_name,official,category,title,body,link,photo,status,hidden_reason,pinned,created_at,updated_at').eq('id', id).maybeSingle(),
    supabase.from('community_comments').select('id,user_id,author_name,official,body,status,created_at').eq('post_id', id).order('created_at').limit(300),
  ]);
  if (!post) notFound();
  // Las herramientas de moderación aparecen solo si entró por el ingreso del equipo.
  const moderating = Boolean(snapshot?.isModerator) && (await hasStaffSession(user.id));
  const mine = post.user_id === user.id;
  const info = categoryInfo(post.category);
  const back = `/comunidad/${post.id}`;

  return (
    <main className={pageClass}>
      <header>
        <Link href="/comunidad" className="text-sm text-neutral-500 dark:text-neutral-400">← Comunidad</Link>
      </header>
      {ok && <div role="status" className={okBox}>{ok}</div>}
      {error && <div role="alert" className={errorBox}>{error}</div>}
      {post.status === 'hidden' && <div className={errorBox}>La moderación ocultó esta publicación{post.hidden_reason ? `: ${post.hidden_reason}` : '.'} {mine ? 'Solo vos la ves.' : ''}</div>}

      <article className={cardClass}>
        <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
          {post.pinned && <span className="inline-flex items-center gap-1 font-semibold text-orange-800 dark:text-orange-300"><Pin size={13} aria-hidden="true" />Destacada</span>}
          <span>{info.emoji} {info.label}</span>
        </div>
        <h1 className="mt-1 text-2xl font-semibold">{post.title}</h1>
        <p className="mt-1 inline-flex items-center gap-1 text-sm text-neutral-500">
          {post.author_name}{post.official && <><BadgeCheck size={15} aria-hidden="true" className="text-orange-800 dark:text-orange-300" /><span className="text-xs font-semibold text-orange-800 dark:text-orange-300">Oficial</span></>} · {dateTime(post.created_at)}
        </p>
        {post.photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.photo} alt={`Foto de «${post.title}»`} className="mt-4 max-h-[28rem] w-full rounded-2xl object-contain bg-neutral-100 dark:bg-neutral-800" />
        )}
        <p className="mt-4 whitespace-pre-wrap break-words">{post.body}</p>
        {post.link && <a href={post.link} target="_blank" rel="noopener noreferrer nofollow ugc" className="mt-4 inline-flex items-center gap-2 font-semibold text-orange-800 underline dark:text-orange-300"><Video size={18} aria-hidden="true" />Ver el video o enlace</a>}

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
          {mine ? (
            <>
              <details className="w-full text-sm">
                <summary className="cursor-pointer text-neutral-500">Editar</summary>
                <form action={updatePost} className="mt-2 grid gap-2">
                  <input type="hidden" name="post_id" value={post.id} />
                  <label className={labelClass}>Título<input name="title" defaultValue={post.title} required minLength={3} maxLength={LIMITS.title} className={inputClass} /></label>
                  <label className={labelClass}>Texto<textarea name="body" defaultValue={post.body} required maxLength={LIMITS.body} rows={6} className={inputClass} /></label>
                  <label className={labelClass}>Enlace (opcional)<input name="link" type="url" defaultValue={post.link ?? ''} maxLength={LIMITS.link} className={inputClass} /></label>
                  <div><SubmitButton className={primaryButton}>Guardar cambios</SubmitButton></div>
                </form>
              </details>
              <form action={deleteOwn}><input type="hidden" name="post_id" value={post.id} /><SubmitButton className="text-xs text-red-700 underline dark:text-red-300">Borrar mi publicación</SubmitButton></form>
            </>
          ) : <ReportForm postId={post.id} />}
        </div>

        {moderating && (
          <div className="mt-3 grid gap-2 rounded-2xl bg-neutral-100 p-3 text-sm dark:bg-neutral-800">
            <p className="inline-flex items-center gap-1 font-semibold"><ShieldCheck size={16} aria-hidden="true" />Moderación</p>
            <div className="flex flex-wrap gap-2">
              {post.status === 'published' ? (
                <form action={moderatePost} className="flex flex-wrap gap-2">
                  <input type="hidden" name="post_id" value={post.id} /><input type="hidden" name="status" value="hidden" /><input type="hidden" name="back" value={back} />
                  <input name="reason" maxLength={LIMITS.reason} placeholder="Motivo (lo ve la autora)" className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-950" />
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
              {!post.official && !mine && (
                <form action={muteUser} className="flex flex-wrap gap-2">
                  <input type="hidden" name="user_id" value={post.user_id} /><input type="hidden" name="back" value={back} />
                  <select name="days" defaultValue="3" className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-950"><option value="1">1 día</option><option value="3">3 días</option><option value="7">7 días</option><option value="30">30 días</option></select>
                  <SubmitButton className={small}>Pausar a la autora</SubmitButton>
                </form>
              )}
            </div>
          </div>
        )}
      </article>

      <section className="grid gap-3">
        <h2 className="font-semibold">Comentarios</h2>
        {!comments?.length && <p className="text-sm text-neutral-500">Todavía no hay comentarios.</p>}
        {(comments ?? []).map((c) => (
          <div key={c.id} className={`rounded-2xl border p-3 ${c.status === 'hidden' ? 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20' : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900'}`}>
            <p className="inline-flex items-center gap-1 text-xs text-neutral-500">{c.author_name}{c.official && <BadgeCheck size={13} aria-label="Oficial" className="text-orange-800 dark:text-orange-300" />} · {dateTime(c.created_at)}{c.status === 'hidden' && ' · oculto por la moderación'}</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm">{c.body}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {c.user_id === user.id
                ? <form action={deleteOwn}><input type="hidden" name="post_id" value={post.id} /><input type="hidden" name="comment_id" value={c.id} /><SubmitButton className="text-xs text-red-700 underline dark:text-red-300">Borrar</SubmitButton></form>
                : <ReportForm postId={post.id} commentId={c.id} />}
              {moderating && (
                <form action={moderateComment}>
                  <input type="hidden" name="comment_id" value={c.id} /><input type="hidden" name="back" value={back} />
                  <input type="hidden" name="status" value={c.status === 'hidden' ? 'published' : 'hidden'} />
                  <SubmitButton className={small}>{c.status === 'hidden' ? 'Volver a mostrar' : 'Ocultar comentario'}</SubmitButton>
                </form>
              )}
            </div>
          </div>
        ))}
        {post.status === 'published' && (
          <form action={addComment} className="grid gap-2">
            <input type="hidden" name="post_id" value={post.id} />
            <label className={labelClass}>Tu comentario<textarea name="body" required maxLength={LIMITS.comment} rows={3} placeholder="Escribí una respuesta o tu experiencia" className={inputClass} /></label>
            <div><SubmitButton className={secondaryButton}>Comentar</SubmitButton></div>
          </form>
        )}
      </section>
    </main>
  );
}
