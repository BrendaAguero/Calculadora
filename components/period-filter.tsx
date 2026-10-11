import Link from 'next/link';
import { PERIODS, type Period } from '@/lib/period';

// Filtro de período en una fila: atajos + rango personalizado.
export function PeriodFilter({ basePath, period, desde, hasta }: { basePath: string; period: Period; desde?: string; hasta?: string }) {
  const chip = (active: boolean) => `rounded-full px-3 py-1.5 text-sm ${active ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'border border-neutral-300 dark:border-neutral-700'}`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PERIODS.map((p) => <Link key={p.value} href={`${basePath}?periodo=${p.value}`} className={chip(period.value === p.value)}>{p.label}</Link>)}
      <form method="get" action={basePath} className="flex flex-wrap items-center gap-1 text-sm">
        <input type="date" name="desde" defaultValue={desde ?? ''} aria-label="Desde" className="rounded-lg border border-neutral-300 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-950" />
        <span>a</span>
        <input type="date" name="hasta" defaultValue={hasta ?? ''} aria-label="Hasta" className="rounded-lg border border-neutral-300 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-950" />
        <button type="submit" className={chip(period.value === 'personalizado')}>Ver</button>
      </form>
    </div>
  );
}
