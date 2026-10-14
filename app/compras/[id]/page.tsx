import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAccessSnapshot, hasFeature } from '@/lib/access/permissions';
import { amount, money } from '@/app/stock/constants';
import { cardClass, dateOnly, okBox, pageClass } from '@/lib/ui';

const one = <T,>(value: T | T[] | null) => (Array.isArray(value) ? value[0] : value);

export default async function PurchaseDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const { id } = await params;
  const { ok } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const snapshot = await getAccessSnapshot();
  if (!snapshot || !hasFeature(snapshot, 'PROVEEDORES_BASICO')) redirect('/compras');

  const { data: purchase } = await supabase
    .from('supplier_purchases')
    .select('id,purchase_date,total,stock_updated,notes,supplier_id,suppliers(name),supplier_purchase_items(id,quantity,unit,unit_price,total,material_id,materials(name))')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!purchase) notFound();

  return (
    <main className={pageClass}>
      <header>
        <Link href="/compras" className="text-sm text-neutral-500 dark:text-neutral-400">← Compras</Link>
        <h1 className="mt-1 text-2xl font-semibold">Compra {one(purchase.suppliers)?.name ? `a ${one(purchase.suppliers)!.name}` : 'sin proveedor'}</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{dateOnly(purchase.purchase_date)}{purchase.notes ? ` · ${purchase.notes}` : ''}</p>
      </header>
      {ok && <div role="status" className={okBox}>Compra registrada{purchase.stock_updated ? ' y sumada al stock' : ''}.</div>}
      <section className={cardClass}>
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-neutral-500"><tr><th className="py-1 font-normal">Material</th><th className="font-normal">Cantidad</th><th className="font-normal">Precio unitario</th><th className="text-right font-normal">Total</th></tr></thead>
          <tbody>{(purchase.supplier_purchase_items ?? []).map((item) => (
            <tr key={item.id} className="border-t border-neutral-100 dark:border-neutral-800">
              <td className="py-2"><Link href={`/materials/${item.material_id}`} className="underline">{one(item.materials)?.name}</Link></td>
              <td>{amount(item.quantity, item.unit)}</td>
              <td>{money(item.unit_price)} / {item.unit}</td>
              <td className="text-right">{money(item.total)}</td>
            </tr>
          ))}</tbody>
        </table>
        <p className="mt-3 text-right text-sm">Total: <strong>{money(purchase.total)}</strong></p>
      </section>
      <div className="flex flex-wrap gap-3 text-sm">
        {purchase.supplier_id && <Link href={`/proveedores/${purchase.supplier_id}`} className="underline">Ver proveedor</Link>}
        <Link href="/stock" className="underline">Ver stock</Link>
        <Link href="/compras/comparar" className="underline">Comparar precios</Link>
      </div>
    </main>
  );
}
