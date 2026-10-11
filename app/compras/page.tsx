import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAccessSnapshot, hasFeature } from '@/lib/access/permissions';
import { FeatureLocked } from '@/components/feature-locked';
import { money } from '@/app/stock/constants';
import { dateOnly, errorBox, pageClass, primaryButton, secondaryButton } from '@/lib/ui';

const one = <T,>(value: T | T[] | null) => (Array.isArray(value) ? value[0] : value);

export default async function PurchasesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const snapshot = await getAccessSnapshot();
  const allowed = Boolean(snapshot && hasFeature(snapshot, 'PROVEEDORES_BASICO'));
  const { data: purchases, error } = allowed
    ? await supabase.from('supplier_purchases').select('id,purchase_date,total,stock_updated,suppliers(name),supplier_purchase_items(id)').eq('user_id', user.id).order('purchase_date', { ascending: false }).limit(100)
    : { data: [], error: null };

  return (
    <main className={pageClass}>
      <header className="flex items-start justify-between gap-4">
        <div>
          <Link href="/gestion" className="text-sm text-neutral-500 dark:text-neutral-400">← Gestión</Link>
          <h1 className="text-2xl font-semibold">Compras de materiales</h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Cada compra puede actualizar el precio de los materiales y sumar al stock.</p>
        </div>
        {allowed && <Link href="/compras/nueva" className={primaryButton}>Nueva</Link>}
      </header>

      {!allowed ? (
        <FeatureLocked title="Compras es parte del módulo «Proveedores básico» o de Emprendedor.">Registrá compras a tus proveedores, con precios y stock al día.</FeatureLocked>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Link href="/proveedores" className={secondaryButton}>Proveedores</Link>
            <Link href="/compras/comparar" className={secondaryButton}>Comparar precios</Link>
          </div>
          {error ? <div role="alert" className={errorBox}>No se pudieron cargar las compras: {error.message}</div>
            : !purchases?.length ? <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">Todavía no registraste compras.</div>
              : <section className="grid gap-3">{purchases.map((purchase) => (
                <Link key={purchase.id} href={`/compras/${purchase.id}`} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-medium">{one(purchase.suppliers)?.name ?? 'Sin proveedor'}</h2>
                      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{dateOnly(purchase.purchase_date)} · {purchase.supplier_purchase_items?.length ?? 0} materiales{purchase.stock_updated ? ' · sumado al stock' : ''}</p>
                    </div>
                    <strong>{money(purchase.total)}</strong>
                  </div>
                </Link>
              ))}</section>}
        </>
      )}
    </main>
  );
}
