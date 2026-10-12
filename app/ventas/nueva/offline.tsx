'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CloudOff } from 'lucide-react';
import { enqueue, isOffline, offlineEnabled } from '@/lib/outbox';

// Convierte el formulario de venta en la carga que se sube después (mismos nombres de campo que el servidor).
export function saleFromForm(form: HTMLFormElement) {
  const data = new FormData(form);
  const value = (key: string) => String(data.get(key) ?? '').trim();
  return {
    productId: value('product_id'), quantity: value('quantity'), unitPrice: value('unit_price'), discount: value('discount'),
    commissionPct: value('commission_pct'), date: value('date'), paymentMethod: value('payment_method'),
    customerName: value('customer_name'), deduct: data.get('deduct') === 'on',
  };
}

// Guarda la venta en el aparato si no hay conexión (Mensualidad Plus). Devuelve true si la guardó.
export async function queueSaleIfOffline(form: HTMLFormElement, productName: string) {
  if (!isOffline() || !offlineEnabled()) return false;
  const sale = saleFromForm(form);
  await enqueue('sale', sale, `Venta de ${productName} ×${sale.quantity}`);
  return true;
}

export function QueuedSaleMessage() {
  return (
    <div role="status" className="rounded-3xl bg-orange-50 p-5 text-sm dark:bg-orange-950/40">
      <p className="flex items-center gap-2 font-semibold"><CloudOff size={18} aria-hidden="true" />Venta guardada sin conexión</p>
      <p className="mt-1">Quedó en este aparato y se sube sola cuando vuelva internet (ahí se calcula la ganancia con el costo del producto).</p>
      <Link href="/ventas/nueva" className="mt-3 inline-block font-semibold underline">Cargar otra venta</Link>
    </div>
  );
}

const inputClass = 'w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white';
const labelClass = 'grid gap-1 text-xs text-neutral-500 dark:text-neutral-400';

// Sin conexión no se puede pasar al segundo paso (necesita el servidor): se carga todo en un solo formulario.
export function OfflineSaleForm({ products, paymentMethods, today }: { products: { id: string; name: string }[]; paymentMethods: string[]; today: string }) {
  const [show, setShow] = useState(false);
  const [queued, setQueued] = useState(false);
  useEffect(() => {
    const update = () => setShow(isOffline() && offlineEnabled());
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  if (!show) return null;
  if (queued) return <QueuedSaleMessage />;

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const name = products.find((p) => p.id === String(new FormData(form).get('product_id')))?.name ?? 'producto';
        if (await queueSaleIfOffline(form, name)) setQueued(true);
      }}
      className="grid gap-3 rounded-3xl bg-white p-5 sm:grid-cols-3 dark:bg-neutral-900"
    >
      <p className="flex items-center gap-2 text-sm font-semibold sm:col-span-3"><CloudOff size={18} aria-hidden="true" />Sin conexión: cargá la venta acá y se sube sola después.</p>
      <label className={`${labelClass} sm:col-span-2`}>Producto
        <select name="product_id" required defaultValue="" className={inputClass}>
          <option value="" disabled>Elegí un producto</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <label className={labelClass}>Cantidad<input name="quantity" inputMode="decimal" required defaultValue="1" className={inputClass} /></label>
      <label className={labelClass}>Precio por unidad ($)<input name="unit_price" inputMode="decimal" required className={inputClass} /></label>
      <label className={labelClass}>Descuento total ($)<input name="discount" inputMode="decimal" placeholder="0" className={inputClass} /></label>
      <label className={labelClass}>Comisión (%)<input name="commission_pct" inputMode="decimal" placeholder="0" className={inputClass} /></label>
      <label className={labelClass}>Fecha<input name="date" type="date" defaultValue={today} max={today} className={inputClass} /></label>
      <label className={labelClass}>Cliente (opcional)<input name="customer_name" maxLength={120} className={inputClass} /></label>
      <label className={labelClass}>Medio de pago
        <select name="payment_method" defaultValue="" className={inputClass}><option value="">—</option>{paymentMethods.map((m) => <option key={m} value={m}>{m}</option>)}</select>
      </label>
      <label className="flex items-start gap-2 text-sm sm:col-span-3"><input type="checkbox" name="deduct" defaultChecked className="mt-1" /><span>Descontar del stock de productos terminados</span></label>
      <div className="sm:col-span-3"><button type="submit" className="rounded-xl bg-resina px-4 py-2.5 text-sm font-bold text-resina-dark">Guardar venta sin conexión</button></div>
    </form>
  );
}
