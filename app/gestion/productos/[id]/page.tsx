import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { addPrice, changeLink, endPrice, updateProduct } from '../actions';
import { PRICE_TYPES, PRODUCT_STATUSES, priceTypeLabel, statusLabel } from '../constants';

const pageClass = 'mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 px-4 py-6 pb-10 text-neutral-900 dark:text-white lg:py-10';
const cardClass = 'rounded-3xl bg-white p-5 dark:bg-neutral-900';
const inputClass = 'w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white';
const primaryButton = 'rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900';
const smallButton = 'rounded-lg border border-neutral-300 px-2.5 py-1 text-xs dark:border-neutral-700';
const hint = 'text-sm text-neutral-500 dark:text-neutral-400';

type Price = { id: string; price_type: string; quantity_min: number | null; quantity_max: number | null; price: number; valid_from: string; valid_until: string | null };

function money(value: number | string) {
  return Number(value).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 });
}
const day = (iso: string) => new Date(iso).toLocaleDateString('es-AR');
const range = (p: Price) => `${Number(p.quantity_min ?? 1)}${p.quantity_max != null ? `–${Number(p.quantity_max)}` : '+'} u.`;

function LinkSection({ productId, kind, title, linked, available }: { productId: string; kind: 'formula' | 'mold'; title: string; linked: { id: string; name: string; isDefault: boolean }[]; available: { id: string; name: string }[] }) {
  const hidden = (op: string, targetId?: string) => <><input type="hidden" name="product_id" value={productId} /><input type="hidden" name="kind" value={kind} /><input type="hidden" name="op" value={op} />{targetId && <input type="hidden" name="target_id" value={targetId} />}</>;
  return (
    <section className={cardClass}>
      <h2 className="font-semibold">{title}</h2>
      {linked.length === 0 && <p className={`mt-2 ${hint}`}>Ninguno vinculado.</p>}
      <ul className="mt-3 grid gap-2">
        {linked.map(item => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800">
            <span>{item.name}{item.isDefault && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">Predeterminado</span>}</span>
            <span className="flex gap-2">
              {!item.isDefault && <form action={changeLink}>{hidden('default', item.id)}<button type="submit" className={smallButton}>Hacer predeterminado</button></form>}
              <form action={changeLink}>{hidden('remove', item.id)}<button type="submit" className={`${smallButton} text-red-700 dark:text-red-300`}>Quitar</button></form>
            </span>
          </li>
        ))}
      </ul>
      {available.length > 0 && (
        <form action={changeLink} className="mt-3 flex gap-2">
          {hidden('add')}
          <select name="target_id" defaultValue="" aria-label={`Agregar ${kind === 'formula' ? 'fórmula' : 'molde'}`} className={inputClass}><option value="" disabled>Elegí para agregar…</option>{available.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
          <button type="submit" className={primaryButton}>Agregar</button>
        </form>
      )}
    </section>
  );
}

export default async function ProductDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { id } = await params;
  const { error, ok } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <main className={pageClass}>Iniciá sesión para continuar.</main>;

  const { data: product, error: loadError } = await supabase.from('products').select('id,name,photo_url,notes,status,activity_id,activities(name)').eq('id', id).eq('user_id', user.id).maybeSingle();
  if (loadError) return <main className={pageClass}><Link href="/gestion/productos" className={hint}>← Productos</Link><div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">No se pudo cargar el producto: {loadError.message}</div></main>;
  if (!product) notFound();

  const [linkedFormulas, linkedMolds, formulas, molds, pricesResult, lastCalculation] = await Promise.all([
    supabase.from('product_formulas').select('formula_id,is_default,formulas(name)').eq('product_id', id),
    supabase.from('product_molds').select('mold_id,is_default,molds(name)').eq('product_id', id),
    supabase.from('formulas').select('id,name').eq('user_id', user.id).eq('activity_id', product.activity_id).eq('status', 'active').order('name'),
    supabase.from('molds').select('id,name').eq('user_id', user.id).eq('activity_id', product.activity_id).eq('status', 'active').order('name'),
    supabase.from('product_prices').select('id,price_type,quantity_min,quantity_max,price,valid_from,valid_until').eq('product_id', id).order('valid_from', { ascending: false }),
    // Rentabilidad con el costo real del último cálculo guardado para este producto (no un costo inventado).
    supabase.from('calculations').select('unit_cost,created_at,quantity').eq('product_id', id).eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const problem = [linkedFormulas.error, linkedMolds.error, formulas.error, molds.error, pricesResult.error, lastCalculation.error].find(Boolean)?.message;

  const one = <T,>(value: T | T[] | null) => (Array.isArray(value) ? value[0] : value);
  const formulaLinks = (linkedFormulas.data ?? []).map(l => ({ id: l.formula_id, name: one(l.formulas)?.name ?? 'Fórmula', isDefault: l.is_default })).sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  const moldLinks = (linkedMolds.data ?? []).map(l => ({ id: l.mold_id, name: one(l.molds)?.name ?? 'Molde', isDefault: l.is_default })).sort((a, b) => Number(b.isDefault) - Number(a.isDefault));

  const now = new Date();
  const prices = (pricesResult.data ?? []) as Price[];
  const isCurrent = (p: Price) => new Date(p.valid_from) <= now && (!p.valid_until || new Date(p.valid_until) > now);
  const current = prices.filter(isCurrent).sort((a, b) => a.price_type.localeCompare(b.price_type) || Number(a.quantity_min ?? 1) - Number(b.quantity_min ?? 1));
  const others = prices.filter(p => !isCurrent(p));
  const unitCost = lastCalculation.data ? Number(lastCalculation.data.unit_cost) : null;
  const activity = one(product.activities);

  return (
    <main className={pageClass}>
      <header>
        <Link href="/gestion/productos" className={hint}>← Productos</Link>
        <h1 className="mt-2 text-2xl font-semibold">{product.name}</h1>
        <p className={hint}>{[activity?.name, statusLabel(product.status)].filter(Boolean).join(' · ')}</p>
      </header>

      {ok && !error && <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">{ok}</div>}
      {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{error}</div>}
      {problem && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">No se pudo cargar todo: {problem}</div>}

      <section className={cardClass}>
        <h2 className="font-semibold">Precios vigentes</h2>
        {current.length === 0
          ? <p className={`mt-2 ${hint}`}>Sin precios vigentes.</p>
          : <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm">
            <thead className="text-xs text-neutral-500 dark:text-neutral-400"><tr><th className="py-1 pr-2 font-normal">Tipo</th><th className="pr-2 font-normal">Cantidad</th><th className="pr-2 font-normal">Precio</th>{unitCost != null && <th className="pr-2 font-normal">Ganancia / margen</th>}<th className="font-normal" /></tr></thead>
            <tbody>{current.map(p => {
              const profit = unitCost != null ? Number(p.price) - unitCost : null;
              return (
                <tr key={p.id} className="border-t border-neutral-100 dark:border-neutral-800">
                  <td className="py-2 pr-2">{priceTypeLabel(p.price_type)}{p.valid_until && <span className="block text-xs text-neutral-500 dark:text-neutral-400">hasta {day(p.valid_until)}</span>}</td>
                  <td className="pr-2">{range(p)}</td>
                  <td className="pr-2 font-medium">{money(p.price)}</td>
                  {profit != null && <td className={`pr-2 ${profit < 0 ? 'text-red-700 dark:text-red-300' : ''}`}>{money(profit)} · {(profit / Number(p.price) * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })} %</td>}
                  <td className="text-right"><form action={endPrice}><input type="hidden" name="product_id" value={id} /><input type="hidden" name="price_id" value={p.id} /><button type="submit" className={smallButton}>Finalizar</button></form></td>
                </tr>
              );
            })}</tbody>
          </table></div>}
        <p className={`mt-3 ${hint}`}>
          {unitCost != null
            ? `Rentabilidad calculada con el costo por unidad del último cálculo guardado para este producto: ${money(unitCost)} (${day(lastCalculation.data!.created_at)}).`
            : 'Para ver la rentabilidad, guardá un cálculo en Calcular eligiendo este producto.'}
        </p>
      </section>

      <section className={cardClass}>
        <h2 className="font-semibold">Agregar precio</h2>
        <p className={`mt-1 ${hint}`}>Si ya hay un precio vigente del mismo tipo y cantidades, se cierra y queda en el historial.</p>
        <form action={addPrice} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="product_id" value={id} />
          <label className="grid gap-1 text-sm font-medium">Tipo<select name="price_type" defaultValue="retail" className={inputClass}>{PRICE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
          <label className="grid gap-1 text-sm font-medium">Precio por unidad (ARS) *<input name="price" type="number" min="0.01" step="any" required className={inputClass} /></label>
          <label className="grid gap-1 text-sm font-medium">Desde (unidades)<input name="quantity_min" type="number" min="1" step="1" defaultValue="1" className={inputClass} /></label>
          <label className="grid gap-1 text-sm font-medium">Hasta (unidades, opcional)<input name="quantity_max" type="number" min="1" step="1" className={inputClass} /></label>
          <label className="grid gap-1 text-sm font-medium">Vigente desde<input name="valid_from" type="date" className={inputClass} /><span className="text-xs font-normal text-neutral-500 dark:text-neutral-400">Vacío = hoy.</span></label>
          <label className="grid gap-1 text-sm font-medium">Vigente hasta (opcional)<input name="valid_until" type="date" className={inputClass} /><span className="text-xs font-normal text-neutral-500 dark:text-neutral-400">Útil para promociones.</span></label>
          <button type="submit" className={`${primaryButton} sm:col-span-2`}>Guardar precio</button>
        </form>
      </section>

      <LinkSection productId={id} kind="formula" title="Fórmulas" linked={formulaLinks} available={(formulas.data ?? []).filter(f => !formulaLinks.some(l => l.id === f.id))} />
      <LinkSection productId={id} kind="mold" title="Moldes" linked={moldLinks} available={(molds.data ?? []).filter(m => !moldLinks.some(l => l.id === m.id))} />

      <section className={cardClass}>
        <h2 className="font-semibold">Datos del producto</h2>
        <form action={updateProduct} className="mt-3 grid gap-3">
          <input type="hidden" name="product_id" value={id} />
          <label className="grid gap-1 text-sm font-medium">Nombre *<input name="name" required defaultValue={product.name} className={inputClass} /></label>
          <label className="grid gap-1 text-sm font-medium">Estado<select name="status" defaultValue={product.status} className={inputClass}>{PRODUCT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select><span className="text-xs font-normal text-neutral-500 dark:text-neutral-400">Pausar o archivar no borra nada.</span></label>
          <label className="grid gap-1 text-sm font-medium">Foto (URL)<input name="photo_url" type="url" defaultValue={product.photo_url ?? ''} className={inputClass} /></label>
          <label className="grid gap-1 text-sm font-medium">Notas<textarea name="notes" rows={2} defaultValue={product.notes ?? ''} className={inputClass} /></label>
          <button type="submit" className={primaryButton}>Guardar datos</button>
        </form>
      </section>

      {others.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Historial de precios</h2>
          <ul className="grid gap-1 text-sm">
            {others.map(p => <li key={p.id} className="flex flex-wrap justify-between gap-2 rounded-xl border border-neutral-200 px-3 py-2 dark:border-neutral-800"><span>{priceTypeLabel(p.price_type)} · {range(p)} · {money(p.price)}</span><span className={hint}>{new Date(p.valid_from) > now ? `desde ${day(p.valid_from)} (programado)` : `${day(p.valid_from)} → ${p.valid_until ? day(p.valid_until) : ''}`}</span></li>)}
          </ul>
        </section>
      )}
    </main>
  );
}
