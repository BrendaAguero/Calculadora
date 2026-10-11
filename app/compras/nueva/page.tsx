import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAccessSnapshot, hasFeature } from '@/lib/access/permissions';
import { UNIT_FACTORS } from '@/app/stock/constants';
import { cardClass, errorBox, inputClass, labelClass, pageClass, primaryButton, warnBox } from '@/lib/ui';
import { registerPurchase } from '../actions';
import { MAX_ROWS } from '../constants';

const UNITS = Object.keys(UNIT_FACTORS).filter((unit) => unit !== 'unidades');

export default async function NewPurchasePage({ searchParams }: { searchParams: Promise<{ proveedor?: string; error?: string }> }) {
  const { proveedor, error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const snapshot = await getAccessSnapshot();
  if (!snapshot || !hasFeature(snapshot, 'PROVEEDORES_BASICO')) redirect('/proveedores');

  const [{ data: suppliers }, { data: materials }] = await Promise.all([
    supabase.from('suppliers').select('id,name').eq('user_id', user.id).eq('status', 'active').order('name'),
    supabase.from('materials').select('id,name,default_unit').eq('user_id', user.id).eq('status', 'active').order('name'),
  ]);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });

  return (
    <main className={pageClass}>
      <header>
        <Link href="/compras" className="text-sm text-neutral-500 dark:text-neutral-400">← Compras</Link>
        <h1 className="text-2xl font-semibold">Nueva compra</h1>
      </header>
      {error && <div role="alert" className={errorBox}>{error}</div>}

      {!materials?.length ? (
        <div className={warnBox}>Primero creá tus materiales. <Link href="/materials/new" className="underline">Crear material</Link></div>
      ) : (
        <form action={registerPurchase} className="grid gap-4">
          <section className={`${cardClass} grid gap-3 sm:grid-cols-2`}>
            <label className={labelClass}>Proveedor
              <select name="supplier_id" defaultValue={proveedor ?? ''} className={inputClass}>
                <option value="">Sin proveedor</option>
                {(suppliers ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className={labelClass}>Fecha<input name="date" type="date" defaultValue={today} max={today} className={inputClass} /></label>
            <label className={`${labelClass} sm:col-span-2`}>Nota (opcional)<input name="notes" maxLength={200} className={inputClass} /></label>
            {!suppliers?.length && <p className="text-xs text-neutral-500 sm:col-span-2">Todavía no tenés proveedores. <Link href="/proveedores" className="underline">Cargar uno</Link> (opcional).</p>}
          </section>

          <section className={cardClass}>
            <h2 className="font-semibold">Materiales comprados</h2>
            <p className="mt-1 text-xs text-neutral-500">Completá las filas que necesites; las vacías se ignoran. «Pagaste» es el total de esa fila.</p>
            <div className="mt-3 grid gap-3">
              {Array.from({ length: MAX_ROWS }, (_, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 border-t border-neutral-100 pt-3 first:border-0 first:pt-0 sm:grid-cols-[2fr_1fr_1fr_1fr] dark:border-neutral-800">
                  <label className={`${labelClass} col-span-2 sm:col-span-1`}>Material
                    <select name={`material_${i}`} defaultValue="" required={i === 0} className={inputClass}>
                      <option value="">—</option>
                      {materials.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.default_unit})</option>)}
                    </select>
                  </label>
                  <label className={labelClass}>Cantidad<input name={`quantity_${i}`} inputMode="decimal" required={i === 0} className={inputClass} /></label>
                  <label className={labelClass}>Unidad
                    <select name={`unit_${i}`} defaultValue="kg" className={inputClass}>{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select>
                  </label>
                  <label className={labelClass}>Pagaste ($)<input name={`total_${i}`} inputMode="decimal" required={i === 0} className={inputClass} /></label>
                </div>
              ))}
            </div>
          </section>

          <section className={`${cardClass} grid gap-2 text-sm`}>
            <label className="flex items-start gap-2"><input type="checkbox" name="update_price" defaultChecked className="mt-1" /> Usar estos precios como precio actual de cada material (el anterior queda en el historial)</label>
            <label className="flex items-start gap-2"><input type="checkbox" name="update_stock" defaultChecked className="mt-1" /> Sumar estas cantidades al stock</label>
          </section>

          <div><button type="submit" className={primaryButton}>Registrar compra</button></div>
        </form>
      )}
    </main>
  );
}
