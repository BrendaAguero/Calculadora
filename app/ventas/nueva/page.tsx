import { parseAR } from '@/lib/num';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAccessSnapshot, hasFeature } from '@/lib/access/permissions';
import { priceTypeLabel } from '@/app/gestion/productos/constants';
import { money } from '@/app/stock/constants';
import { cardClass, errorBox, inputClass, labelClass, pageClass, secondaryButton, warnBox } from '@/lib/ui';
import { PAYMENT_METHODS, productUnitCost, suggestedPrice } from '../compute';
import { SaleForm } from './sale-form';
import { OfflineSaleForm } from './offline';

export default async function NewSalePage({ searchParams }: { searchParams: Promise<{ producto?: string; cantidad?: string; error?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const snapshot = await getAccessSnapshot();
  if (!snapshot || !hasFeature(snapshot, 'VENTAS')) redirect('/ventas');

  const { data: products } = await supabase.from('products').select('id,name').eq('user_id', user.id).neq('status', 'archived').order('name');
  const quantity = parseAR((params.cantidad ?? ''));
  const product = (products ?? []).find((p) => p.id === params.producto);
  const ready = Boolean(product) && Number.isFinite(quantity) && quantity > 0;

  const [price, cost, stock] = ready
    ? await Promise.all([
      suggestedPrice(supabase, product!.id, quantity),
      productUnitCost(supabase, user.id, product!.id),
      supabase.from('stock_items').select('quantity').eq('user_id', user.id).eq('product_id', product!.id).maybeSingle().then((r) => r.data),
    ])
    : [null, null, null];
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });

  return (
    <main className={pageClass}>
      <header>
        <Link href="/ventas" className="text-sm text-neutral-500 dark:text-neutral-400">← Ventas</Link>
        <h1 className="text-2xl font-semibold">Nueva venta</h1>
      </header>
      {params.error && <div role="alert" className={errorBox}>{params.error}</div>}

      {!products?.length ? (
        <div className={warnBox}>Primero creá un producto. <Link href="/gestion/productos/new" className="underline">Crear producto</Link></div>
      ) : (
        <form method="get" className={`${cardClass} grid gap-3 sm:grid-cols-3`}>
          <label className={`${labelClass} sm:col-span-2`}>Producto
            <select name="producto" defaultValue={params.producto ?? ''} required className={inputClass}>
              <option value="" disabled>Elegí un producto</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className={labelClass}>Cantidad<input name="cantidad" inputMode="decimal" required defaultValue={params.cantidad ?? '1'} className={inputClass} /></label>
          <div className="sm:col-span-3"><button type="submit" className={secondaryButton}>{ready ? 'Cambiar' : 'Continuar'}</button></div>
        </form>
      )}

      {products?.length ? <OfflineSaleForm products={products} paymentMethods={PAYMENT_METHODS} today={today} /> : null}

      {ready && (
        <SaleForm
          key={`${product!.id}-${params.cantidad}`}
          productId={product!.id}
          productName={product!.name}
          quantity={params.cantidad!}
          suggestedPrice={price?.price ?? null}
          priceLabel={price ? `${money(price.price)} (${priceTypeLabel(price.type).toLowerCase()})` : null}
          unitCost={cost?.cost ?? null}
          costSource={cost?.source ?? null}
          today={today}
          inStock={stock ? Number(stock.quantity) : null}
          paymentMethods={PAYMENT_METHODS}
        />
      )}
    </main>
  );
}
