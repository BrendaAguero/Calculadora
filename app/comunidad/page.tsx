import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BadgeCheck, Camera, MessageCircle, Pin, Video } from 'lucide-react';
import { PhotoInput } from '@/components/photo-input';
import { SubmitButton } from '@/components/submit-button';
import { getAccessSnapshot } from '@/lib/access/permissions';
import { CATEGORIES, LIMITS, categoryInfo } from '@/lib/community';
import { createClient } from '@/lib/supabase/server';
import { cardClass, dateOnly, errorBox, inputClass, labelClass, okBox, pageClass, primaryButton } from '@/lib/ui';
import { createPost } from './actions';

export const metadata = { title: 'Comunidad · Calculadora Emprender' };

const chip = (active: boolean) => `rounded-full px-3 py-1.5 ${active ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-neutral-100 dark:bg-neutral-800'}`;

export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; tema?: string }> }) {
  const { ok, error, tema } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const filter = CATEGORIES.some((c) => c.value === tema) ? tema! : null;

  // Sin la foto: la lista carga rápido y la foto se ve al abrir la publicación.
  let query = supabase.from('community_posts')
    .select('id,user_id,author_name,official,category,title,body,link,has_photo,status,pinned,comment_count,created_at')
    .or(`status.eq.published,user_id.eq.${user.id}`)
    .order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(60);
  if (filter) query = query.eq('category', filter);
  const [snapshot, { data: posts, error: loadError }, { data: mute }] = await Promise.all([
    getAccessSnapshot(),
    query,
    supabase.from('community_mutes').select('until').eq('user_id', user.id).gt('until', new Date().toISOString()).maybeSingle(),
  ]);
  const staff = Boolean(snapshot?.isModerator);

  return (
    <main className={pageClass}>
      <header>
        <Link href="/" className="text-sm text-neutral-500 dark:text-neutral-400">← Inicio</Link>
        <h1 className="text-2xl font-semibold">Comunidad</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Consejos, tutoriales, preguntas y trabajos de otras emprendedoras. Compartí lo que sabés y preguntá lo que no.</p>
      </header>
      {ok && <div role="status" className={okBox}>{ok}</div>}
      {(error || loadError) && <div role="alert" className={errorBox}>{error ?? 'No se pudo cargar la comunidad.'}</div>}

      {mute ? (
        <div className={errorBox}>La moderación pausó tus publicaciones hasta el {dateOnly(mute.until)}. Podés seguir leyendo.</div>
      ) : (
        <details className={cardClass} open={!posts?.length}>
          <summary className="cursor-pointer font-semibold">Publicar algo</summary>
          <form action={createPost} className="mt-3 grid gap-3">
            <label className={labelClass}>¿De qué se trata?
              <select name="category" defaultValue="consejo" className={inputClass}>
                {CATEGORIES.filter((c) => staff || c.value !== 'tutorial').map((c) => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
              </select>
            </label>
            <label className={labelClass}>Título<input name="title" required minLength={3} maxLength={LIMITS.title} placeholder="Ej.: Cómo evitar burbujas en la resina" className={inputClass} /></label>
            <label className={labelClass}>Texto<textarea name="body" required maxLength={LIMITS.body} rows={5} placeholder="Contá paso a paso, qué materiales usaste, qué te funcionó…" className={inputClass} /></label>
            <label className={labelClass}>Enlace a un video (opcional)<input name="link" type="url" maxLength={LIMITS.link} placeholder="https://www.youtube.com/…" className={inputClass} /></label>
            <PhotoInput />
            <p className="text-xs text-neutral-500">Se publica con el nombre de tu perfil. Respetá a las demás: nada de publicidad ni datos personales de otras personas.{staff ? ' Como sos del equipo, tus publicaciones llevan la marca «Oficial».' : ''}</p>
            <div><SubmitButton className={primaryButton}>Publicar</SubmitButton></div>
          </form>
        </details>
      )}

      <nav aria-label="Filtrar por tema" className="flex flex-wrap gap-2 text-sm">
        <Link href="/comunidad" className={chip(!filter)}>Todo</Link>
        {CATEGORIES.map((c) => <Link key={c.value} href={`/comunidad?tema=${c.value}`} className={chip(filter === c.value)}>{c.emoji} {c.label}</Link>)}
      </nav>

      <section className="grid gap-3">
        {!posts?.length && <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">{filter ? 'Todavía no hay publicaciones de este tema.' : 'Todavía no hay publicaciones. ¡Sé la primera!'}</div>}
        {(posts ?? []).map((post) => {
          const info = categoryInfo(post.category);
          return (
            <Link key={post.id} href={`/comunidad/${post.id}`} className="grid gap-1.5 rounded-2xl border border-neutral-200 bg-white p-4 transition hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                {post.pinned && <span className="inline-flex items-center gap-1 font-semibold text-orange-800 dark:text-orange-300"><Pin size={13} aria-hidden="true" />Destacada</span>}
                <span>{info.emoji} {info.label}</span>
                {post.status === 'hidden' && <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-800 dark:bg-red-950 dark:text-red-200">Oculta por la moderación</span>}
              </div>
              <h2 className="font-semibold">{post.title}</h2>
              <p className="line-clamp-2 text-sm text-neutral-600 dark:text-neutral-400">{post.body}</p>
              <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
                <span className="inline-flex items-center gap-1">{post.author_name}{post.official && <BadgeCheck size={14} aria-label="Oficial" className="text-orange-800 dark:text-orange-300" />}</span>
                <span>{dateOnly(post.created_at)}</span>
                <span className="inline-flex items-center gap-1"><MessageCircle size={13} aria-hidden="true" />{post.comment_count}</span>
                {post.has_photo && <Camera size={13} aria-label="Con foto" />}
                {post.link && <Video size={13} aria-label="Con video" />}
              </div>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
