import Link from 'next/link';
import { HelpTip } from '@/components/help-tip';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAccessSnapshot, hasFeature } from '@/lib/access/permissions';
import { FeatureLocked } from '@/components/feature-locked';
import { money, qty } from '@/app/stock/constants';
import { dateTime, errorBox, pageClass, primaryButton } from '@/lib/ui';

const one = <T,>(value: T | T[] | null) => (Array.isArray(value) ? value[0] : value);

export default async function ProductionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const snapshot = await getAccessSnapshot();
  const allowed = Boolean(snapshot && hasFeature(snapshot, 'PRODUCCION'));

  const { data: productions, error } = allowed
    ? await supabase.from('productions').select('id,quantity,total_cost,stock_deducted,produced_at,products(name),formulas(name)').eq('user_id', user.id).order('produced_at', { ascending: false }).limit(100)
    : { data: [], error: null };

  return (
    <main className={pageClass}>
      <header className="flex items-start justify-between gap-4">
        <div>
          <Link href="/gestion" className="text-sm text-neutral-500 dark:text-neutral-400">← Gestión</Link>
          <h1 className="text-2xl font-semibold">Producción</h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Registrá lo que fabricaste: calcula los materiales, revisa el stock y lo descuenta si querés.</p>
        </div>
        {allowed && <Link href="/produccion/nueva" className={primaryButton}>Nueva</Link>}
      </header>
      <HelpTip guide="produccion"><p>Al registrar lo que fabricaste se descuentan los materiales del stock y se suman las piezas terminadas.</p><p>El costo queda guardado y se usa para la ganancia de tus ventas.</p></HelpTip>

      {!allowed ? (
        <FeatureLocked title="Producción es parte de Emprendedor.">Calcula los materiales de cada tanda, comprueba el stock y suma los productos terminados.</FeatureLocked>
      ) : error ? (
        <div role="alert" className={errorBox}>No se pudieron cargar las producciones: {error.message}</div>
      ) : !productions?.length ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">Todavía no registraste producciones.</div>
      ) : (
        <section className="grid gap-3">
          {productions.map((production) => (
            <Link key={production.id} href={`/produccion/${production.id}`} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-medium">{one(production.products)?.name ?? 'Producto'} · {qty(production.quantity)} piezas</h2>
                  <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{dateTime(production.produced_at)}{one(production.formulas)?.name ? ` · ${one(production.formulas)!.name}` : ''}</p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-medium">{money(production.total_cost)}</p>
                  <p className="text-neutral-500 dark:text-neutral-400">{production.stock_deducted ? 'Descontado del stock' : 'Sin descontar'}</p>
                </div>
              </div>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
