'use client';

import { SubmitButton } from '@/components/submit-button';
import { useState } from 'react';
import { registerSale } from '../actions';
import { saleTotalsClient } from './totals';
import { QueuedSaleMessage, queueSaleIfOffline } from './offline';
import { isOffline, offlineEnabled } from '@/lib/outbox';

const inputClass = 'w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white';
const labelClass = 'grid gap-1 text-xs text-neutral-500 dark:text-neutral-400';
const money = (value: number) => value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 });
const num = (value: string) => { const n = Number(value.replace(',', '.')); return Number.isFinite(n) ? n : 0; };

type Props = {
  productId: string;
  productName: string;
  quantity: string;
  suggestedPrice: number | null;
  priceLabel: string | null;
  unitCost: number | null;
  costSource: string | null;
  today: string;
  inStock: number | null;
  paymentMethods: string[];
};

// Formulario de venta con ganancia y margen calculados mientras se escribe. El servidor vuelve a calcular todo al guardar.
export function SaleForm({ productId, productName, quantity, suggestedPrice, priceLabel, unitCost, costSource, today, inStock, paymentMethods }: Props) {
  const [price, setPrice] = useState(suggestedPrice != null ? String(suggestedPrice) : '');
  const [discount, setDiscount] = useState('');
  const [commission, setCommission] = useState('');
  const [queued, setQueued] = useState(false);
  const q = num(quantity);
  const t = saleTotalsClient(q, num(price), unitCost ?? 0, num(discount), num(commission));

  if (queued) return <QueuedSaleMessage />;

  return (
    <form action={registerSale} onSubmit={async (event) => {
      // Sin conexión (Mensualidad Plus): se guarda en el aparato en lugar de mandarla al servidor.
      if (!isOffline() || !offlineEnabled()) return;
      event.preventDefault();
      if (await queueSaleIfOffline(event.currentTarget, productName)) setQueued(true);
    }} className="grid gap-4">
      <input type="hidden" name="product_id" value={productId} />
      <input type="hidden" name="quantity" value={quantity} />
      <section className="grid gap-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:grid-cols-3 dark:border-neutral-800 dark:bg-neutral-900">
        <label className={labelClass}>Precio por unidad ($)<input name="unit_price" inputMode="decimal" required value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} />
          {priceLabel && <span>Sugerido: {priceLabel}</span>}</label>
        <label className={labelClass}>Fecha<input name="date" type="date" defaultValue={today} max={today} className={inputClass} /></label>
        <details open={Boolean(discount || commission) || undefined} className="group sm:col-span-3">
          <summary className="cursor-pointer list-none text-sm font-semibold text-orange-800 underline underline-offset-4 dark:text-orange-300">Más opciones (descuento, comisión, cliente, medio de pago)</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>Descuento total ($)<input name="discount" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" className={inputClass} /></label>
            <label className={labelClass}>Comisión (%)<input name="commission_pct" inputMode="decimal" value={commission} onChange={(e) => setCommission(e.target.value)} placeholder="Ej.: 15 en marketplace" className={inputClass} /></label>
            <label className={labelClass}>Cliente (opcional)<input name="customer_name" maxLength={120} className={inputClass} /></label>
            <label className={labelClass}>Medio de pago
              <select name="payment_method" defaultValue="" className={inputClass}><option value="">—</option>{paymentMethods.map((m) => <option key={m} value={m}>{m}</option>)}</select>
            </label>
          </div>
        </details>
      </section>

      <section className="rounded-3xl bg-neutral-950 p-5 text-white dark:bg-white dark:text-neutral-950" aria-live="polite">
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><span className="opacity-60">Cobrás</span><strong className="mt-1 block text-lg">{money(t.total)}</strong></div>
          <div><span className="opacity-60">Costo</span><strong className="mt-1 block text-lg">{unitCost == null ? '—' : money(t.totalCost)}</strong></div>
          <div><span className="opacity-60">Comisión</span><strong className="mt-1 block text-lg">{money(t.commission)}</strong></div>
          <div><span className="opacity-60">Ganancia</span><strong className={`mt-1 block text-lg ${t.netIncome < 0 ? 'text-red-400 dark:text-red-600' : ''}`}>{money(t.netIncome)} <span className="text-sm font-normal opacity-70">({t.margin.toLocaleString('es-AR', { maximumFractionDigits: 1 })} %)</span></strong></div>
        </div>
        <p className="mt-3 text-xs opacity-60">{unitCost == null ? 'Este producto no tiene costo conocido: guardá un cálculo o registrá una producción para que la ganancia sea real.' : `Costo por pieza según la ${costSource}: ${money(unitCost)}.`}</p>
      </section>

      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="deduct" defaultChecked={inStock !== null} className="mt-1" />
        <span>Descontar del stock de productos terminados{inStock !== null ? ` (hay ${inStock.toLocaleString('es-AR')})` : ' (todavía no lo llevás en stock)'}</span></label>
      <div><SubmitButton className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">Registrar venta</SubmitButton></div>
    </form>
  );
}
