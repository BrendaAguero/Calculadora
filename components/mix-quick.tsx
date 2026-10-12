'use client';

import { parseAR } from '@/lib/num';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { computeMix, type MixSettings } from '@/lib/mixes';
import { MoldVolume } from '@/components/mold-volume';
import { mixSteps, yesoSteps } from '@/lib/mix-steps';

export type QuickOption = { code: string; name: string; href: string; settings: MixSettings | null; waterPercentage?: number };

const n = (value: string) => { const v = parseAR(String(value)); return Number.isFinite(v) && v > 0 ? v : 0; };
const fmt = (value: number, unit: string) => `${value.toLocaleString('es-AR', { maximumFractionDigits: value < 10 ? 1 : 0 })} ${unit}`;
const input = 'w-full rounded-xl border border-white/30 bg-white/10 px-3 py-2.5 text-lg text-white placeholder:text-white/50 focus:border-white focus:outline-none';

// Lo principal de la calculadora: cuánto material y cuánto líquido (agua, endurecedor…) preparar.
export function MixQuick({ options }: { options: QuickOption[] }) {
  const [code, setCode] = useState(options[0]?.code ?? 'YESO');
  const [pieces, setPieces] = useState('1');
  const [water, setWater] = useState('');
  const [yesoPct, setYesoPct] = useState(String(options.find((o) => o.code === 'YESO')?.waterPercentage ?? 75));
  const [partsOverride, setPartsOverride] = useState<Record<string, Record<string, string>>>({});
  const base = options.find((o) => o.code === code) ?? options[0];
  // La proporción se puede cambiar acá mismo (solo para este cálculo).
  const option = useMemo(() => (base?.settings ? { ...base, settings: { ...base.settings, components: base.settings.components.map((c) => ({ ...c, parts: n(partsOverride[base.code]?.[c.key] ?? '') || c.parts })) } } : base), [base, partsOverride]);
  const setPart = (key: string, value: string) => setPartsOverride({ ...partsOverride, [code]: { ...partsOverride[code], [key]: value } });
  const qty = Math.max(1, Math.floor(n(pieces)) || 1);

  // Cada fila: qué poner y cuánto.
  const rows = useMemo(() => {
    if (!option || !n(water)) return [];
    if (!option.settings) {
      // Yeso: el agua que entra en el molde se toma como los gramos de yeso por pieza (igual que en Calcular).
      const plaster = n(water) * qty;
      return [{ label: 'Yeso', value: fmt(plaster, 'g') }, { label: 'Agua', value: fmt(plaster * n(yesoPct) / 100, 'ml') }];
    }
    const s = option.settings;
    const r = computeMix(s, { quantity: String(qty), moldMl: String(n(water)), gramsPerPiece: '', moldCost: '', packaging: '', labor: '', other: '', priceMethod: 'manual', profitPercentage: '', fixedProfit: '', manualPrice: '' });
    const list = r.amounts.map((a) => ({ label: a.label, value: s.byVolume ? fmt(a.ml, 'ml') : a.key === 'agua' ? fmt(a.grams, 'ml') : fmt(a.grams, 'g') }));
    if (r.pigment > 0) list.push({ label: 'Pigmento', value: fmt(r.pigment, 'g') });
    return list;
  }, [option, water, qty, yesoPct]);

  if (!option) return null;
  const mix = option.settings;
  const note = mix ? `Con tu receta: ${mix.components.map((c) => `${c.parts} ${c.label.toLowerCase()}`).join(' : ')}${mix.wastePercent ? `, ${mix.wastePercent} % de merma` : ''}.` : null;

  return (
    <section aria-labelledby="cuanto-preparo" className="terrazo mt-5 rounded-4xl bg-orange-800 p-5 text-white dark:bg-orange-900 lg:p-6">
      <h2 id="cuanto-preparo" className="text-2xl">¿Cuánto preparo?</h2>
      {options.length > 1 && (
        <div role="tablist" aria-label="Material" className="mt-3 flex flex-wrap gap-2">
          {options.map((o) => (
            <button key={o.code} role="tab" type="button" aria-selected={o.code === code} onClick={() => setCode(o.code)}
              className={`rounded-full px-4 py-2 font-semibold ${o.code === code ? 'bg-resina text-resina-dark' : 'bg-white/15 hover:bg-white/25'}`}>{o.name}</button>
          ))}
        </div>
      )}
      <div className="mt-4"><MoldVolume value={water} onChange={setWater} dark inputClass={input} /></div>
      <div className="mt-3 grid grid-cols-2 items-end gap-3">
        <label className="grid gap-1 text-sm font-medium text-white/85">¿Cuántas piezas?<input value={pieces} onChange={(e) => setPieces(e.target.value)} inputMode="numeric" className={input} /></label>
        {mix && (
          <div className="col-span-2 grid gap-1 text-sm font-medium text-white/85">Proporción {mix.byVolume ? 'por volumen' : 'por peso'} (la de tu marca)
            <div className="flex flex-wrap items-center gap-2">
              {mix.components.map((c, i) => (
                <span key={c.key} className="flex items-center gap-2">{i > 0 && <span className="text-xl">:</span>}
                  <input value={partsOverride[code]?.[c.key] ?? String(c.parts).replace('.', ',')} onChange={(e) => setPart(c.key, e.target.value)} inputMode="decimal" aria-label={`Partes de ${c.label}`} className={input.replace('w-full', 'w-16')} />
                </span>
              ))}
              <span className="text-xs text-white/75">{mix.components.map((c) => c.label.toLowerCase()).join(' : ')}</span>
            </div>
          </div>
        )}
        {!mix && <label className="col-span-2 grid gap-1 text-sm font-medium text-white/85">% de agua<span className="flex flex-wrap items-center gap-2"><input value={yesoPct} onChange={(e) => setYesoPct(e.target.value)} inputMode="decimal" className={input.replace('w-full', 'w-24')} />{['70', '75', '80'].map((v) => <button key={v} type="button" onClick={() => setYesoPct(v)} className="rounded-full bg-white/15 px-3 py-1 text-sm">{v} %</button>)}</span></label>}
      </div>

      {rows.length > 0 && (
        <div className="mt-4 rounded-3xl bg-white p-4 text-neutral-900 dark:bg-neutral-950 dark:text-white">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Prepará{qty > 1 ? ` para ${qty} piezas` : ''}:</p>
          <ul className="mt-2 grid gap-2">
            {rows.map((r) => (
              <li key={r.label} className="flex items-baseline justify-between gap-3 rounded-2xl bg-orange-50 px-4 py-3 dark:bg-orange-950/40">
                <span className="min-w-0 text-base sm:text-lg">{r.label}</span><strong className="shrink-0 font-display text-2xl sm:text-3xl">{r.value}</strong>
              </li>
            ))}
          </ul>
          <details open className="mt-3 text-sm">
            <summary className="cursor-pointer font-semibold">¿Cómo se calcula?</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-neutral-700 dark:text-neutral-300">
              {(mix ? mixSteps(option.name, mix, n(water), qty) : yesoSteps(n(water), qty, n(yesoPct))).map((line) => <li key={line}>{line}</li>)}
            </ol>
          </details>
          {note && <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">{note} La cambiás en Calcular → Mi receta.</p>}
        </div>
      )}

      <Link href={option.href} className="mt-4 flex items-center justify-between rounded-2xl bg-white/15 px-4 py-3 font-semibold hover:bg-white/25">
        Calcular también cuánto cobrar<ChevronRight size={20} aria-hidden="true" />
      </Link>
    </section>
  );
}
