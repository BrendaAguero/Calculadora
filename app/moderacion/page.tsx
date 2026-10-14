import Link from 'next/link';
import { SubmitButton } from '@/components/submit-button';
import { one, requireModerator } from '@/lib/admin';
import { cardClass, dateOnly, dateTime, errorBox, okBox, pageClass } from '@/lib/ui';
import { dismissReport, moderateComment, moderatePost, muteUser } from './actions';

export const metadata = { title: 'Moderación', robots: { index: false, follow: false } };

const small = 'rounded-lg border border-neutral-300 px-2.5 py-1 text-xs dark:border-neutral-700';
const hidden = (name: string, value: string) => <input type="hidden" name={name} value={value} />;

// Panel de moderación: denuncias, lo ocultado y las personas pausadas. Nada más (la moderación no toca cuentas, precios ni ventas).
export default async function ModerationPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const { supabase, isAdmin } = await requireModerator();
  const now = new Date().toISOString();
  const [{ data: reports }, { data: hiddenPosts }, { data: mutes }] = await Promise.all([
    supabase.from('community_reports')
      .select('id,reason,created_at,post_id,comment_id,community_posts(id,title,status),community_comments(id,body,status,post_id)')
      .eq('status', 'open').order('created_at', { ascending: false }).limit(100),
    supabase.from('community_posts').select('id,title,author_name,hidden_reason,updated_at,created_at').eq('status', 'hidden').order('created_at', { ascending: false }).limit(30),
    supabase.from('community_mutes').select('user_id,until,reason').gt('until', now).order('until'),
  ]);

  return (
    <main className={pageClass}>
      <header>
        <Link href={isAdmin ? '/admin' : '/'} className="text-sm text-neutral-500 dark:text-neutral-400">← {isAdmin ? 'Administración' : 'Inicio'}</Link>
        <h1 className="text-2xl font-semibold">Moderación</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Revisá las denuncias de la <Link href="/comunidad" className="underline">Comunidad</Link>. Al abrir una publicación vas a ver también las herramientas para ocultar, destacar o pausar a alguien.</p>
      </header>
      {ok && <div role="status" className={okBox}>{ok}</div>}
      {error && <div role="alert" className={errorBox}>{error}</div>}

      <section className="grid gap-3">
        <h2 className="font-semibold">Denuncias para revisar ({reports?.length ?? 0})</h2>
        {!reports?.length && <p className="text-sm text-neutral-500">No hay denuncias pendientes. 🎉</p>}
        {(reports ?? []).map((r) => {
          const post = one(r.community_posts) as { id: string; title: string; status: string } | null;
          const comment = one(r.community_comments) as { id: string; body: string; status: string; post_id: string } | null;
          const postId = post?.id ?? comment?.post_id ?? '';
          return (
            <article key={r.id} className={cardClass}>
              <p className="text-xs text-neutral-500">{dateTime(r.created_at)} · Motivo: <strong>{r.reason}</strong></p>
              <p className="mt-1 text-sm">{comment ? <>Comentario: «{comment.body.slice(0, 200)}»</> : <>Publicación: «{post?.title}»</>}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {postId && <Link href={`/comunidad/${postId}`} className={small}>Ver</Link>}
                {comment && comment.status === 'published' && <form action={moderateComment}>{hidden('comment_id', comment.id)}{hidden('status', 'hidden')}{hidden('back', '/moderacion')}<SubmitButton className={small}>Ocultar comentario</SubmitButton></form>}
                {!comment && post?.status === 'published' && <form action={moderatePost}>{hidden('post_id', post.id)}{hidden('status', 'hidden')}{hidden('reason', r.reason)}{hidden('back', '/moderacion')}<SubmitButton className={small}>Ocultar publicación</SubmitButton></form>}
                <form action={dismissReport}>{hidden('report_id', r.id)}{hidden('back', '/moderacion')}<SubmitButton className={small}>Está bien, descartar</SubmitButton></form>
              </div>
            </article>
          );
        })}
      </section>

      <section className="grid gap-3">
        <h2 className="font-semibold">Publicaciones ocultas</h2>
        {!hiddenPosts?.length && <p className="text-sm text-neutral-500">No hay publicaciones ocultas.</p>}
        {(hiddenPosts ?? []).map((p) => (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-neutral-200 bg-white p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div><Link href={`/comunidad/${p.id}`} className="font-medium underline">{p.title}</Link><p className="text-xs text-neutral-500">{p.author_name} · {dateOnly(p.created_at)}{p.hidden_reason ? ` · ${p.hidden_reason}` : ''}</p></div>
            <form action={moderatePost}>{hidden('post_id', p.id)}{hidden('status', 'published')}{hidden('back', '/moderacion')}<SubmitButton className={small}>Volver a mostrar</SubmitButton></form>
          </div>
        ))}
      </section>

      <section className="grid gap-3">
        <h2 className="font-semibold">Personas pausadas</h2>
        {!mutes?.length && <p className="text-sm text-neutral-500">Nadie está pausado.</p>}
        {(mutes ?? []).map((m) => (
          <div key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-neutral-200 bg-white p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900">
            <p>Hasta el {dateTime(m.until)}{m.reason ? ` · ${m.reason}` : ''}</p>
            <form action={muteUser}>{hidden('user_id', m.user_id)}{hidden('days', '0')}{hidden('back', '/moderacion')}<SubmitButton className={small}>Levantar la pausa</SubmitButton></form>
          </div>
        ))}
      </section>
      <p className="text-xs text-neutral-500">Todo lo que se hace acá queda registrado. La moderación no borra: oculta, y se puede deshacer.</p>
    </main>
  );
}
