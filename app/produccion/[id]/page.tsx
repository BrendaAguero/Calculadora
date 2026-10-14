import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAccessSnapshot, hasFeature } from '@/lib/access/permissions';
import { amount, money, qty } from '@/app/stock/constants';
import { cardClass, dateTime, okBox, pageClass } from '@/lib/ui';

const one = <T,>(value: T | T[] | null) => (Array.isArray(value) ? value[0] : value);

export default async function ProductionDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const { id } = await params;
  const { ok } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const snapshot = await getAccessSnapshot();
  if (!snapshot || !hasFeature(snapshot, 'PRODUCCION')) redirect('/produccion');

  const { data: production } = await supabase
    .from('productions')
    .select('id,quantity,total_cost,stock_deducted,produced_at,notes,products(name),formulas(name),formula_versions(version_number),production_items(id,quantity,unit,unit_cost_snapshot,total_cost,materials(name))')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!production) notFound();
  const version = one(production.formula_versions)?.version_number;

  return (
    <main className={pageClass}>
      <header>
        <Link href="/produccion" className="text-sm text-neutral-500 dark:text-neutral-400">← Producción</Link>
        <h1 className="mt-1 text-2xl font-semibold">{one(production.products)?.name ?? 'Producción'} · {qty(production.quantity)} piezas</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{dateTime(production.produced_at)}{one(production.formulas)?.name ? ` · ${one(production.formulas)!.name}${version ? ` (v${version})` : ''}` : ''}</p>
      </header>
      {ok && <div role="status" className={okBox}>Producción registrada.</div>}
      <section className={cardClass}>
        <p className="text-sm">Costo de materiales: <strong>{money(production.total_cost)}</strong> · por pieza {money(Number(production.total_cost) / Number(production.quantity))}</p>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{production.stock_deducted ? 'Los materiales se descontaron del stock.' : 'No se descontó del stock.'}{production.notes ? ` Nota: ${production.notes}` : ''}</p>
        {(production.production_items ?? []).length > 0 && (
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs text-neutral-500"><tr><th className="py-1 font-normal">Material</th><th className="font-normal">Cantidad</th><th className="text-right font-normal">Costo (precio de ese día)</th></tr></thead>
            <tbody>{production.production_items.map((item) => (
              <tr key={item.id} className="border-t border-neutral-100 dark:border-neutral-800"><td className="py-2">{one(item.materials)?.name}</td><td>{amount(item.quantity, item.unit)}</td><td className="text-right">{money(item.total_cost)}</td></tr>
            ))}</tbody>
          </table>
        )}
        <Link href="/stock" className="mt-3 inline-block text-sm underline">Ver stock</Link>
      </section>
    </main>
  );
}
