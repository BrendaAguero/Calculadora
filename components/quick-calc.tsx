'use client';

import { parseAR } from '@/lib/num';
import { useState } from 'react';
import Link from 'next/link';
import { roundPrice } from '@/lib/pricing';

const n = (value: string) => { const v = parseAR(String(value)); return Number.isFinite(v) && v > 0 ? v : 0; };
const money = (value: number) => value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const input = 'w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-base text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white';

// Cálculo rápido en Inicio: gramos, precio del kilo y ganancia → precio al instante (no se guarda).
export function QuickCalc() {
  const [grams, setGrams] = useState('');
  const [kg, setKg] = useState('');
  const [extra, setExtra] = useState('');
  const [profit, setProfit] = useState('100');
  const cost = (n(grams) / 1000) * n(kg) + n(extra);
  const price = roundPrice(cost * (1 + n(profit) / 100), 100);
  return (
    <section aria-labelledby="calculo-rapido" className="rounded-3xl bg-white p-5 dark:bg-neutral-900">
      <h2 id="calculo-rapido" className="text-lg">Cálculo rápido</h2>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">Para una pieza. No se guarda.</p>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <label className="grid gap-1 text-sm font-medium">Gramos de la pieza<input value={grams} onChange={(e) => setGrams(e.target.value)} inputMode="decimal" placeholder="Ej.: 200" className={input} /></label>
        <label className="grid gap-1 text-sm font-medium">Precio del kilo ($)<input value={kg} onChange={(e) => setKg(e.target.value)} inputMode="decimal" placeholder="Ej.: 2500" className={input} /></label>
        <label className="grid gap-1 text-sm font-medium">Otros gastos ($)<input value={extra} onChange={(e) => setExtra(e.target.value)} inputMode="decimal" placeholder="Caja, pintura…" className={input} /></label>
        <label className="grid gap-1 text-sm font-medium">Ganancia (%)<input value={profit} onChange={(e) => setProfit(e.target.value)} inputMode="decimal" className={input} /></label>
      </div>
      {cost > 0 && (
        <div className="mt-3 flex items-end justify-between gap-3 rounded-2xl bg-orange-50 p-4 dark:bg-orange-950/40">
          <div><p className="text-sm text-neutral-600 dark:text-neutral-300">Te cuesta {money(cost)}</p><p className="font-display text-3xl font-bold">Cobrá {money(price)}</p></div>
          <Link href="/calcular" className="shrink-0 text-sm font-semibold text-orange-800 underline dark:text-orange-300">Cálculo completo</Link>
        </div>
      )}
    </section>
  );
}
