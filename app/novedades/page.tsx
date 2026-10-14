import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { getAccessSnapshot } from '@/lib/access/permissions';
import { forAudience, kindLabel, type Announcement } from '@/lib/announcements';
import { createClient } from '@/lib/supabase/server';
import { dateOnly } from '@/lib/ui';

export const metadata = { title: 'Novedades · Calculadora Emprender' };

// Todos los avisos vigentes, por si alguien cerró la ventanita y quiere volver a leerlos.
export default async function NewsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const [snapshot, { data }] = await Promise.all([
    getAccessSnapshot(),
    supabase.from('announcements').select('id,kind,title,body,image,button_label,button_link,audience,starts_at')
      .eq('active', true).lte('starts_at', new Date().toISOString()).order('starts_at', { ascending: false }).limit(30),
  ]);
  const list = ((data ?? []) as Announcement[]).filter((a) => forAudience(a.audience, snapshot));
  return (
    <AppShell>
      <h1 className="text-3xl">Novedades</h1>
      <p className="mt-1 text-neutral-600 dark:text-neutral-300">Actualizaciones, cambios y promociones de Calculadora Emprender.</p>
      <div className="mt-5 grid gap-3">
        {!list.length && <p className="rounded-3xl bg-white p-5 text-sm text-neutral-500 dark:bg-neutral-900">No hay novedades por ahora.</p>}
        {list.map((a) => (
          <article key={a.id} className="overflow-hidden rounded-3xl bg-white dark:bg-neutral-900">
            {a.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.image} alt="" loading="lazy" className="max-h-56 w-full object-cover" />
            )}
            <div className="p-5">
              <p className="text-xs font-semibold text-orange-800 dark:text-orange-300">{kindLabel(a.kind)} · {dateOnly(a.starts_at)}</p>
              <h2 className="mt-1 text-lg font-semibold">{a.title}</h2>
              <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-300">{a.body}</p>
              {a.button_link && a.button_label && (a.button_link.startsWith('https://')
                ? <a href={a.button_link} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block font-semibold text-orange-800 underline dark:text-orange-300">{a.button_label}</a>
                : <Link href={a.button_link} className="mt-3 inline-block font-semibold text-orange-800 underline dark:text-orange-300">{a.button_label}</Link>)}
            </div>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
