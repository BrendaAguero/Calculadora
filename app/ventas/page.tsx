import Link from 'next/link';
import { HelpTip } from '@/components/help-tip';
import { SubmitButton } from '@/components/submit-button';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAccessSnapshot, hasFeature } from '@/lib/access/permissions';
import { FeatureLocked } from '@/components/feature-locked';
import { PeriodFilter } from '@/components/period-filter';
import { resolvePeriod } from '@/lib/period';
import { money, qty } from '@/app/stock/constants';
import { cardClass, dateOnly, errorBox, okBox, pageClass, primaryButton } from '@/lib/ui';
import { voidSale } from './actions';

const one = <T,>(value: T | T[] | null) => (Array.isArray(value) ? value[0] : value);
const pct = (value: number) => `${value.toLocaleString('es-AR', { maximumFractionDigits: 1 })} %`;

type Params = { periodo?: string; desde?: string; hasta?: string; ok?: string; error?: string; anuladas?: string };

export default async function SalesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const snapshot = await getAccessSnapshot();
  const allowed = Boolean(snapshot && hasFeature(snapshot, 'VENTAS'));
  const period = resolvePeriod(params);

  let query = supabase.from('sales').select('id,quantity,unit_price,total,discount,commission,total_cost_snapshot,net_income,sale_date,customer_name,payment_method,voided_at,products(name)').eq('user_id', user.id).order('sale_date', { ascending: false }).limit(300);
  if (period.from) query = query.gte('sale_date', period.from.toISOString());
  if (period.to) query = query.lt('sale_date', period.to.toISOString());
  if (!params.anuladas) query = query.is('voided_at', null);
  const { data: sales, error } = allowed ? await query : { data: [], error: null };

  const valid = (sales ?? []).filter((s) => !s.voided_at);
  const sum = (key: 'total' | 'net_income' | 'total_cost_snapshot' | 'commission' | 'discount' | 'quantity') => valid.reduce((acc, s) => acc + Number(s[key]), 0);
  const total = sum('total');
  const profit = sum('net_income');

  return (
    <main className={pageClass}>
      <header className="flex items-start justify-between gap-4">
        <div>
          <Link href="/" className="text-sm text-neutral-500 dark:text-neutral-400">← Inicio</Link>
          <h1 className="text-2xl font-semibold">Ventas</h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Ganancia = precio de venta − costo − descuentos − comisiones.</p>
        </div>
        {allowed && <Link href="/ventas/nueva" className={primaryButton}>Nueva</Link>}
      </header>
      <HelpTip guide="ventas"><p>Cada venta descuenta stock y calcula la ganancia con el costo de producción, los descuentos y las comisiones.</p><p>Si te equivocás, anulala: el stock vuelve.</p></HelpTip>

      {!allowed ? (
        <FeatureLocked title="Ventas es parte de la Edición Personal.">Registrá cada venta con su precio, descuento y comisión, y conocé tu ganancia y margen reales.</FeatureLocked>
      ) : (
        <>
          {params.ok && <div role="status" className={okBox}>{params.ok}</div>}
          {(params.error || error) && <div role="alert" className={errorBox}>{params.error ?? `No se pudieron cargar las ventas: ${error!.message}`}</div>}
          <PeriodFilter basePath="/ventas" period={period} desde={params.desde} hasta={params.hasta} />

          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[['Vendido', money(total)], ['Ganancia', money(profit)], ['Margen', pct(total > 0 ? (profit / total) * 100 : 0)], ['Unidades', qty(sum('quantity'))]].map(([label, value]) => (
              <div key={label} className={cardClass}><p className="text-xs text-neutral-500 dark:text-neutral-400">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>
            ))}
          </section>
          <p className="-mt-2 text-xs text-neutral-500">{period.label}: costo {money(sum('total_cost_snapshot'))} · comisiones {money(sum('commission'))} · descuentos {money(sum('discount'))}</p>

          {!sales?.length ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">No hay ventas en este período.</div>
          ) : (
            <section className="grid gap-3">
              {sales.map((sale) => {
                const margin = Number(sale.total) > 0 ? (Number(sale.net_income) / Number(sale.total)) * 100 : 0;
                return (
                  <article key={sale.id} className={`rounded-2xl border p-4 ${sale.voided_at ? 'border-dashed border-neutral-300 opacity-60 dark:border-neutral-700' : 'border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-medium">{one(sale.products)?.name ?? 'Producto'} · {qty(sale.quantity)} × {money(sale.unit_price)}{sale.voided_at && <span className="ml-2 text-xs font-normal">(anulada)</span>}</h2>
                        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{dateOnly(sale.sale_date)}{sale.customer_name ? ` · ${sale.customer_name}` : ''}{sale.payment_method ? ` · ${sale.payment_method}` : ''}</p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="font-semibold">{money(sale.total)}</p>
                        <p className={Number(sale.net_income) < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}>ganancia {money(sale.net_income)} · {pct(margin)}</p>
                      </div>
                    </div>
                    {!sale.voided_at && (
                      <details className="mt-2 text-xs text-neutral-500">
                        <summary className="cursor-pointer">Detalle y anular</summary>
                        <p className="mt-1">Costo {money(sale.total_cost_snapshot)} · descuento {money(sale.discount)} · comisión {money(sale.commission)}</p>
                        <form action={voidSale} className="mt-2">
                          <input type="hidden" name="sale_id" value={sale.id} />
                          <SubmitButton className="rounded-lg border border-red-300 px-3 py-1 text-red-700 dark:border-red-900 dark:text-red-300">Anular esta venta</SubmitButton>
                          <span className="ml-2">No se borra: queda marcada como anulada y, si descontó stock, se devuelve.</span>
                        </form>
                      </details>
                    )}
                  </article>
                );
              })}
            </section>
          )}
          <Link href={params.anuladas ? `/ventas?periodo=${period.value}` : `/ventas?periodo=${period.value}&anuladas=1`} className="text-sm text-neutral-500 underline">{params.anuladas ? 'Ocultar anuladas' : 'Ver también las anuladas'}</Link>
        </>
      )}
    </main>
  );
}
