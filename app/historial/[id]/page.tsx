import Link from 'next/link';
import { mixByCode } from '@/lib/mixes';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { recalculate } from '../actions';
import { inputsFromCalculation, loadCalculation, MODE_LABELS } from '../data';

const pageClass = 'mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 px-4 py-6 pb-10 text-neutral-900 dark:text-white lg:py-10';
const cardClass = 'rounded-3xl bg-white p-5 dark:bg-neutral-900';
const hint = 'text-sm text-neutral-500 dark:text-neutral-400';

function money(value: number | string | null) {
  return Number(value ?? 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 });
}
const qty = (value: number | null, unit: string | null) => (value == null ? '' : `${Number(value).toLocaleString('es-AR', { maximumFractionDigits: 1 })} ${unit ?? ''}`);

export default async function CalculationDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; recalculado?: string }> }) {
  const { id } = await params;
  const { error, recalculado } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { calculation, items, error: loadError } = await loadCalculation(supabase, user.id, id);
  if (!calculation && !loadError) notFound();
  if (!calculation) return <main className={pageClass}><Link href="/historial" className={hint}>← Historial</Link><div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">No se pudo cargar el cálculo: {loadError}</div></main>;

  const plaster = items.find(item => item.metadata?.kind === 'plaster');
  // Cálculos de Resina, Jesmonite o Cemento: guardan la receta en la primera línea.
  const mix = items.find(item => item.metadata?.kind === 'mix');
  const mixDef = mix ? mixByCode(String(mix.metadata?.activity ?? '')) : null;
  const mixAmounts = (mix?.metadata?.amounts ?? []) as { label: string; grams: number; ml: number }[];
  const { reconstructed } = inputsFromCalculation(calculation, items);
  const originalId = plaster?.metadata?.recalculated_from as string | undefined;
  const { data: original } = originalId
    ? await supabase.from('calculations').select('id,created_at,unit_cost,suggested_price').eq('id', originalId).eq('user_id', user.id).maybeSingle()
    : { data: null };
  // Las políticas de seguridad ya limitan a los cálculos propios.
  const { data: recalculations } = await supabase.from('calculation_items').select('calculation_id').eq('metadata->>recalculated_from', id);

  const meta = plaster?.metadata ?? {};
  const unitCost = Number(calculation.unit_cost);

  return (
    <main className={pageClass}>
      <header>
        <Link href="/historial" className={hint}>← Historial</Link>
        <h1 className="mt-2 text-2xl font-semibold">{calculation.productName ?? calculation.formulaName ?? (mixDef ? `Cálculo de ${mixDef.name}` : 'Cálculo')}</h1>
        <p className={hint}>{new Date(calculation.created_at).toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' })} · {MODE_LABELS[calculation.calculation_mode] ?? calculation.calculation_mode} · {Number(calculation.quantity)} piezas</p>
      </header>

      {recalculado && !error && <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">Cálculo nuevo creado con los precios de hoy. El original quedó igual.</div>}
      {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{error}</div>}

      {original && (
        <section className="rounded-2xl border border-sky-300 bg-sky-50 p-4 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
          Recalculado a partir del <Link href={`/historial/${original.id}`} className="underline">cálculo del {new Date(original.created_at).toLocaleDateString('es-AR')}</Link>.
          {' '}Costo por pieza: {money(original.unit_cost)} → <strong>{money(unitCost)}</strong>
          {Number(original.unit_cost) > 0 && ` (${unitCost >= Number(original.unit_cost) ? '+' : ''}${((unitCost / Number(original.unit_cost) - 1) * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })} %)`}.
        </section>
      )}

      <section className="rounded-3xl bg-neutral-950 p-5 text-white dark:bg-white dark:text-neutral-950">
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div><span className="opacity-60">Costo total</span><strong className="mt-1 block text-lg">{money(calculation.total_cost)}</strong></div>
          <div><span className="opacity-60">Costo por pieza</span><strong className="mt-1 block text-lg">{money(calculation.unit_cost)}</strong></div>
          <div><span className="opacity-60">Precio</span><strong className="mt-1 block text-lg">{money(calculation.suggested_price)}</strong></div>
          <div><span className="opacity-60">Ganancia por pieza</span><strong className="mt-1 block text-lg">{money(calculation.profit_per_unit)}</strong></div>
          <div><span className="opacity-60">Margen</span><strong className="mt-1 block text-lg">{Number(calculation.margin_percentage ?? 0).toLocaleString('es-AR', { maximumFractionDigits: 1 })} %</strong></div>
        </div>
      </section>

      <section className={cardClass}>
        <h2 className="font-semibold">Detalle (precios congelados de ese día)</h2>
        {items.length === 0
          ? <p className={`mt-2 ${hint}`}>Este cálculo se guardó sin detalle (antes de que se corrigiera el error CALC-004).</p>
          : <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm">
            <thead className="text-xs text-neutral-500 dark:text-neutral-400"><tr><th className="py-1 pr-2 font-normal">Concepto</th><th className="pr-2 font-normal">Cantidad</th><th className="pr-2 font-normal">Precio unitario</th><th className="text-right font-normal">Total</th></tr></thead>
            <tbody>{items.map(item => (
              <tr key={item.id} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className="py-2 pr-2">{item.name_snapshot}</td>
                <td className="pr-2">{qty(item.quantity, item.unit)}</td>
                <td className="pr-2">{item.unit === 'g' && item.unit_cost_snapshot != null ? `${money(Number(item.unit_cost_snapshot) * 1000)} / kg` : money(item.unit_cost_snapshot)}</td>
                <td className="text-right">{money(item.total_cost)}</td>
              </tr>
            ))}</tbody>
          </table></div>}
        {mix && <p className={`mt-3 ${hint}`}>Mezcla preparada: {qty(Number(mix.metadata?.total_mix_g ?? 0), 'g')} ({qty(Number(mix.metadata?.per_piece_g ?? 0), 'g')} por pieza, con la merma){mixAmounts.length > 0 ? ` · ${mixAmounts.map(a => `${a.label}: ${qty(a.grams, 'g')}`).join(' · ')}` : ''}{Number(mix.metadata?.pigment_g ?? 0) > 0 ? ` · Pigmento: ${qty(Number(mix.metadata?.pigment_g), 'g')}` : ''}</p>}
        {plaster && <p className={`mt-3 ${hint}`}>Yeso por pieza: {qty(Number(meta.plaster_per_piece_g ?? 0), 'g')}{meta.water_percentage != null ? ` · agua ${meta.water_percentage} % (${qty(Number(meta.water_total_g ?? 0), 'g')} en total)` : ''}</p>}
        <p className={`mt-1 ${hint}`}>{[calculation.moldName && `Molde: ${calculation.moldName}`, calculation.formulaName && `Fórmula: ${calculation.formulaName}${calculation.formulaVersion ? ` (v${calculation.formulaVersion})` : ''}`].filter(Boolean).join(' · ')}</p>
      </section>

      {mixDef ? (
        <section className={cardClass}>
          <h2 className="font-semibold">¿Qué querés hacer?</h2>
          <Link href={`/calcular/${mixDef.slug}`} className="mt-3 inline-block rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-700">Hacer otro cálculo de {mixDef.name}</Link>
        </section>
      ) : (
      <section className={cardClass}>
        <h2 className="font-semibold">¿Qué querés hacer?</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`/calcular?desde=${id}`} className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-700">Duplicar y editar</Link>
          <form action={recalculate}><input type="hidden" name="calculation_id" value={id} /><button type="submit" className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">Recalcular con precios de hoy</button></form>
        </div>
        <p className={`mt-3 ${hint}`}>Las dos opciones crean un cálculo nuevo; este no se modifica. Recalcular actualiza el precio del yeso (si salió de tus materiales) y el costo del molde guardado; los demás costos se mantienen.</p>
        {reconstructed && items.length > 0 && <p className={`mt-1 ${hint}`}>Este cálculo es anterior a que se guardaran todos los datos: el precio se toma como % de ganancia sobre el costo.</p>}
        {(recalculations ?? []).length > 0 && <p className={`mt-2 ${hint}`}>Recalculado {recalculations!.length} {recalculations!.length === 1 ? 'vez' : 'veces'}: {recalculations!.map((r, i) => <Link key={r.calculation_id} href={`/historial/${r.calculation_id}`} className="underline">{i ? ', ' : ''}ver</Link>)}.</p>}
      </section>
      )}
    </main>
  );
}
