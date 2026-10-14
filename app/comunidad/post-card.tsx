import Link from 'next/link';
import { BadgeCheck, Pin, Video } from 'lucide-react';
import { categoryInfo } from '@/lib/community';
import { dateTime } from '@/lib/ui';

export type FeedPost = {
  id: string; author_name: string; official: boolean; category: string; title: string; body: string;
  link: string | null; photo: string | null; status: string; pinned: boolean; created_at: string; updated_at: string;
};

const LONG = 700;

// Una publicación como en un microblog: se lee entera en la lista (los textos largos se cortan con «Seguir leyendo»).
export function PostCard({ post, full = false }: { post: FeedPost; full?: boolean }) {
  const info = categoryInfo(post.category);
  const cut = !full && post.body.length > LONG;
  return (
    <article className="rounded-3xl bg-white p-5 dark:bg-neutral-900">
      <header className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-orange-100 font-semibold text-orange-800 dark:bg-orange-950 dark:text-orange-300">{post.author_name.slice(0, 1).toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-sm font-semibold">{post.author_name}{post.official && <BadgeCheck size={15} aria-label="Del equipo" className="text-orange-800 dark:text-orange-300" />}</p>
          <p className="text-xs text-neutral-500">{dateTime(post.created_at)} · {info.emoji} {info.label}</p>
        </div>
        {post.pinned && <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-800 dark:text-orange-300"><Pin size={13} aria-hidden="true" />Destacada</span>}
      </header>
      {post.status === 'hidden' && <p className="mt-3 rounded-xl bg-red-50 px-3 py-1.5 text-xs text-red-800 dark:bg-red-950/40 dark:text-red-200">Oculta: solo la ve el equipo.</p>}
      {full ? <h1 className="mt-3 text-2xl font-semibold">{post.title}</h1> : <h2 className="mt-3 text-lg font-semibold"><Link href={`/comunidad/${post.id}`} className="hover:underline">{post.title}</Link></h2>}
      <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-relaxed">{cut ? `${post.body.slice(0, LONG).trimEnd()}…` : post.body}</p>
      {cut && <Link href={`/comunidad/${post.id}`} className="mt-1 inline-block text-sm font-semibold text-orange-800 underline dark:text-orange-300">Seguir leyendo</Link>}
      {post.photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.photo} alt={`Foto de «${post.title}»`} loading="lazy" className="mt-3 max-h-[32rem] w-full rounded-2xl bg-neutral-100 object-contain dark:bg-neutral-800" />
      )}
      {post.link && <a href={post.link} target="_blank" rel="noopener noreferrer nofollow" className="mt-3 inline-flex items-center gap-2 rounded-xl bg-neutral-100 px-3 py-2 text-sm font-semibold dark:bg-neutral-800"><Video size={18} aria-hidden="true" />Ver el video</a>}
    </article>
  );
}
