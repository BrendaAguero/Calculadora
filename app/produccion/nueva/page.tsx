import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAccessSnapshot, hasFeature } from '@/lib/access/permissions';
import { amount, money, qty } from '@/app/stock/constants';
import { cardClass, errorBox, inputClass, labelClass, pageClass, primaryButton, secondaryButton, warnBox } from '@/lib/ui';
import { registerProduction } from '../actions';
import { planProduction } from '../compute';

type Params = { producto?: string; formula?: string; cantidad?: string; error?: string };

export default async function NewProductionPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const snapshot = await getAccessSnapshot();
  if (!snapshot || !hasFeature(snapshot, 'PRODUCCION')) redirect('/produccion');

  const [{ data: products }, { data: formulas }, { data: preferences }] = await Promise.all([
    supabase.from('products').select('id,name,activity_id').eq('user_id', user.id).neq('status', 'archived').order('name'),
    supabase.from('formulas').select('id,name,activity_id').eq('user_id', user.id).eq('status', 'active').order('name'),
    supabase.from('user_preferences').select('auto_deduct_stock').eq('user_id', user.id).maybeSingle(),
  ]);

  const quantity = Number((params.cantidad ?? '').replace(',', '.'));
  const ready = Boolean(params.producto) && Number.isFinite(quantity) && quantity > 0;
  const { plan, error: planError } = ready ? await planProduction(supabase, user.id, params.producto!, params.formula || null, quantity) : { plan: null, error: null };
  const product = (products ?? []).find((p) => p.id === params.producto);
  const activityFormulas = (formulas ?? []).filter((f) => !product || f.activity_id === product.activity_id);
  const shortages = plan?.lines.filter((line) => line.missing > 0) ?? [];
  const autoDeduct = preferences?.auto_deduct_stock ?? false;

  return (
    <main className={pageClass}>
      <header>
        <Link href="/produccion" className="text-sm text-neutral-500 dark:text-neutral-400">← Producción</Link>
        <h1 className="text-2xl font-semibold">Nueva producción</h1>
      </header>

      {params.error && <div role="alert" className={errorBox}>{params.error}</div>}

      {!products?.length ? (
        <div className={warnBox}>Primero creá un producto con su fórmula. <Link href="/gestion/productos/new" className="underline">Crear producto</Link></div>
      ) : (
        <form method="get" className={`${cardClass} grid gap-3 sm:grid-cols-3`}>
          <label className={`${labelClass} sm:col-span-3`}>Producto
            <select name="producto" defaultValue={params.producto ?? ''} required className={inputClass}>
              <option value="" disabled>Elegí un producto</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className={`${labelClass} sm:col-span-2`}>Fórmula
            <select name="formula" defaultValue={params.formula ?? ''} className={inputClass}>
              <option value="">La predeterminada del producto</option>
              {activityFormulas.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </label>
          <label className={labelClass}>Piezas<input name="cantidad" inputMode="decimal" required defaultValue={params.cantidad ?? ''} placeholder="Ej.: 20" className={inputClass} /></label>
          <div className="sm:col-span-3"><button type="submit" className={secondaryButton}>Calcular materiales</button></div>
        </form>
      )}

      {planError && <div role="alert" className={errorBox}>{planError}</div>}

      {plan && (
        <>
          <section className={cardClass}>
            <h2 className="font-semibold">{plan.productName} · {qty(plan.quantity)} piezas</h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              {plan.formulaName ? `Fórmula ${plan.formulaName}${plan.versionNumber ? ` (v${plan.versionNumber})` : ''}, rinde ${qty(plan.yieldQuantity)} ${plan.yieldQuantity === 1 ? 'pieza' : 'piezas'} por tanda.` : 'Este producto no tiene fórmula: se registra sin materiales.'}
            </p>
            {plan.formulaName && !plan.lines.length && <p className="mt-3 text-sm text-amber-800 dark:text-amber-200">Esta fórmula no tiene materiales cargados, así que no hay nada para calcular ni descontar. <Link href={`/formulas/${plan.formulaId}`} className="underline">Ver la fórmula</Link> o elegí otra arriba.</p>}
            {plan.lines.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-neutral-500 dark:text-neutral-400"><tr><th className="py-1 pr-2 font-normal">Material</th><th className="pr-2 font-normal">Hace falta</th><th className="pr-2 font-normal">En stock</th><th className="text-right font-normal">Costo</th></tr></thead>
                  <tbody>
                    {plan.lines.map((line) => (
                      <tr key={line.materialId} className="border-t border-neutral-100 dark:border-neutral-800">
                        <td className="py-2 pr-2">{line.name}{!line.convertible && <span className="block text-xs text-red-600">La unidad de la fórmula no coincide con la del material: no se descuenta.</span>}</td>
                        <td className="pr-2">{amount(line.quantity, line.unit)}</td>
                        <td className={`pr-2 ${line.missing > 0 ? 'font-medium text-red-600 dark:text-red-400' : ''}`}>{line.stock === null ? <span className="text-neutral-400">no lo llevás</span> : amount(line.stock, line.unit)}{line.missing > 0 && <span className="block text-xs">faltan {amount(line.missing, line.unit)}</span>}</td>
                        <td className="text-right">{line.unitCost == null ? <span className="text-neutral-400">sin precio</span> : money(line.totalCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {plan.others.length > 0 && <p className="mt-2 text-xs text-neutral-500">También: {plan.others.map((o) => `${o.label} ${amount(o.quantity, o.unit)}`).join(' · ')} (no se descuentan del stock).</p>}
            <p className="mt-3 text-sm">Costo de materiales: <strong>{money(plan.totalCost)}</strong> · por pieza {money(plan.totalCost / plan.quantity)}{plan.missingPrices ? ` (sin contar ${plan.missingPrices} sin precio)` : ''}</p>
          </section>

          {shortages.length > 0 && (
            <div role="alert" className={warnBox}>
              <p className="font-medium">No alcanza el stock de {shortages.length === 1 ? '1 material' : `${shortages.length} materiales`}:</p>
              <ul className="mt-1 list-inside list-disc">{shortages.map((line) => <li key={line.materialId}>{line.name}: faltan {amount(line.missing, line.unit)}</li>)}</ul>
              <p className="mt-2">Podés registrar igual (el stock queda en negativo hasta que cargues una compra), registrar sin descontar o cancelar.</p>
            </div>
          )}

          <form action={registerProduction} className={`${cardClass} grid gap-3`}>
            <input type="hidden" name="product_id" value={plan.productId} />
            <input type="hidden" name="formula_id" value={params.formula ?? ''} />
            <input type="hidden" name="quantity" value={params.cantidad} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="add_output" defaultChecked /> Sumar {qty(plan.quantity)} {plan.quantity === 1 ? 'pieza' : 'piezas'} al stock de productos terminados</label>
            <label className={labelClass}>Nota (opcional)<input name="notes" maxLength={200} className={inputClass} /></label>
            <div className="flex flex-wrap gap-2">
              <button type="submit" name="deduct" value="1" className={autoDeduct || !shortages.length ? primaryButton : secondaryButton}>{shortages.length ? 'Registrar y descontar igual' : 'Registrar y descontar del stock'}</button>
              <button type="submit" name="deduct" value="0" className={autoDeduct || !shortages.length ? secondaryButton : primaryButton}>Registrar sin descontar</button>
              <Link href="/produccion" className="rounded-xl px-4 py-2 text-sm text-neutral-600 underline dark:text-neutral-400">Cancelar</Link>
            </div>
            <p className="text-xs text-neutral-500">Los materiales que no llevás en el stock se agregan solos al descontar. Podés cambiar cuál opción aparece primero en Preferencias.</p>
          </form>
        </>
      )}
    </main>
  );
}
