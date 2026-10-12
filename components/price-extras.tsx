'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ROUND_STEPS, roundPrice, wholesalePrice } from '@/lib/pricing';

const KEY = 'calculadora-precio';
const money = (value: number) => value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

// Debajo del precio sugerido: precio redondeado y precio mayorista. La elección queda guardada en el aparato.
export function PriceExtras({ price, unitCost }: { price: number; unitCost: number }) {
  const [step, setStep] = useState(100);
  const [discount, setDiscount] = useState('20');
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as { step?: number; discount?: string };
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lee la preferencia guardada al montar
      if (typeof saved.step === 'number') setStep(saved.step);
      if (typeof saved.discount === 'string') setDiscount(saved.discount);
    } catch {}
  }, []);
  const save = (next: { step?: number; discount?: string }) => {
    try { localStorage.setItem(KEY, JSON.stringify({ step, discount, ...next })); } catch {}
  };
  if (!(price > 0)) return null;

  const rounded = roundPrice(price, step);
  const wholesale = wholesalePrice(price, Number(discount.replace(',', '.')) || 0, step);
  const below = wholesale < unitCost;

  return (
    <div className="mt-4 grid gap-3 rounded-2xl bg-white/10 p-4 text-sm dark:bg-black/10">
      <div>
        <p className="opacity-75">Redondear a</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {ROUND_STEPS.map((value) => (
            <button key={value} type="button" aria-pressed={step === value} onClick={() => { setStep(value); save({ step: value }); }}
              className={`rounded-full px-3 py-1 font-semibold ${step === value ? 'bg-orange-500 text-white' : 'bg-white/15 dark:bg-black/10'}`}>{value ? `$${value.toLocaleString('es-AR')}` : 'No'}</button>
          ))}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3">
        <div><dt className="opacity-75">Precio para vender</dt><dd className="font-display text-2xl font-bold">{money(rounded)}</dd><dd className="text-xs opacity-75">ganás {money(rounded - unitCost)} por pieza</dd></div>
        <div>
          <dt className="flex items-center gap-1.5 opacity-75">Mayorista
            <label className="flex items-center gap-1">−<input value={discount} onChange={(e) => { setDiscount(e.target.value); save({ discount: e.target.value }); }} inputMode="decimal" aria-label="Descuento mayorista en %" className="w-10 rounded-md bg-white/20 px-1 text-center" />%</label>
          </dt>
          <dd className="font-display text-2xl font-bold">{money(wholesale)}</dd>
          <dd className={`text-xs ${below ? 'font-semibold text-red-200' : 'opacity-75'}`}>{below ? '¡Ojo! Queda por debajo del costo' : `ganás ${money(wholesale - unitCost)} por pieza`}</dd>
        </div>
      </dl>
      <p className="text-xs"><Link href={`/herramientas?neto=${Math.round(rounded)}`} className="font-semibold underline">¿Lo vendés en Mercado Libre o Tiendanube? Mirá a cuánto publicarlo</Link> · <Link href={`/herramientas?costo=${Math.round(unitCost)}`} className="underline">armar un kit</Link></p>
    </div>
  );
}
