'use client';

import { parseAR } from '@/lib/num';
import { useState } from 'react';

type Item = { label: string; quantity: number; unit: string };

function format(value: number) {
  return value.toLocaleString('es-AR', { maximumFractionDigits: 2 });
}

// Escalado normal: multiplica cada ingrediente por (piezas deseadas / rendimiento de la versión).
export function Scaler({ yieldQuantity, items }: { yieldQuantity: number; items: Item[] }) {
  const [pieces, setPieces] = useState(String(yieldQuantity));
  const target = parseAR(pieces);
  const factor = target > 0 && yieldQuantity > 0 ? target / yieldQuantity : null;

  if (!items.length) return null;
  return (
    <section className="rounded-3xl bg-white p-5 dark:bg-neutral-900">
      <h2 className="font-semibold">Escalar receta</h2>
      <label className="mt-3 grid gap-1 text-sm">¿Cuántas piezas querés hacer?
        <input type="number" min="0" step="any" value={pieces} onChange={e => setPieces(e.target.value)} className="w-40 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white" />
      </label>
      {factor === null
        ? <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">Escribí una cantidad mayor que 0.</p>
        : <ul className="mt-3 grid gap-1 text-sm">{items.map((item, i) => <li key={i} className="flex justify-between gap-4 border-b border-neutral-100 py-1 dark:border-neutral-800"><span>{item.label}</span><span className="font-medium">{format(item.quantity * factor)} {item.unit}</span></li>)}</ul>}
    </section>
  );
}
