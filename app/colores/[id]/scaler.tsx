'use client';

import { useState } from 'react';
import { PIGMENT_UNITS, pigmentPercent, scalePigments, type Pigment } from '@/lib/colors';
import { parseAR } from '@/lib/num';
import { inputClass } from '@/lib/ui';

const unitLabel = (unit: string) => PIGMENT_UNITS.find((u) => u.value === unit)?.label ?? unit;
const fmt = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });

// «¿Cuánta mezcla vas a preparar?» → cuánto de cada pigmento.
export function ColorScaler({ pigments, baseGrams }: { pigments: Pigment[]; baseGrams: number }) {
  const [target, setTarget] = useState(String(baseGrams).replace('.', ','));
  const grams = parseAR(target);
  const scaled = scalePigments(pigments, baseGrams, grams);
  return (
    <div className="grid gap-3">
      <label className="grid gap-1 text-sm font-medium">¿Cuántos gramos de mezcla vas a preparar?
        <span className="flex items-center gap-2"><input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal" className={`${inputClass} max-w-40 text-lg`} /> g</span>
      </label>
      <div className="flex flex-wrap gap-1.5">
        {[100, 250, 500, 1000].map((g) => <button key={g} type="button" onClick={() => setTarget(String(g))} className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium dark:bg-neutral-800">{g >= 1000 ? `${g / 1000} kg` : `${g} g`}</button>)}
      </div>
      {grams > 0 ? (
        <ul className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {scaled.map((p, i) => {
            const percent = pigmentPercent(pigments[i], baseGrams);
            return (
              <li key={i} className="flex items-baseline justify-between gap-3 px-4 py-3">
                <span className="font-medium">{p.name}{percent !== null && <span className="ml-1.5 text-xs font-normal text-neutral-500">({fmt(percent)} % de la mezcla)</span>}</span>
                <span className="text-xl font-bold">{fmt(p.amount)} <span className="text-sm font-medium">{unitLabel(p.unit)}</span></span>
              </li>
            );
          })}
        </ul>
      ) : <p className="text-sm text-neutral-500">Escribí una cantidad para ver cuánto pigmento poner.</p>}
    </div>
  );
}
