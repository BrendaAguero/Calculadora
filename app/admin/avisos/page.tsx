import Link from 'next/link';
import { SubmitButton } from '@/components/submit-button';
import { requireAdmin } from '@/lib/admin';
import { audienceLabel, kindLabel } from '@/lib/announcements';
import { cardClass, dateTime, errorBox, okBox, pageClass } from '@/lib/ui';
import { setAnnouncementActive } from '../actions';
import { AnnouncementForm } from './announcement-form';

// Avisos emergentes: aparecen una vez en una ventanita al abrir la app (y quedan en «Novedades»).
export default async function AnnouncementsAdminPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const { supabase } = await requireAdmin();
  const [{ data: rows }, { data: reads }] = await Promise.all([
    supabase.from('announcements').select('id,kind,title,body,image,button_label,button_link,audience,starts_at,ends_at,active,created_at').order('created_at', { ascending: false }).limit(50),
    supabase.from('announcement_reads').select('announcement_id').limit(20000),
  ]);
  const seen = new Map<string, number>();
  for (const r of reads ?? []) seen.set(r.announcement_id, (seen.get(r.announcement_id) ?? 0) + 1);
  const now = new Date().getTime();
  const state = (r: { active: boolean; starts_at: string; ends_at: string | null }) =>
    !r.active ? 'Pausado' : Date.parse(r.starts_at) > now ? 'Programado' : r.ends_at && Date.parse(r.ends_at) <= now ? 'Terminado' : 'Se está mostrando';

  return (
    <main className={pageClass}>
      <header>
        <Link href="/admin" className="text-sm text-neutral-500 dark:text-neutral-400">← Administración</Link>
        <h1 className="text-2xl font-semibold">Avisos emergentes</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Una ventanita que aparece al abrir la app, una sola vez por persona. Sirve para novedades, cambios, promociones o avisos importantes. Si hay varios, se muestra primero el más nuevo. También quedan en la pantalla <Link href="/novedades" className="underline">Novedades</Link>.</p>
      </header>
      {ok && <div role="status" className={okBox}>{ok}</div>}
      {error && <div role="alert" className={errorBox}>{error}</div>}

      <details className={cardClass} open={!rows?.length}>
        <summary className="cursor-pointer font-semibold">Crear un aviso</summary>
        <div className="mt-3"><AnnouncementForm /></div>
      </details>

      <section className="grid gap-3">
        {(rows ?? []).map((r) => (
          <article key={r.id} className={cardClass}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs text-neutral-500">{kindLabel(r.kind)} · {audienceLabel(r.audience)} · desde {dateTime(r.starts_at)}{r.ends_at ? ` hasta ${dateTime(r.ends_at)}` : ''}</p>
                <h2 className="font-semibold">{r.title}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-400">{r.body}</p>
                <p className="mt-1 text-xs text-neutral-500">Lo vieron y cerraron: <strong>{seen.get(r.id) ?? 0}</strong></p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs ${state(r) === 'Se está mostrando' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'}`}>{state(r)}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <form action={setAnnouncementActive}>
                <input type="hidden" name="id" value={r.id} /><input type="hidden" name="active" value={r.active ? '0' : '1'} />
                <SubmitButton className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs dark:border-neutral-700">{r.active ? 'Pausar' : 'Activar'}</SubmitButton>
              </form>
            </div>
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-neutral-500">Editar</summary>
              <div className="mt-3"><AnnouncementForm row={r} /></div>
            </details>
          </article>
        ))}
      </section>
    </main>
  );
}
