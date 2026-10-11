import Link from 'next/link';
import { SubmitButton } from '@/components/submit-button';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAccessSnapshot, hasFeature } from '@/lib/access/permissions';
import { registerMovement, updateMinimum } from '../actions';
import { MOVEMENT_KINDS, MOVEMENT_LABELS, amount, compatibleUnits, money } from '../constants';
import { isLow, loadStock } from '../data';

const pageClass = 'mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 bg-white px-4 py-6 pb-24 text-neutral-900 dark:bg-neutral-950 dark:text-white';
const cardClass = 'rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900';
const inputClass = 'w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white';
const labelClass = 'grid gap-1 text-xs text-neutral-500 dark:text-neutral-400';

export default async function StockItemPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { id } = await params;
  const { ok, error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const snapshot = await getAccessSnapshot();
  if (!snapshot || !hasFeature(snapshot, 'STOCK_BASICO')) redirect('/stock');

  const [{ rows, error: loadError }, { data: movements, error: movementsError }] = await Promise.all([
    loadStock(supabase, user.id, [id]),
    supabase.from('stock_movements').select('id,movement_type,quantity,unit,notes,created_at').eq('stock_item_id', id).eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
  ]);
  const row = rows[0];
  if (!row && !loadError) notFound();
  if (!row) return <main className={pageClass}><Link href="/stock" className="text-sm text-neutral-500">← Stock</Link><div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">No se pudo cargar: {loadError}</div></main>;

  const backHref = row.type === 'finished_product' ? '/stock?tipo=productos' : '/stock';

  return (
    <main className={pageClass}>
      <header>
        <Link href={backHref} className="text-sm text-neutral-500 dark:text-neutral-400">← Stock</Link>
        <h1 className="mt-1 text-2xl font-semibold">{row.name}</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{row.type === 'finished_product' ? 'Producto terminado' : 'Materia prima'}{row.archived ? ' · archivado' : ''}</p>
      </header>

      {ok && !error && <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">{ok}</div>}
      {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{error}</div>}

      <section className="rounded-3xl bg-neutral-950 p-5 text-white dark:bg-white dark:text-neutral-950">
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div><span className="opacity-60">Cantidad</span><strong className={`mt-1 block text-2xl ${row.quantity < 0 ? 'text-red-400 dark:text-red-600' : ''}`}>{amount(row.quantity, row.unit)}</strong></div>
          <div><span className="opacity-60">Mínimo</span><strong className="mt-1 block text-lg">{row.minimum !== null ? `${amount(row.minimum, row.unit)}` : '—'}</strong></div>
          <div><span className="opacity-60">Valor al costo</span><strong className="mt-1 block text-lg">{row.unitValue != null ? money(Math.max(row.quantity, 0) * row.unitValue) : '—'}</strong></div>
        </div>
        {isLow(row) && <p className="mt-3 rounded-xl bg-amber-400 px-3 py-2 text-sm font-medium text-amber-950">Está en el mínimo o por debajo: conviene reponer.</p>}
        <p className="mt-3 text-xs opacity-60">{row.unitValue != null ? `Valor según el ${row.valueSource} (${money(row.unitValue)} por ${row.unit}).` : row.type === 'finished_product' ? 'Sin valor: guardá un cálculo o registrá una producción de este producto para conocer su costo.' : 'Sin valor: el material no tiene precio cargado.'}</p>
      </section>

      <section className={cardClass}>
        <h2 className="font-semibold">Registrar un movimiento</h2>
        <form action={registerMovement} className="mt-3 grid gap-3 sm:grid-cols-3">
          <input type="hidden" name="item_id" value={row.id} />
          <label className={`${labelClass} sm:col-span-3`}>Tipo
            <select name="kind" required className={inputClass}>
              {MOVEMENT_KINDS.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
            </select>
          </label>
          <label className={labelClass}>Cantidad<input name="quantity" inputMode="decimal" required placeholder="0" className={inputClass} /></label>
          <label className={labelClass}>Unidad
            <select name="unit" defaultValue={row.unit} className={inputClass}>
              {compatibleUnits(row.unit).map((unit) => <option key={unit} value={unit}>{unit}</option>)}
            </select>
          </label>
          <label className={labelClass}>Nota (opcional)<input name="notes" maxLength={200} className={inputClass} /></label>
          <div className="sm:col-span-3"><SubmitButton className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">Registrar</SubmitButton></div>
        </form>
        <p className="mt-2 text-xs text-neutral-500">En «Corregir con un conteo» escribí la cantidad que contaste: se registra la diferencia como ajuste. Los movimientos no se borran; si te equivocás, corregí con otro movimiento.</p>
      </section>

      <section className={cardClass}>
        <h2 className="font-semibold">Mínimo para el aviso</h2>
        <form action={updateMinimum} className="mt-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="item_id" value={row.id} />
          <label className={labelClass}>Mínimo en {row.unit === 'unidad' ? 'unidades' : row.unit}<input name="minimum" inputMode="decimal" defaultValue={row.minimum ?? ''} placeholder="Sin mínimo" className={inputClass} /></label>
          <SubmitButton className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-700">Guardar</SubmitButton>
        </form>
        <p className="mt-2 text-xs text-neutral-500">Dejalo vacío para no recibir avisos.</p>
      </section>

      <section className={cardClass}>
        <h2 className="font-semibold">Historial</h2>
        {movementsError
          ? <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">No se pudo cargar el historial: {movementsError.message}</p>
          : !movements?.length
            ? <p className="mt-2 text-sm text-neutral-500">Todavía no hay movimientos.</p>
            : <ul className="mt-3 divide-y divide-neutral-100 text-sm dark:divide-neutral-800">
              {movements.map((movement) => (
                <li key={movement.id} className="flex items-start justify-between gap-3 py-2">
                  <div>
                    <p className="font-medium">{MOVEMENT_LABELS[movement.movement_type] ?? movement.movement_type}</p>
                    <p className="text-xs text-neutral-500">{new Date(movement.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires' })}{movement.notes ? ` · ${movement.notes}` : ''}</p>
                  </div>
                  <span className={`font-medium ${Number(movement.quantity) < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{Number(movement.quantity) > 0 ? '+' : ''}{amount(movement.quantity, movement.unit)}</span>
                </li>
              ))}
            </ul>}
      </section>
    </main>
  );
}
