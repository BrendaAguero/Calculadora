import Link from 'next/link';
import { SubmitButton } from '@/components/submit-button';
import { requireAdmin } from '@/lib/admin';
import { AUTO_RULES, audienceLabel, kindLabel } from '@/lib/announcements';
import { cardClass, dateTime, errorBox, okBox, pageClass } from '@/lib/ui';
import { setAnnouncementActive } from '../actions';
import { AnnouncementForm } from './announcement-form';
import { AutoNoticeForm, type AutoRow } from './auto-notice-form';

// Avisos emergentes: aparecen una vez en una ventanita al abrir la app (y quedan en «Novedades»).
export default async function AnnouncementsAdminPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const { supabase } = await requireAdmin();
  const nowIso = new Date().toISOString();
  const [{ data: rows }, { data: reads }, { data: autos }, { data: autoLog }, { count: offers }, { count: discountedOrders }] = await Promise.all([
    supabase.from('announcements').select('id,kind,title,body,image,button_label,button_link,audience,target_users,starts_at,ends_at,active,created_at').order('created_at', { ascending: false }).limit(50),
    supabase.from('announcement_reads').select('announcement_id').limit(20000),
    supabase.from('auto_notices').select('code,active,kind,title,body,button_label,button_link,days,discount_pct,offer_days,repeat_days').order('sort'),
    supabase.from('auto_notice_log').select('code').limit(50000),
    supabase.from('user_offers').select('id', { count: 'exact', head: true }).gt('expires_at', nowIso),
    supabase.from('personal_orders').select('id', { count: 'exact', head: true }).gt('discount_pct', 0).eq('status', 'approved'),
  ]);
  // Emails de las cuentas de los avisos dirigidos (para verlos y editarlos).
  const targetIds = [...new Set((rows ?? []).flatMap((r) => (r.target_users ?? []) as string[]))];
  const { data: targetProfiles } = targetIds.length ? await supabase.from('profiles').select('id,email').in('id', targetIds) : { data: [] };
  const emailOf = new Map((targetProfiles ?? []).map((p) => [p.id, p.email as string]));
  const shown = new Map<string, number>();
  for (const g of autoLog ?? []) shown.set(g.code, (shown.get(g.code) ?? 0) + 1);
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
                <p className="text-xs text-neutral-500">{kindLabel(r.kind)} · {audienceLabel(r.audience)}{r.audience === 'users' ? ` (${(r.target_users ?? []).length})` : ''} · desde {dateTime(r.starts_at)}{r.ends_at ? ` hasta ${dateTime(r.ends_at)}` : ''}</p>
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
              <div className="mt-3"><AnnouncementForm row={{ ...r, target_emails: ((r.target_users ?? []) as string[]).map((id) => emailOf.get(id)).filter(Boolean).join(', ') }} /></div>
            </details>
          </article>
        ))}
      </section>

      <section className="grid gap-3">
        <div>
          <h2 className="text-xl font-semibold">Avisos automáticos</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">La app los muestra sola a quien cumple la condición, como mucho uno por vez y nunca a la administración, moderadoras ni cuentas de prueba. Empiezan apagados: encendé los que quieras. Los descuentos se aplican solos cuando esa persona compra con su email. Hoy hay <strong>{offers ?? 0}</strong> descuentos vigentes y <strong>{discountedOrders ?? 0}</strong> compras pagadas con descuento.</p>
        </div>
        {((autos ?? []) as AutoRow[]).map((a) => (
          <article key={a.code} className={cardClass}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">{AUTO_RULES[a.code]?.name ?? a.code}</h3>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{AUTO_RULES[a.code]?.when}</p>
                <p className="mt-1 text-xs text-neutral-500">Se mostró a <strong>{shown.get(a.code) ?? 0}</strong> cuenta(s){a.discount_pct > 0 && AUTO_RULES[a.code]?.discount ? ` · descuento del ${a.discount_pct} % por ${a.offer_days} días` : ''}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs ${a.active ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'}`}>{a.active ? 'Encendido' : 'Apagado'}</span>
            </div>
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-neutral-500">Configurar</summary>
              <div className="mt-3"><AutoNoticeForm row={a} /></div>
            </details>
          </article>
        ))}
      </section>
    </main>
  );
}
