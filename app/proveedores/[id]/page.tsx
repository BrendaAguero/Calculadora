import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAccessSnapshot, hasFeature } from '@/lib/access/permissions';
import { money } from '@/app/stock/constants';
import { cardClass, dateTime, errorBox, inputClass, labelClass, okBox, pageClass, primaryButton, secondaryButton } from '@/lib/ui';
import { setSupplierStatus, updateSupplier } from '../actions';

export default async function SupplierPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { id } = await params;
  const { ok, error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const snapshot = await getAccessSnapshot();
  if (!snapshot || !hasFeature(snapshot, 'PROVEEDORES_BASICO')) redirect('/proveedores');

  const [{ data: supplier }, { data: purchases }] = await Promise.all([
    supabase.from('suppliers').select('id,name,phone,email,notes,status').eq('id', id).eq('user_id', user.id).maybeSingle(),
    supabase.from('supplier_purchases').select('id,purchase_date,total,supplier_purchase_items(id)').eq('supplier_id', id).eq('user_id', user.id).order('purchase_date', { ascending: false }).limit(50),
  ]);
  if (!supplier) notFound();
  const archived = supplier.status === 'archived';

  return (
    <main className={pageClass}>
      <header>
        <Link href="/proveedores" className="text-sm text-neutral-500 dark:text-neutral-400">← Proveedores</Link>
        <h1 className="mt-1 text-2xl font-semibold">{supplier.name}{archived && <span className="ml-2 text-sm font-normal text-neutral-500">(archivado)</span>}</h1>
      </header>
      {ok && !error && <div role="status" className={okBox}>{ok}</div>}
      {error && <div role="alert" className={errorBox}>{error}</div>}

      <section className={cardClass}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Compras a este proveedor</h2>
          {!archived && <Link href={`/compras/nueva?proveedor=${supplier.id}`} className={secondaryButton}>Registrar compra</Link>}
        </div>
        {!purchases?.length
          ? <p className="mt-2 text-sm text-neutral-500">Todavía no hay compras.</p>
          : <ul className="mt-3 divide-y divide-neutral-100 text-sm dark:divide-neutral-800">{purchases.map((purchase) => (
            <li key={purchase.id}><Link href={`/compras/${purchase.id}`} className="flex justify-between py-2 hover:underline"><span>{dateTime(purchase.purchase_date)} · {purchase.supplier_purchase_items?.length ?? 0} materiales</span><strong>{money(purchase.total)}</strong></Link></li>
          ))}</ul>}
      </section>

      <form action={updateSupplier} className={`${cardClass} grid gap-3 sm:grid-cols-2`}>
        <h2 className="font-semibold sm:col-span-2">Datos</h2>
        <input type="hidden" name="supplier_id" value={supplier.id} />
        <label className={`${labelClass} sm:col-span-2`}>Nombre *<input name="name" required defaultValue={supplier.name} maxLength={120} className={inputClass} /></label>
        <label className={labelClass}>Teléfono<input name="phone" defaultValue={supplier.phone ?? ''} maxLength={40} className={inputClass} /></label>
        <label className={labelClass}>Email<input name="email" type="email" defaultValue={supplier.email ?? ''} maxLength={120} className={inputClass} /></label>
        <label className={`${labelClass} sm:col-span-2`}>Notas<input name="notes" defaultValue={supplier.notes ?? ''} maxLength={300} className={inputClass} /></label>
        <div className="sm:col-span-2"><button type="submit" className={primaryButton}>Guardar cambios</button></div>
      </form>

      <form action={setSupplierStatus}>
        <input type="hidden" name="supplier_id" value={supplier.id} />
        <input type="hidden" name="status" value={archived ? 'active' : 'archived'} />
        <button type="submit" className={secondaryButton}>{archived ? 'Restaurar proveedor' : 'Archivar proveedor'}</button>
        <p className="mt-1 text-xs text-neutral-500">Archivar no borra el proveedor ni sus compras.</p>
      </form>
    </main>
  );
}
