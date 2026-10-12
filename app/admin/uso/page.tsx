import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { NAV_GROUPS } from '@/lib/nav';
import { cardClass, errorBox, pageClass } from '@/lib/ui';

const DAYS = [7, 30, 90];
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

// Qué pantallas se usan (sin datos personales: solo cuántas veces se abrió cada una por día).
export default async function UsagePage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const { dias } = await searchParams;
  const days = DAYS.includes(Number(dias)) ? Number(dias) : 30;
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.from('usage_daily').select('path,simple,views').gte('day', daysAgo(days)).limit(20000);

  const byPath = new Map<string, { simple: number; normal: number }>();
  for (const row of data ?? []) {
    const entry = byPath.get(row.path) ?? { simple: 0, normal: 0 };
    if (row.simple) entry.simple += row.views; else entry.normal += row.views;
    byPath.set(row.path, entry);
  }
  const rows = [...byPath.entries()].map(([path, v]) => ({ path, ...v, total: v.simple + v.normal })).sort((a, b) => b.total - a.total);
  const total = rows.reduce((acc, r) => acc + r.total, 0);
  const simpleTotal = rows.reduce((acc, r) => acc + r.simple, 0);
  const max = Math.max(1, ...rows.map((r) => r.total));
  // Pantallas del menú que nadie abrió en el período.
  const unused = NAV_GROUPS.flatMap((g) => g.items).filter((item) => !byPath.has(item.href));
  const labelOf = new Map(NAV_GROUPS.flatMap((g) => g.items).map((i) => [i.href, i.label]));

  return (
    <main className={pageClass}>
      <header>
        <Link href="/admin" className="text-sm text-neutral-500 dark:text-neutral-400">← Administración</Link>
        <h1 className="text-2xl font-semibold">Uso de la app</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Cuántas veces se abrió cada pantalla. No se guarda quién: solo la pantalla, el día y si estaba el Modo simple.</p>
      </header>
      <nav className="flex gap-2 text-sm">{DAYS.map((d) => <Link key={d} href={`/admin/uso?dias=${d}`} className={`rounded-full px-3 py-1 ${d === days ? 'bg-orange-800 text-white' : 'bg-white dark:bg-neutral-900'}`}>Últimos {d} días</Link>)}</nav>
      {error && <div role="alert" className={errorBox}>{error.message}</div>}

      <section className="grid grid-cols-2 gap-3">
        <div className={cardClass}><p className="text-xs text-neutral-500">Pantallas abiertas</p><p className="mt-1 text-2xl font-semibold">{total.toLocaleString('es-AR')}</p></div>
        <div className={cardClass}><p className="text-xs text-neutral-500">Con Modo simple</p><p className="mt-1 text-2xl font-semibold">{total ? Math.round((simpleTotal / total) * 100) : 0} %</p></div>
      </section>

      <section className={cardClass}>
        <h2 className="font-semibold">Más usadas</h2>
        {!rows.length ? <p className="mt-2 text-sm text-neutral-500">Todavía no hay datos. Se empiezan a juntar desde hoy.</p> : (
          <ul className="mt-3 grid gap-2 text-sm">
            {rows.slice(0, 40).map((r) => (
              <li key={r.path}>
                <div className="flex justify-between gap-3"><span className="truncate">{labelOf.get(r.path) ?? r.path} <span className="text-xs text-neutral-500">{labelOf.has(r.path) ? r.path : ''}</span></span><span className="shrink-0 font-semibold">{r.total.toLocaleString('es-AR')}</span></div>
                <div className="mt-1 h-2 rounded-full bg-neutral-100 dark:bg-neutral-800"><div className="h-2 rounded-full bg-orange-700" style={{ width: `${(r.total / max) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {rows.length > 0 && unused.length > 0 && (
        <section className={cardClass}>
          <h2 className="font-semibold">Nadie las abrió en estos {days} días</h2>
          <p className="mt-1 text-sm text-neutral-500">Candidatas para esconder o simplificar.</p>
          <p className="mt-2 text-sm">{unused.map((i) => i.label).join(' · ')}</p>
        </section>
      )}
    </main>
  );
}
