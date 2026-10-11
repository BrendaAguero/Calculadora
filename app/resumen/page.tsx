import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAccessSnapshot, hasFeature } from '@/lib/access/permissions';
import { FeatureLocked } from '@/components/feature-locked';
import { PeriodFilter } from '@/components/period-filter';
import { arDay, resolvePeriod } from '@/lib/period';
import { money, qty } from '@/app/stock/constants';
import { isLow, loadStock } from '@/app/stock/data';
import { cardClass, errorBox, pageClass } from '@/lib/ui';

const one = <T,>(value: T | T[] | null) => (Array.isArray(value) ? value[0] : value);
const pct = (value: number) => `${value.toLocaleString('es-AR', { maximumFractionDigits: 1 })} %`;
const dayLabel = (day: string) => new Date(`${day}T12:00:00-03:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', timeZone: 'America/Argentina/Buenos_Aires' });

type Params = { periodo?: string; desde?: string; hasta?: string };

export default async function SummaryPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const snapshot = await getAccessSnapshot();
  const allowed = Boolean(snapshot && hasFeature(snapshot, 'ESTADISTICAS'));
  const period = resolvePeriod(params);

  if (!allowed) {
    return (
      <main className={pageClass}>
        <Link href="/gestion" className="text-sm text-neutral-500 dark:text-neutral-400">← Gestión</Link>
        <h1 className="text-2xl font-semibold">Resumen del negocio</h1>
        <FeatureLocked title="El resumen es parte de Emprendedor.">Ventas, costos, ganancias, producción y stock de un vistazo, por período.</FeatureLocked>
      </main>
    );
  }

  const range = <T extends { gte: (c: string, v: string) => T; lt: (c: string, v: string) => T }>(q: T, column: string) => {
    let r = q;
    if (period.from) r = r.gte(column, period.from.toISOString());
    if (period.to) r = r.lt(column, period.to.toISOString());
    return r;
  };

  const [salesRes, productionsRes, purchasesRes, stockRes] = await Promise.all([
    range(supabase.from('sales').select('product_id,quantity,total,net_income,total_cost_snapshot,commission,discount,sale_date,products(name)').eq('user_id', user.id).is('voided_at', null), 'sale_date').limit(5000),
    range(supabase.from('productions').select('quantity,total_cost,produced_at').eq('user_id', user.id), 'produced_at').limit(5000),
    range(supabase.from('supplier_purchases').select('total,purchase_date').eq('user_id', user.id), 'purchase_date').limit(5000),
    loadStock(supabase, user.id),
  ]);
  const loadError = salesRes.error?.message ?? productionsRes.error?.message ?? purchasesRes.error?.message ?? stockRes.error;

  const sales = salesRes.data ?? [];
  const sum = <K extends string>(rows: Record<K, unknown>[], key: K) => rows.reduce((acc, r) => acc + Number(r[key] ?? 0), 0);
  const sold = sum(sales, 'total');
  const profit = sum(sales, 'net_income');
  const cost = sum(sales, 'total_cost_snapshot');
  const fees = sum(sales, 'commission') + sum(sales, 'discount');
  const produced = sum(productionsRes.data ?? [], 'quantity');
  const productionCost = sum(productionsRes.data ?? [], 'total_cost');
  const purchased = sum(purchasesRes.data ?? [], 'total');
  const stockValue = stockRes.rows.reduce((acc, r) => acc + (r.unitValue == null ? 0 : Math.max(r.quantity, 0) * r.unitValue), 0);
  const low = stockRes.rows.filter(isLow);

  // Ventas por producto (las que más ganancia dejan primero).
  const byProduct = new Map<string, { name: string; units: number; sold: number; profit: number }>();
  for (const s of sales) {
    const row = byProduct.get(s.product_id) ?? { name: one(s.products)?.name ?? 'Producto', units: 0, sold: 0, profit: 0 };
    row.units += Number(s.quantity); row.sold += Number(s.total); row.profit += Number(s.net_income);
    byProduct.set(s.product_id, row);
  }
  const products = [...byProduct.values()].sort((a, b) => b.profit - a.profit);

  // Ventas por día (una sola serie).
  const byDay = new Map<string, number>();
  for (const s of sales) byDay.set(arDay(s.sale_date), (byDay.get(arDay(s.sale_date)) ?? 0) + Number(s.total));
  const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const maxDay = Math.max(1, ...days.map(([, v]) => v));

  const tiles: [string, string, string?][] = [
    ['Vendido', money(sold), `${qty(sum(sales, 'quantity'))} unidades`],
    ['Ganancia', money(profit), `margen ${pct(sold > 0 ? (profit / sold) * 100 : 0)}`],
    ['Costo de lo vendido', money(cost), `comisiones y descuentos ${money(fees)}`],
    ['Producción', `${qty(produced)} piezas`, `costo ${money(productionCost)}`],
    ['Compras de materiales', money(purchased)],
    ['Stock al costo', money(stockValue), low.length ? `${low.length} bajo mínimo` : 'nada bajo mínimo'],
  ];

  return (
    <main className={pageClass}>
      <header>
        <Link href="/gestion" className="text-sm text-neutral-500 dark:text-neutral-400">← Gestión</Link>
        <h1 className="text-2xl font-semibold">Resumen del negocio</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{period.label}. Las ventas anuladas no cuentan.</p>
      </header>
      <PeriodFilter basePath="/resumen" period={period} desde={params.desde} hasta={params.hasta} />
      {loadError && <div role="alert" className={errorBox}>No se pudo cargar todo el resumen: {loadError}</div>}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map(([label, value, note]) => (
          <div key={label} className={cardClass}>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
            <p className={`mt-1 text-xl font-semibold ${label === 'Ganancia' && profit < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>{value}</p>
            {note && <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{note}</p>}
          </div>
        ))}
      </section>

      <section className={cardClass}>
        <h2 className="font-semibold">Ventas por día</h2>
        {!days.length ? <p className="mt-2 text-sm text-neutral-500">No hay ventas en este período.</p> : (
          <>
            <div className="mt-4 flex h-40 items-end gap-0.5 border-b border-neutral-200 dark:border-neutral-800" role="img" aria-label={`Ventas por día: ${days.map(([d, v]) => `${dayLabel(d)} ${money(v)}`).join(', ')}`}>
              {days.map(([day, value]) => (
                <div key={day} className="group relative flex h-full flex-1 items-end justify-center">
                  <div className="w-full max-w-8 rounded-t bg-orange-600 transition group-hover:bg-orange-800 dark:bg-orange-400 dark:group-hover:bg-orange-200" style={{ height: `${Math.max(2, (value / maxDay) * 100)}%` }} />
                  <span className="pointer-events-none absolute bottom-full mb-1 hidden whitespace-nowrap rounded-md bg-neutral-900 px-2 py-1 text-xs text-white group-hover:block dark:bg-white dark:text-neutral-900">{dayLabel(day)}: {money(value)}</span>
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-xs text-neutral-500"><span>{dayLabel(days[0][0])}</span><span>máx. {money(maxDay)}</span><span>{days.length > 1 ? dayLabel(days[days.length - 1][0]) : ''}</span></div>
          </>
        )}
      </section>

      <section className={cardClass}>
        <h2 className="font-semibold">Productos</h2>
        {!products.length ? <p className="mt-2 text-sm text-neutral-500">Sin ventas en este período.</p> : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-neutral-500"><tr><th className="py-1 pr-2 font-normal">Producto</th><th className="pr-2 text-right font-normal">Unidades</th><th className="pr-2 text-right font-normal">Vendido</th><th className="pr-2 text-right font-normal">Ganancia</th><th className="text-right font-normal">Margen</th></tr></thead>
              <tbody>{products.map((p) => (
                <tr key={p.name} className="border-t border-neutral-100 dark:border-neutral-800">
                  <td className="py-2 pr-2">{p.name}</td><td className="pr-2 text-right">{qty(p.units)}</td><td className="pr-2 text-right">{money(p.sold)}</td>
                  <td className={`pr-2 text-right ${p.profit < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>{money(p.profit)}</td><td className="text-right">{pct(p.sold > 0 ? (p.profit / p.sold) * 100 : 0)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      {low.length > 0 && (
        <section className={cardClass}>
          <h2 className="font-semibold">Para reponer</h2>
          <ul className="mt-2 grid gap-1 text-sm">{low.map((r) => <li key={r.id}><Link href={`/stock/${r.id}`} className="underline">{r.name}</Link>: {qty(r.quantity)} {r.unit} (mínimo {qty(r.minimum)})</li>)}</ul>
        </section>
      )}

      <nav className="flex flex-wrap gap-3 text-sm">
        <Link href="/ventas" className="underline">Ventas</Link><Link href="/produccion" className="underline">Producción</Link><Link href="/compras" className="underline">Compras</Link><Link href="/stock" className="underline">Stock</Link>
      </nav>
    </main>
  );
}
