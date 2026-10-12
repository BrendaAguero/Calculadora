import Link from 'next/link';
import { getSimpleMode } from '@/lib/simple-mode-server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MODE_LABELS } from './data';

const pageClass = 'mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 px-4 py-6 pb-10 text-neutral-900 dark:text-white lg:py-10';
const inputClass = 'w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white';

function money(value: number | string | null) {
  return Number(value ?? 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 });
}
const one = <T,>(value: T | T[] | null) => (Array.isArray(value) ? value[0] : value);

type Filters = { producto?: string; modo?: string; desde?: string; hasta?: string };

export default async function HistoryPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const simple = await getSimpleMode();
  const filters = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  let query = supabase
    .from('calculations')
    .select('id,created_at,calculation_mode,quantity,unit_cost,suggested_price,margin_percentage,products(name),formulas(name),calculation_items(id)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200);
  if (filters.producto === 'ninguno') query = query.is('product_id', null);
  else if (filters.producto) query = query.eq('product_id', filters.producto);
  if (filters.modo && MODE_LABELS[filters.modo]) query = query.eq('calculation_mode', filters.modo);
  // Las fechas se toman en hora de Argentina.
  if (filters.desde) query = query.gte('created_at', new Date(`${filters.desde}T00:00:00-03:00`).toISOString());
  if (filters.hasta) query = query.lte('created_at', new Date(`${filters.hasta}T23:59:59-03:00`).toISOString());

  const [{ data: calculations, error }, { data: products }] = await Promise.all([
    query,
    supabase.from('products').select('id,name').eq('user_id', user.id).order('name'),
  ]);
  const filtered = Boolean(filters.producto || filters.modo || filters.desde || filters.hasta);

  return (
    <main className={pageClass}>
      <header className="flex items-center justify-between gap-4">
        <div>
          <Link href="/" className="text-sm text-neutral-500 dark:text-neutral-400">← Inicio</Link>
          <h1 className={simple ? "text-3xl" : "text-2xl font-semibold"}>{simple ? "Mis cálculos guardados" : "Historial de cálculos"}</h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Cada cálculo conserva los precios del día en que se hizo.</p>
        </div>
        <Link href="/calcular" className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">Calcular</Link>
      </header>

      <form method="get" className="grid gap-3 rounded-2xl border border-neutral-200 p-4 sm:grid-cols-4 dark:border-neutral-800">
        <label className="grid gap-1 text-xs text-neutral-500 dark:text-neutral-400">Producto
          <select name="producto" defaultValue={filters.producto ?? ''} className={inputClass}>
            <option value="">Todos</option>
            <option value="ninguno">Sin producto</option>
            {(products ?? []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-neutral-500 dark:text-neutral-400">Modo
          <select name="modo" defaultValue={filters.modo ?? ''} className={inputClass}>
            <option value="">Todos</option>
            {Object.entries(MODE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-neutral-500 dark:text-neutral-400">Desde<input type="date" name="desde" defaultValue={filters.desde ?? ''} className={inputClass} /></label>
        <label className="grid gap-1 text-xs text-neutral-500 dark:text-neutral-400">Hasta<input type="date" name="hasta" defaultValue={filters.hasta ?? ''} className={inputClass} /></label>
        <div className="flex gap-2 sm:col-span-4">
          <button type="submit" className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">Filtrar</button>
          {filtered && <Link href="/historial" className="rounded-xl border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700">Quitar filtros</Link>}
        </div>
      </form>

      {error
        ? <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">No se pudo cargar el historial: {error.message}</div>
        : !calculations.length
          ? <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">{filtered ? 'No hay cálculos con esos filtros.' : 'Todavía no guardaste cálculos. Hacé uno en Calcular y tocá «Guardar cálculo».'}</div>
          : <section className="grid gap-3">
            {calculations.map(c => {
              const product = one(c.products)?.name;
              const formula = one(c.formulas)?.name;
              const incomplete = !(c.calculation_items ?? []).length;
              return (
                <Link key={c.id} href={`/historial/${c.id}`} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-medium">{product ?? formula ?? 'Cálculo sin producto'}</h2>
                      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{new Date(c.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })} · {MODE_LABELS[c.calculation_mode] ?? c.calculation_mode} · {Number(c.quantity)} piezas{incomplete ? ' · sin detalle' : ''}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-medium">{money(c.suggested_price)}</p>
                      <p className="text-neutral-500 dark:text-neutral-400">costo {money(c.unit_cost)} · {Number(c.margin_percentage ?? 0).toLocaleString('es-AR', { maximumFractionDigits: 1 })} %</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </section>}
    </main>
  );
}
