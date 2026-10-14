import Link from 'next/link';
import { SubmitButton } from '@/components/submit-button';
import { requireModerator } from '@/lib/admin';
import { dateOnly, errorBox, okBox, pageClass, primaryButton } from '@/lib/ui';
import { moderatePost } from './actions';

export const metadata = { title: 'Moderación', robots: { index: false, follow: false } };

const small = 'rounded-lg border border-neutral-300 px-2.5 py-1 text-xs dark:border-neutral-700';

// Panel del equipo para la Comunidad: publicar y revisar lo oculto. Nada más (no toca cuentas, precios ni ventas).
export default async function ModerationPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const { supabase, isAdmin } = await requireModerator();
  const [{ data: hiddenPosts }, { count }] = await Promise.all([
    supabase.from('community_posts').select('id,title,author_name,hidden_reason,created_at').eq('status', 'hidden').order('created_at', { ascending: false }).limit(50),
    supabase.from('community_posts').select('id', { count: 'exact', head: true }).eq('status', 'published'),
  ]);

  return (
    <main className={pageClass}>
      <header>
        <Link href={isAdmin ? '/admin' : '/'} className="text-sm text-neutral-500 dark:text-neutral-400">← {isAdmin ? 'Administración' : 'Inicio'}</Link>
        <h1 className="text-2xl font-semibold">Moderación</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">En la Comunidad publica solo el equipo; el resto lee. Hay {count ?? 0} publicaciones visibles. Al abrir una publicación podés editarla, ocultarla o destacarla.</p>
      </header>
      {ok && <div role="status" className={okBox}>{ok}</div>}
      {error && <div role="alert" className={errorBox}>{error}</div>}
      <div><Link href="/comunidad" className={`${primaryButton} inline-block`}>Ir a la Comunidad a publicar</Link></div>

      <section className="grid gap-3">
        <h2 className="font-semibold">Publicaciones ocultas</h2>
        {!hiddenPosts?.length && <p className="text-sm text-neutral-500">No hay publicaciones ocultas.</p>}
        {(hiddenPosts ?? []).map((p) => (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-neutral-200 bg-white p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div><Link href={`/comunidad/${p.id}`} className="font-medium underline">{p.title}</Link><p className="text-xs text-neutral-500">{p.author_name} · {dateOnly(p.created_at)}{p.hidden_reason ? ` · ${p.hidden_reason}` : ''}</p></div>
            <form action={moderatePost}><input type="hidden" name="post_id" value={p.id} /><input type="hidden" name="status" value="published" /><input type="hidden" name="back" value="/moderacion" /><SubmitButton className={small}>Volver a mostrar</SubmitButton></form>
          </div>
        ))}
      </section>
      <p className="text-xs text-neutral-500">Todo lo que se hace acá queda registrado en la auditoría.</p>
    </main>
  );
}
