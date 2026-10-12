'use client';

import Link from 'next/link';
import { PriceExtras } from '@/components/price-extras';
import { useMemo, useState, useTransition } from 'react';
import { RotateCcw, Save, SlidersHorizontal } from 'lucide-react';
import { computeMix, mixByCode, type MixCode, type MixInput, type MixSettings, type PriceMethod } from '@/lib/mixes';
import { resetMixSettings, saveMixCalculation, saveMixSettings } from '../mix-actions';
import { enqueue, isOffline, offlineEnabled } from '@/lib/outbox';
import { MoldVolume } from '@/components/mold-volume';
import { mixSteps } from '@/lib/mix-steps';

const inputClass = 'mt-1.5 w-full rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-neutral-900 focus:border-orange-600 focus:bg-white dark:border-neutral-700 dark:bg-neutral-950 dark:text-white';
const cardClass = 'mt-4 rounded-3xl bg-white p-5 dark:bg-neutral-900';
const hintClass = 'mt-1 block text-xs font-normal text-neutral-500 dark:text-neutral-400';
const money = (value: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(value || 0);
const fmt = (value: number, unit: string) => `${value.toLocaleString('es-AR', { maximumFractionDigits: value < 10 ? 1 : 0 })} ${unit}`;

const EMPTY: MixInput = { quantity: '1', moldMl: '', gramsPerPiece: '', moldCost: '', packaging: '', labor: '', other: '', priceMethod: 'percentage', profitPercentage: '30', fixedProfit: '', manualPrice: '' };

export function MixCalculator({ code, initialSettings, hasSaved }: { code: MixCode; initialSettings: MixSettings; hasSaved: boolean }) {
  const def = mixByCode(code)!;
  const [settings, setSettings] = useState<MixSettings>(initialSettings);
  const [input, setInput] = useState<MixInput>(EMPTY);
  const [editing, setEditing] = useState(!hasSaved);
  const [status, setStatus] = useState<{ ok: boolean; message: string; id?: string } | null>(null);
  const [settingsStatus, setSettingsStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const result = useMemo(() => computeMix(settings, input), [settings, input]);

  const set = (patch: Partial<MixInput>) => { setInput(c => ({ ...c, ...patch })); setStatus(null); };
  const field = (key: keyof MixInput) => ({ value: input[key], onChange: (e: React.ChangeEvent<HTMLInputElement>) => set({ [key]: e.target.value }) });
  const setS = (patch: Partial<MixSettings>) => { setSettings(c => ({ ...c, ...patch })); setSettingsStatus(null); };
  const setPart = (key: string, value: string) => setS({ components: settings.components.map(c => c.key === key ? { ...c, parts: Number(value.replace(',', '.')) || 0 } : c) });
  const setPrice = (key: string, value: string) => setS({ prices: { ...settings.prices, [key]: value } });
  const ratio = settings.components.map(c => c.parts.toLocaleString('es-AR', { maximumFractionDigits: 2 })).join(' : ');

  const saveSettings = () => isOffline() ? setSettingsStatus({ ok: false, message: 'Necesitás internet para guardar tus valores. Mientras tanto, los cambios valen para este cálculo.' }) : start(async () => {
    const r = await saveMixSettings(code, settings);
    setSettingsStatus(r.ok ? { ok: true, message: 'Listo: la próxima vez arranca con tus valores.' } : { ok: false, message: r.error });
  });
  const reset = () => start(async () => {
    const defaults = { ...def.defaults, prices: settings.prices };
    setSettings(defaults);
    const r = await resetMixSettings(code, settings.prices);
    setSettingsStatus(r.ok ? { ok: true, message: 'Volviste a los valores de fábrica (tus precios se mantienen).' } : { ok: false, message: r.error });
  });
  const saveCalc = () => {
    if (isOffline() && offlineEnabled()) {
      void enqueue('mix_calc', { code, settings, input }, `Cálculo de ${def.name}`)
        .then(() => setStatus({ ok: true, message: 'Sin conexión: el cálculo quedó guardado en este aparato y se sube solo cuando vuelva internet.' }))
        .catch(() => setStatus({ ok: false, message: 'No se pudo guardar en este aparato.' }));
      return;
    }
    saveCalcOnline();
  };
  const saveCalcOnline = () => start(async () => {
    const r = await saveMixCalculation(code, settings, input);
    setStatus(r.ok ? { ok: true, message: 'Cálculo guardado. Los precios de hoy quedan congelados en él.', id: r.id } : { ok: false, message: r.error });
  });

  return (
    <>
      <header>
        <p className="text-sm font-medium text-orange-700 dark:text-orange-300">Calculadora de {def.name}</p>
        <h1 className="mt-1 text-3xl">Calcular</h1>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">{def.intro}</p>
      </header>

      <section className={cardClass}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg">Mi receta</h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">Proporción {ratio}{settings.byVolume ? ' (por volumen)' : ' (por peso)'} · pigmento {settings.pigmentPercent} % · merma {settings.wastePercent} %</p>
          </div>
          <button type="button" onClick={() => setEditing(e => !e)} aria-expanded={editing} className="flex shrink-0 items-center gap-1.5 rounded-xl border border-neutral-300 px-3 py-2 text-sm font-semibold dark:border-neutral-700"><SlidersHorizontal size={16} aria-hidden="true" />{editing ? 'Cerrar' : 'Ajustar'}</button>
        </div>
        {editing && (
          <div className="mt-4 border-t border-neutral-100 pt-4 dark:border-neutral-800">
            <p className="text-sm text-neutral-600 dark:text-neutral-300">{def.ratioHint}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {settings.components.map(c => (
                <label key={c.key} className="text-sm font-medium">{c.label} (partes)<input type="number" min="0" step="any" value={c.parts || ''} onChange={e => setPart(c.key, e.target.value)} className={inputClass} /></label>
              ))}
              <label className="text-sm font-medium">Pigmento (%)<input type="number" min="0" step="any" value={settings.pigmentPercent} onChange={e => setS({ pigmentPercent: Number(e.target.value) || 0 })} className={inputClass} /><span className={hintClass}>Sobre el peso total de la mezcla.</span></label>
              <label className="text-sm font-medium">Merma (%)<input type="number" min="0" step="any" value={settings.wastePercent} onChange={e => setS({ wastePercent: Number(e.target.value) || 0 })} className={inputClass} /><span className={hintClass}>Lo que queda en el vaso y los utensilios.</span></label>
              <label className="text-sm font-medium">Densidad (g por ml)<input type="number" min="0" step="any" value={settings.density} onChange={e => setS({ density: Number(e.target.value) || 0 })} className={inputClass} /><span className={hintClass}>Cuántos gramos pesa 1 ml de mezcla (el agua pesa 1). Sirve para pasar del tamaño del molde a gramos.</span></label>
            </div>
            <Calibrate onUse={(density) => { setS({ density }); setSettingsStatus({ ok: true, message: `Listo: ahora cada ml de mezcla pesa ${density.toLocaleString('es-AR')} g. Tocá «Guardar como mis valores» para que quede guardado.` }); }} />
            {code === 'RESINA' && (
              <label className="mt-3 flex items-center gap-3 text-sm"><input type="checkbox" checked={settings.byVolume} onChange={e => setS({ byVolume: e.target.checked })} className="h-5 w-5 accent-orange-800" />Mi marca indica la proporción por volumen (ml), no por peso</label>
            )}
            <h3 className="mt-5 font-semibold">Precios por kg</h3>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              {settings.components.filter(c => c.priced).map(c => (
                <label key={c.key} className="text-sm font-medium">{c.label}<input type="number" min="0" step="any" value={settings.prices[c.key] ?? ''} onChange={e => setPrice(c.key, e.target.value)} className={inputClass} placeholder="$ por kg" /></label>
              ))}
              <label className="text-sm font-medium">Pigmento<input type="number" min="0" step="any" value={settings.prices.pigment ?? ''} onChange={e => setPrice('pigment', e.target.value)} className={inputClass} placeholder="$ por kg" /></label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={saveSettings} disabled={pending} className="flex items-center gap-2 rounded-xl bg-orange-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><Save size={16} aria-hidden="true" />Guardar como mis valores</button>
              <button type="button" onClick={reset} disabled={pending} className="flex items-center gap-2 rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-semibold dark:border-neutral-700"><RotateCcw size={16} aria-hidden="true" />Valores de fábrica</button>
            </div>
            {settingsStatus && <p role={settingsStatus.ok ? 'status' : 'alert'} className={`mt-3 text-sm ${settingsStatus.ok ? 'text-orange-800 dark:text-orange-300' : 'text-red-700 dark:text-red-300'}`}>{settingsStatus.message}</p>}
          </div>
        )}
      </section>

      <section className={cardClass}>
        <h2 className="text-lg">1. ¿Cuánto preparo?</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="text-sm font-medium">Cantidad de piezas<input {...field('quantity')} type="number" min="1" step="1" className={inputClass} /></label>
          <div className="sm:col-span-3"><MoldVolume value={input.moldMl} onChange={(ml) => set({ moldMl: ml })} inputClass={inputClass} /></div>
          <label className="text-sm font-medium">O gramos por pieza<input {...field('gramsPerPiece')} type="number" min="0" step="any" className={inputClass} placeholder={result.perPiece ? fmt(result.perPiece, 'g') : 'Si ya lo sabés'} /><span className={hintClass}>Si ya sabés cuántos gramos de mezcla lleva cada pieza. Si no, se calcula con el tamaño del molde.</span></label>
        </div>
        {result.total > 0 && (
          <div className="mt-4 rounded-2xl bg-orange-50 p-4 dark:bg-orange-950/40">
            <p className="text-sm text-neutral-600 dark:text-neutral-300">Prepará <strong className="text-neutral-900 dark:text-white">{fmt(result.total, 'g')}</strong> de mezcla{result.waste > 0 ? ` (incluye ${fmt(result.waste, 'g')} de merma)` : ''}:</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {result.amounts.map(a => (
                <li key={a.key} className="flex items-baseline justify-between rounded-xl bg-white px-4 py-3 dark:bg-neutral-900"><span>{a.label}</span><strong className="font-display text-2xl">{settings.byVolume ? fmt(a.ml, 'ml') : a.key === 'agua' ? fmt(a.grams, 'ml') : fmt(a.grams, 'g')}</strong></li>
              ))}
              {result.pigment > 0 && <li className="flex items-baseline justify-between rounded-xl bg-white px-4 py-3 dark:bg-neutral-900"><span>Pigmento</span><strong className="font-display text-2xl">{fmt(result.pigment, 'g')}</strong></li>}
            </ul>
            {!Number(input.gramsPerPiece) && (
              <details open className="mt-3 text-sm">
                <summary className="cursor-pointer font-semibold">¿Cómo se calcula?</summary>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-neutral-700 dark:text-neutral-300">{mixSteps(def.name, settings, Number(input.moldMl) || 0, result.pieces).map(line => <li key={line}>{line}</li>)}</ol>
              </details>
            )}
          </div>
        )}
      </section>

      <section className={cardClass}>
        <h2 className="text-lg">2. Otros costos de la tanda</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">Molde<input {...field('moldCost')} type="number" min="0" step="any" className={inputClass} /></label>
          <label className="text-sm font-medium">Packaging<input {...field('packaging')} type="number" min="0" step="any" className={inputClass} /></label>
          <label className="text-sm font-medium">Mano de obra<input {...field('labor')} type="number" min="0" step="any" className={inputClass} /></label>
          <label className="text-sm font-medium">Otros<input {...field('other')} type="number" min="0" step="any" className={inputClass} /></label>
        </div>
        {!Object.values(settings.prices).some(Boolean) && <p className="mt-3 text-sm text-amber-800 dark:text-amber-200">Cargá los precios por kg en «Mi receta → Ajustar» para que el costo incluya los materiales.</p>}
      </section>

      <section className={cardClass}>
        <h2 className="text-lg">3. Precio</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">{([['percentage', '% de ganancia'], ['fixed', 'Ganancia fija'], ['manual', 'Precio manual']] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={input.priceMethod === value} onClick={() => set({ priceMethod: value as PriceMethod })} className={`rounded-xl border p-3 text-sm font-semibold ${input.priceMethod === value ? 'border-orange-700 bg-orange-50 dark:bg-orange-950/40' : 'border-neutral-200 dark:border-neutral-700'}`}>{label}</button>)}</div>
        <div className="mt-3">
          {input.priceMethod === 'percentage' && <label className="text-sm font-medium">Ganancia sobre el costo (%)<input {...field('profitPercentage')} type="number" min="0" step="any" className={inputClass} /></label>}
          {input.priceMethod === 'fixed' && <label className="text-sm font-medium">Ganancia fija por pieza<input {...field('fixedProfit')} type="number" min="0" step="any" className={inputClass} /></label>}
          {input.priceMethod === 'manual' && <label className="text-sm font-medium">Precio por pieza<input {...field('manualPrice')} type="number" min="0" step="any" className={inputClass} /></label>}
        </div>
      </section>

      <section className="terrazo-borde mt-4 rounded-4xl bg-orange-800 p-6 text-white dark:bg-orange-900" aria-live="polite">
        <p className="text-sm text-white/75">Precio sugerido por pieza</p>
        <p className="mt-1 font-display text-5xl font-bold tracking-tight">{money(result.price)}</p>
        <dl className="mt-5 grid grid-cols-2 gap-4 text-sm text-white/75 sm:grid-cols-4">
          <div><dt>Costo total</dt><dd className="font-display text-lg font-bold text-white">{money(result.totalCost)}</dd></div>
          <div><dt>Costo por pieza</dt><dd className="font-display text-lg font-bold text-white">{money(result.unitCost)}</dd></div>
          <div><dt>Ganancia por pieza</dt><dd className="font-display text-lg font-bold text-white">{money(result.profit)}</dd></div>
          <div><dt>Margen</dt><dd className="font-display text-lg font-bold text-white">{result.margin.toLocaleString('es-AR', { maximumFractionDigits: 1 })} %</dd></div>
        </dl>
        <PriceExtras price={result.price} unitCost={result.unitCost} />
        <p className="mt-4 text-xs text-white/70">El precio sugerido es una referencia: vos decidís el precio final.</p>
        <button type="button" onClick={saveCalc} disabled={pending} className="mt-4 min-h-12 w-full rounded-2xl bg-resina px-4 font-bold text-resina-dark disabled:opacity-60">{pending ? 'Guardando…' : 'Guardar cálculo'}</button>
        {status && <p role={status.ok ? 'status' : 'alert'} className="mt-3 rounded-xl bg-white/15 p-3 text-sm">{status.message}{status.id && <> <Link href={`/historial/${status.id}`} className="underline">Ver en el historial</Link></>}</p>}
        {status?.ok && <Link href="/ventas/nueva" className="mt-3 flex min-h-11 items-center justify-center rounded-xl bg-white/15 px-4 font-semibold">¿Ya lo vendiste? Registrá la venta →</Link>}
      </section>
    </>
  );
}

// «Ajustar con una pieza real»: con los ml del molde y lo que pesa la pieza terminada, la app calcula
// cuánto pesa cada ml de mezcla (la densidad) para que las cantidades den justo.
function Calibrate({ onUse }: { onUse: (density: number) => void }) {
  const [ml, setMl] = useState('');
  const [grams, setGrams] = useState('');
  const density = (Number(grams.replace(',', '.')) || 0) / (Number(ml.replace(',', '.')) || 0);
  const ok = Number.isFinite(density) && density > 0.3 && density < 5;
  return (
    <div className="mt-4 rounded-2xl bg-orange-50 p-4 dark:bg-orange-950/40">
      <p className="font-semibold">¿Te sobra o te falta mezcla? Ajustalo con una pieza real</p>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">Pesá una pieza ya hecha y escribí cuánta agua entra en su molde. La app corrige sola cuánto pesa cada ml de mezcla.</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="text-sm font-medium">Agua que entra en el molde (ml)<input value={ml} onChange={e => setMl(e.target.value)} inputMode="decimal" className={inputClass} /></label>
        <label className="text-sm font-medium">Peso de la pieza terminada (g)<input value={grams} onChange={e => setGrams(e.target.value)} inputMode="decimal" className={inputClass} /></label>
      </div>
      {ok && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-sm">Cada ml de tu mezcla pesa <strong>{density.toLocaleString('es-AR', { maximumFractionDigits: 2 })} g</strong>.</p>
          <button type="button" onClick={() => onUse(Math.round(density * 100) / 100)} className="rounded-xl bg-orange-800 px-4 py-2 text-sm font-semibold text-white">Usar este valor</button>
        </div>
      )}
      {!ok && Number(ml) > 0 && Number(grams) > 0 && <p className="mt-3 text-sm text-red-700 dark:text-red-300">Esos números no parecen bien: revisá los ml y los gramos.</p>}
    </div>
  );
}
