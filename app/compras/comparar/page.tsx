import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAccessSnapshot, hasFeature } from '@/lib/access/permissions';
import { convert, money } from '@/app/stock/constants';
import { cardClass, errorBox, pageClass } from '@/lib/ui';

const one = <T,>(value: T | T[] | null) => (Array.isArray(value) ? value[0] : value);
const date = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { dateStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires' });

type Offer = { supplier: string; unitCost: number; date: string };

// Comparación básica: para cada material, el último precio que pagaste a cada proveedor (en la unidad del material).
export default async function ComparePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const snapshot = await getAccessSnapshot();
  if (!snapshot || !hasFeature(snapshot, 'PROVEEDORES_BASICO')) redirect('/proveedores');

  const { data: items, error } = await supabase
    .from('supplier_purchase_items')
    .select('material_id,quantity,unit,total,materials(name,default_unit),supplier_purchases!inner(user_id,purchase_date,suppliers(name))')
    .eq('supplier_purchases.user_id', user.id)
    .limit(1000);

  const byMaterial = new Map<string, { name: string; unit: string; offers: Map<string, Offer> }>();
  for (const item of items ?? []) {
    const material = one(item.materials);
    const purchase = one(item.supplier_purchases);
    if (!material || !purchase) continue;
    const quantity = convert(Number(item.quantity), item.unit, material.default_unit);
    if (!quantity) continue;
    const supplier = one(purchase.suppliers)?.name ?? 'Sin proveedor';
    const entry = byMaterial.get(item.material_id) ?? { name: material.name, unit: material.default_unit, offers: new Map<string, Offer>() };
    const previous = entry.offers.get(supplier);
    if (!previous || previous.date < purchase.purchase_date) entry.offers.set(supplier, { supplier, unitCost: Number(item.total) / quantity, date: purchase.purchase_date });
    byMaterial.set(item.material_id, entry);
  }
  const materials = [...byMaterial.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name, 'es'));

  return (
    <main className={pageClass}>
      <header>
        <Link href="/compras" className="text-sm text-neutral-500 dark:text-neutral-400">← Compras</Link>
        <h1 className="text-2xl font-semibold">Comparar precios</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">El último precio que pagaste a cada proveedor, por unidad del material. El más barato aparece marcado.</p>
      </header>
      {error && <div role="alert" className={errorBox}>No se pudieron cargar las compras: {error.message}</div>}
      {!error && !materials.length && <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">Cuando registres compras, acá vas a ver la comparación.</div>}
      {materials.map(([id, material]) => {
        const offers = [...material.offers.values()].sort((a, b) => a.unitCost - b.unitCost);
        const factor = material.unit === 'g' ? 1000 : material.unit === 'ml' ? 1000 : 1;
        const shownUnit = material.unit === 'g' ? 'kg' : material.unit === 'ml' ? 'l' : material.unit;
        return (
          <section key={id} className={cardClass}>
            <h2 className="font-semibold"><Link href={`/materials/${id}`} className="hover:underline">{material.name}</Link></h2>
            <ul className="mt-2 grid gap-1 text-sm">
              {offers.map((offer, index) => (
                <li key={offer.supplier} className={`flex justify-between rounded-lg px-2 py-1 ${index === 0 && offers.length > 1 ? 'bg-emerald-50 font-medium text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200' : ''}`}>
                  <span>{offer.supplier}{index === 0 && offers.length > 1 ? ' · más barato' : ''}</span>
                  <span>{money(offer.unitCost * factor)} / {shownUnit} <span className="text-xs text-neutral-500">({date(offer.date)})</span></span>
                </li>
              ))}
            </ul>
            {offers.length > 1 && <p className="mt-2 text-xs text-neutral-500">Diferencia entre el más barato y el más caro: {money((offers[offers.length - 1].unitCost - offers[0].unitCost) * factor)} por {shownUnit}.</p>}
          </section>
        );
      })}
    </main>
  );
}
