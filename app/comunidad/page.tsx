import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAccessSnapshot } from '@/lib/access/permissions';
import { CATEGORIES, PAGE_SIZE } from '@/lib/community';
import { STAFF_LOGIN_PATH, hasStaffSession } from '@/lib/staff';
import { createClient } from '@/lib/supabase/server';
import { cardClass, errorBox, okBox, pageClass } from '@/lib/ui';
import { createPost } from './actions';
import { PostCard, type FeedPost } from './post-card';
import { PostForm } from './post-form';

export const metadata = { title: 'Comunidad · Calculadora Emprender' };

const chip = (active: boolean) => `rounded-full px-3 py-1.5 ${active ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-white dark:bg-neutral-900'}`;
const POST_FIELDS = 'id,author_name,official,category,title,body,link,photo,status,pinned,created_at,updated_at';

// Comunidad: consejos, tutoriales e inspiración que publica el equipo. Todas las cuentas la leen.
export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; tema?: string; pagina?: string }> }) {
  const { ok, error, tema, pagina } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const filter = CATEGORIES.some((c) => c.value === tema) ? tema! : null;
  const page = Math.min(Math.max(Number.parseInt(pagina ?? '1', 10) || 1, 1), 200);

  // Lo oculto solo lo ve el equipo (la base no se lo muestra a nadie más).
  let query = supabase.from('community_posts').select(POST_FIELDS)
    .order('pinned', { ascending: false }).order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  if (filter) query = query.eq('category', filter);
  const [snapshot, { data, error: loadError }] = await Promise.all([getAccessSnapshot(), query]);
  const posts = (data ?? []) as FeedPost[];
  const more = posts.length > PAGE_SIZE;
  const staff = Boolean(snapshot?.isModerator);
  const canPublish = staff && (await hasStaffSession(user.id));
  const pageLink = (n: number) => `/comunidad?${new URLSearchParams({ ...(filter ? { tema: filter } : {}), pagina: String(n) })}`;

  return (
    <main className={pageClass}>
      <header>
        <Link href="/" className="text-sm text-neutral-500 dark:text-neutral-400">← Inicio</Link>
        <h1 className="text-2xl font-semibold">Comunidad</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Consejos, tutoriales e ideas para tu taller, de parte del equipo de Calculadora Emprender.</p>
      </header>
      {ok && <div role="status" className={okBox}>{ok}</div>}
      {(error || loadError) && <div role="alert" className={errorBox}>{error ?? 'No se pudo cargar la comunidad.'}</div>}

      {canPublish && (
        <details className={cardClass}>
          <summary className="cursor-pointer font-semibold">Publicar</summary>
          <div className="mt-3"><PostForm action={createPost} submitLabel="Publicar" /></div>
        </details>
      )}
      {staff && !canPublish && <p className="text-sm text-neutral-500">Para publicar, entrá por el <a href={`${STAFF_LOGIN_PATH}?next=/comunidad`} className="underline">ingreso del equipo</a>.</p>}

      <nav aria-label="Filtrar por tema" className="flex flex-wrap gap-2 text-sm">
        <Link href="/comunidad" className={chip(!filter)}>Todo</Link>
        {CATEGORIES.map((c) => <Link key={c.value} href={`/comunidad?tema=${c.value}`} className={chip(filter === c.value)}>{c.emoji} {c.label}</Link>)}
      </nav>

      <section className="grid gap-4">
        {!posts.length && <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">{page > 1 ? 'No hay más publicaciones.' : 'Pronto vas a encontrar acá consejos y tutoriales.'}</div>}
        {posts.slice(0, PAGE_SIZE).map((post) => (
          <div key={post.id} className="grid gap-1">
            <PostCard post={post} />
            {staff && <Link href={`/comunidad/${post.id}`} className="px-2 text-xs text-neutral-500 underline">Editar, ocultar o destacar</Link>}
          </div>
        ))}
      </section>
      {(page > 1 || more) && (
        <nav aria-label="Más publicaciones" className="flex justify-between text-sm font-semibold">
          {page > 1 ? <Link href={pageLink(page - 1)} className="underline">← Más nuevas</Link> : <span />}
          {more && <Link href={pageLink(page + 1)} className="underline">Más viejas →</Link>}
        </nav>
      )}
    </main>
  );
}
