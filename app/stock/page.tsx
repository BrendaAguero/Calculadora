import Link from 'next/link';
import { HelpTip } from '@/components/help-tip';
import { SubmitButton } from '@/components/submit-button';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAccessSnapshot, hasFeature } from '@/lib/access/permissions';
import { addStockItem } from './actions';
import { amount, money } from './constants';
import { isLow, loadStock } from './data';

const pageClass = 'mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 px-4 py-6 pb-10 text-neutral-900 dark:text-white lg:py-10';
const inputClass = 'w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white';
const labelClass = 'grid gap-1 text-xs text-neutral-500 dark:text-neutral-400';

export default async function StockPage({ searchParams }: { searchParams: Promise<{ tipo?: string; error?: string }> }) {
  const { tipo, error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const snapshot = await getAccessSnapshot();
  if (!snapshot || !hasFeature(snapshot, 'STOCK_BASICO')) {
    return (
      <main className={pageClass}>
        <Link href="/gestion" className="text-sm text-neutral-500 dark:text-neutral-400">← Gestión</Link>
        <h1 className="text-2xl font-semibold">Stock</h1>
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-medium">Stock es parte de la Edición Personal.</p>
          <p className="mt-1">Te permite llevar la cantidad de materias primas y productos terminados, con mínimos, alertas y valor.</p>
          <Link href="/access" className="mt-3 inline-block underline">Ver mi acceso</Link>
        </div>
      </main>
    );
  }

  const products = tipo === 'productos';
  const [{ rows, error: loadError }, { data: materials }, { data: productList }] = await Promise.all([
    loadStock(supabase, user.id),
    supabase.from('materials').select('id,name,default_unit').eq('user_id', user.id).eq('status', 'active').order('name'),
    supabase.from('products').select('id,name').eq('user_id', user.id).neq('status', 'archived').order('name'),
  ]);
  const visible = rows.filter((row) => (products ? row.type === 'finished_product' : row.type === 'material'));
  const tracked = new Set(rows.map((row) => row.targetId));
  const options = (products ? productList ?? [] : materials ?? []).filter((option) => !tracked.has(option.id));
  const low = rows.filter(isLow);
  const totalValue = visible.reduce((sum, row) => sum + (row.unitValue == null ? 0 : Math.max(row.quantity, 0) * row.unitValue), 0);
  const withoutValue = visible.filter((row) => row.unitValue == null).length;

  return (
    <main className={pageClass}>
      <header>
        <Link href="/gestion" className="text-sm text-neutral-500 dark:text-neutral-400">← Gestión</Link>
        <h1 className="text-2xl font-semibold">Stock</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Cantidades, mínimos y valor de tus materias primas y productos terminados. Cada cambio queda en el historial.</p>
      </header>
      <HelpTip guide="stock"><p>El stock se mueve solo al registrar producción, compras y ventas. Para corregirlo, abrí el ítem y hacé un ajuste.</p><p>Si ponés un mínimo, te avisamos cuando quede poco.</p></HelpTip>

      {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{error}</div>}
      {loadError && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">No se pudo cargar el stock: {loadError}</div>}

      {low.length > 0 && (
        <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <strong>{low.length === 1 ? '1 ítem está' : `${low.length} ítems están`} en el mínimo o por debajo:</strong>{' '}
          {low.map((row, i) => <span key={row.id}>{i ? ', ' : ''}<Link href={`/stock/${row.id}`} className="underline">{row.name}</Link></span>)}
        </div>
      )}

      <nav className="flex gap-2 text-sm">
        <Link href="/stock" className={`rounded-xl px-4 py-2 font-medium ${!products ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'border border-neutral-300 dark:border-neutral-700'}`}>Materias primas</Link>
        <Link href="/stock?tipo=productos" className={`rounded-xl px-4 py-2 font-medium ${products ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'border border-neutral-300 dark:border-neutral-700'}`}>Productos terminados</Link>
      </nav>

      {!loadError && (
        <section className="grid gap-3">
          {!visible.length
            ? <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">{products ? 'Todavía no agregaste productos terminados al stock.' : 'Todavía no agregaste materias primas al stock.'}</div>
            : visible.map((row) => (
              <Link key={row.id} href={`/stock/${row.id}`} className={`rounded-2xl border bg-white p-4 shadow-sm transition hover:border-neutral-400 dark:bg-neutral-900 ${isLow(row) ? 'border-amber-400 dark:border-amber-700' : 'border-neutral-200 dark:border-neutral-800'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-medium">{row.name}{row.archived && <span className="ml-2 text-xs text-neutral-500">(archivado)</span>}</h2>
                    <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{row.minimum !== null ? `Mínimo ${amount(row.minimum, row.unit)}` : 'Sin mínimo'}{row.unitValue != null ? ` · Valor ${money(Math.max(row.quantity, 0) * row.unitValue)}` : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-semibold ${row.quantity < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>{amount(row.quantity, row.unit)}</p>
                    {isLow(row) && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">Bajo mínimo</span>}
                  </div>
                </div>
              </Link>
            ))}
          {visible.length > 0 && <p className="text-sm text-neutral-600 dark:text-neutral-400">Valor total al costo: <strong>{money(totalValue)}</strong>{withoutValue ? ` (sin contar ${withoutValue} sin ${products ? 'costo conocido' : 'precio'})` : ''}</p>}
        </section>
      )}

      <section className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="font-semibold">Agregar {products ? 'un producto terminado' : 'una materia prima'}</h2>
        {!options.length
          ? <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">{products ? <>No hay productos sin agregar. <Link href="/gestion/productos/new" className="underline">Crear un producto</Link></> : <>No hay materiales sin agregar. <Link href="/materials/new" className="underline">Crear un material</Link></>}</p>
          : (
            <form action={addStockItem} className="mt-3 grid gap-3 sm:grid-cols-3">
              <input type="hidden" name="kind" value={products ? 'product' : 'material'} />
              <label className={`${labelClass} sm:col-span-3`}>{products ? 'Producto' : 'Material'}
                <select name="target_id" required className={inputClass}>
                  {options.map((option) => <option key={option.id} value={option.id}>{option.name}{'default_unit' in option ? ` (${option.default_unit})` : ''}</option>)}
                </select>
              </label>
              <label className={labelClass}>Cantidad que tenés hoy<input name="initial" inputMode="decimal" placeholder="0" className={inputClass} /></label>
              <label className={labelClass}>Mínimo (opcional)<input name="minimum" inputMode="decimal" placeholder="Avisar al llegar a…" className={inputClass} /></label>
              <div className="flex items-end"><SubmitButton className="w-full rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">Agregar</SubmitButton></div>
              <p className="text-xs text-neutral-500 sm:col-span-3">{products ? 'Los productos se cuentan en unidades.' : 'La cantidad va en la unidad del material (la que figura entre paréntesis).'}</p>
            </form>
          )}
      </section>
    </main>
  );
}
