'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { saveCalculation, type SaveInput } from './actions';
import { compute, num, type CalcInput, type Mode, type PriceMethod } from './compute';
import { enqueue, isOffline, offlineEnabled } from '@/lib/outbox';

export type SavedMold = { id: string; name: string; measurement: number | null; unit: string | null; cost: number | null; estimatedUses: number | null };
export type SavedFormula = { id: string; name: string; versionNumber: number | null; waterPercentage: number | null };
export type SavedMaterial = { id: string; name: string; pricePerKg: number };
export type SavedProduct = { id: string; name: string; defaultFormulaId: string | null; defaultMoldId: string | null };

const WATER_REFERENCES = [70, 75, 80];
// El agua del molde se mide en peso o volumen; 1 ml de agua pesa 1 g.
const TO_GRAMS: Record<string, number> = { g: 1, kg: 1000, ml: 1, l: 1000 };

const inputClass = 'mt-1 w-full rounded-xl border border-neutral-300 bg-white p-3 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white';
const cardClass = 'mt-5 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900';
const hintClass = 'mt-1 block text-xs font-normal text-neutral-500 dark:text-neutral-400';

function money(value: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(value || 0);
}

function grams(value: number) {
  return `${value.toLocaleString('es-AR', { maximumFractionDigits: 1 })} g`;
}

// allowPersonalized: el modo Personalizado es de los planes pagos (la versión gratis tiene Fácil y Estándar).
export function Calculator({ molds, formulas, materials, products, initial, allowPersonalized = true, simple = false }: { molds: SavedMold[]; formulas: SavedFormula[]; materials: SavedMaterial[]; products: SavedProduct[]; initial?: SaveInput | null; allowPersonalized?: boolean; simple?: boolean }) {
  // Al duplicar desde el historial se arranca con los datos de ese cálculo; los vínculos que ya no existen se descartan.
  const keep = (id: string | undefined, list: { id: string }[]) => (id && list.some(item => item.id === id) ? id : '');
  // Un solo estado para los tres modos: cambiar de modo no borra lo cargado.
  const [input, setInput] = useState<CalcInput>(() => {
    const defaults: CalcInput = {
      mode: 'easy', quantity: '1', moldWater: '', plasterPerPiece: '', waterPercentage: '75', plasterPriceKg: '', waste: '0',
      moldCost: '', packaging: '', labor: '', electricity: '', gas: '', commissions: '', other: '',
      priceMethod: 'percentage', profitPercentage: '30', fixedProfit: '', manualPrice: '',
    };
    if (!initial) return defaults;
    const { mode, quantity, moldWater, plasterPerPiece, waterPercentage, plasterPriceKg, waste, moldCost, packaging, labor, electricity, gas, commissions, other, priceMethod, profitPercentage, fixedProfit, manualPrice } = { ...defaults, ...initial };
    return { mode: !allowPersonalized && mode === 'personalized' ? 'standard' : mode, quantity, moldWater, plasterPerPiece, waterPercentage, plasterPriceKg, waste, moldCost, packaging, labor, electricity, gas, commissions, other, priceMethod, profitPercentage, fixedProfit, manualPrice };
  });
  const [moldId, setMoldId] = useState(() => keep(initial?.moldId, molds));
  const [formulaId, setFormulaId] = useState(() => keep(initial?.formulaId, formulas));
  const [materialId, setMaterialId] = useState(() => keep(initial?.materialId, materials));
  const [productId, setProductId] = useState(() => keep(initial?.productId, products));
  // Con un molde guardado, el costo del molde se reparte por uso: costo ÷ usos estimados × piezas, hasta que la usuaria lo edite.
  const [moldCostAuto, setMoldCostAuto] = useState(() => Boolean(initial?.moldCostAuto && keep(initial.moldId, molds)));
  const [status, setStatus] = useState<{ ok: boolean; message: string; id?: string } | null>(null);
  const [saving, startSaving] = useTransition();
  // Modo simple: arranca en Fácil y los otros modos quedan detrás de «Más opciones».
  const [showModes, setShowModes] = useState(() => !simple || (initial?.mode ?? 'easy') !== 'easy');

  const mold = molds.find(m => m.id === moldId);
  const formula = formulas.find(f => f.id === formulaId);
  const material = materials.find(m => m.id === materialId);
  const moldPerUse = mold?.cost && mold.estimatedUses ? mold.cost / mold.estimatedUses : null;

  const effective = useMemo<CalcInput>(() => {
    const pieces = Math.max(1, Math.floor(num(input.quantity)) || 1);
    return {
      ...input,
      moldCost: moldCostAuto && moldPerUse != null ? String(moldPerUse * pieces) : input.moldCost,
      plasterPriceKg: material ? String(material.pricePerKg) : input.plasterPriceKg,
    };
  }, [input, moldCostAuto, moldPerUse, material]);
  const result = useMemo(() => compute(effective), [effective]);

  const set = (patch: Partial<CalcInput>) => { setInput(current => ({ ...current, ...patch })); setStatus(null); };
  const field = (key: keyof CalcInput) => ({ value: input[key], onChange: (e: React.ChangeEvent<HTMLInputElement>) => set({ [key]: e.target.value }) });

  function chooseMold(id: string) {
    setMoldId(id);
    setStatus(null);
    const chosen = molds.find(m => m.id === id);
    if (!chosen) { setMoldCostAuto(false); return; }
    const factor = chosen.unit ? TO_GRAMS[chosen.unit] : undefined;
    if (chosen.measurement != null && factor) set({ moldWater: String(chosen.measurement * factor), plasterPerPiece: '' });
    setMoldCostAuto(Boolean(chosen.cost && chosen.estimatedUses));
  }

  function chooseFormula(id: string) {
    setFormulaId(id);
    setStatus(null);
    const chosen = formulas.find(f => f.id === id);
    // El porcentaje de agua de la fórmula guardada tiene prioridad.
    if (chosen?.waterPercentage != null) set({ waterPercentage: String(chosen.waterPercentage) });
  }

  function chooseProduct(id: string) {
    setProductId(id);
    setStatus(null);
    // Al elegir un producto se usan su fórmula y su molde predeterminados (si están disponibles).
    const chosen = products.find(p => p.id === id);
    if (chosen?.defaultMoldId && molds.some(m => m.id === chosen.defaultMoldId)) chooseMold(chosen.defaultMoldId);
    if (chosen?.defaultFormulaId && formulas.some(f => f.id === chosen.defaultFormulaId)) chooseFormula(chosen.defaultFormulaId);
  }

  function save() {
    // Sin conexión (Mensualidad Plus): se guarda en el aparato y se sube solo al volver internet.
    if (isOffline() && offlineEnabled()) {
      void enqueue('yeso_calc', { ...effective, moldId, formulaId, materialId, productId, moldCostAuto }, 'Cálculo de Yeso')
        .then(() => setStatus({ ok: true, message: 'Sin conexión: el cálculo quedó guardado en este aparato y se sube solo cuando vuelva internet.' }))
        .catch(() => setStatus({ ok: false, message: 'No se pudo guardar en este aparato.' }));
      return;
    }
    startSaving(async () => {
      const response = await saveCalculation({ ...effective, moldId, formulaId, materialId, productId, moldCostAuto });
      setStatus(response.ok ? { ok: true, message: 'Cálculo guardado. Los precios de hoy quedan congelados en él.', id: response.id } : { ok: false, message: response.error });
    });
  }

  const showStandard = input.mode !== 'easy';
  const showPersonalized = input.mode === 'personalized';

  return (
    <>
      <header>
        <p className="text-sm font-medium text-orange-700 dark:text-orange-300">Calculadora de Yeso</p>
        <h1 className="mt-1 text-3xl font-bold">Calcular</h1>
        <p className={`mt-2 text-neutral-500 dark:text-neutral-400 ${simple ? 'text-base' : 'text-sm'}`}>{showModes ? 'Elegí un modo. Podés cambiar de modo sin perder lo que cargaste.' : 'Poné cuántas piezas, los gramos y el precio del yeso. Abajo ves cuánto cobrar.'}</p>
      </header>

      {!showModes && <button type="button" onClick={() => setShowModes(true)} className="mt-4 text-sm font-semibold text-orange-800 underline underline-offset-4 dark:text-orange-300">Más opciones (otros modos de cálculo)</button>}
      {showModes && <section className="mt-6 grid grid-cols-3 gap-2" aria-label="Modo de cálculo">
        {([['easy', 'Fácil'], ['standard', 'Estándar'], ['personalized', 'Personalizado']] as const).map(([value, label]) => (
          <button key={value} type="button" aria-pressed={input.mode === value} disabled={value === 'personalized' && !allowPersonalized} title={value === 'personalized' && !allowPersonalized ? 'Disponible con la Edición Personal' : undefined} onClick={() => set({ mode: value as Mode })} className={`rounded-xl border px-2 py-3 text-sm font-semibold ${input.mode === value ? 'border-orange-700 bg-orange-700 text-white' : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900'} disabled:cursor-not-allowed disabled:opacity-50`}>{label}{value === 'personalized' && !allowPersonalized ? ' 🔒' : ''}</button>
        ))}
      </section>}

      {(molds.length > 0 || formulas.length > 0 || products.length > 0) && (
        <section className={cardClass}>
          <h2 className="font-semibold">Usar mis datos guardados (opcional)</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {products.length > 0 && (
              <label className="text-sm font-medium sm:col-span-2">Producto
                <select value={productId} onChange={e => chooseProduct(e.target.value)} className={inputClass}>
                  <option value="">Ninguno</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {productId && <span className={hintClass}>Al guardar, este costo se usa para la rentabilidad del producto.</span>}
              </label>
            )}
            {molds.length > 0 && (
              <label className="text-sm font-medium">Molde
                <select value={moldId} onChange={e => chooseMold(e.target.value)} className={inputClass}>
                  <option value="">Ninguno</option>
                  {molds.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                {mold && <span className={hintClass}>Completa el agua del molde{moldPerUse != null ? ` y el costo del molde (${money(moldPerUse)} por uso)` : ''}.</span>}
              </label>
            )}
            {formulas.length > 0 && (
              <label className="text-sm font-medium">Fórmula
                <select value={formulaId} onChange={e => chooseFormula(e.target.value)} className={inputClass}>
                  <option value="">Ninguna</option>
                  {formulas.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                {formula && <span className={hintClass}>{formula.waterPercentage != null ? `Usa el ${formula.waterPercentage} % de agua de la versión ${formula.versionNumber}.` : 'Esta fórmula no tiene % de agua cargado.'}</span>}
              </label>
            )}
          </div>
        </section>
      )}

      <section className={cardClass}>
        <h2 className="font-semibold">1. Cantidad y yeso</h2>
        {input.mode === 'easy' && <div className="mt-4 rounded-2xl bg-orange-50 p-4 text-sm text-neutral-900 dark:bg-orange-950/30 dark:text-neutral-100"><strong>¿No sabés cuánto yeso lleva el molde?</strong><p className="mt-1">Llená el molde con agua y pesala. Esos gramos se toman como los gramos de yeso por pieza.</p></div>}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">Cantidad de piezas<input {...field('quantity')} type="number" min="1" step="1" className={inputClass} /></label>
          <label className="text-sm font-medium">Agua que entra en el molde (g)<input {...field('moldWater')} type="number" min="0" step="any" className={inputClass} /></label>
          {showStandard && <label className="text-sm font-medium">Yeso por pieza (g)<input {...field('plasterPerPiece')} type="number" min="0" step="any" placeholder={result.plaster ? String(result.plaster) : 'Igual al agua del molde'} className={inputClass} /><span className={hintClass}>Si lo dejás vacío, se usa el agua del molde.</span></label>}
          <label className="text-sm font-medium">% de agua<input {...field('waterPercentage')} type="number" min="0" step="any" className={inputClass} /></label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">{WATER_REFERENCES.map(value => <button type="button" key={value} onClick={() => set({ waterPercentage: String(value) })} className="rounded-full border border-neutral-300 px-3 py-1 text-xs dark:border-neutral-700">Usar {value} %</button>)}</div>
        <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">70 %, 75 % y 80 % son referencias iniciales, no reglas universales. Si elegís una fórmula guardada, se usa su porcentaje.</p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-neutral-50 p-3 dark:bg-neutral-950"><span className="text-neutral-500 dark:text-neutral-400">Yeso total</span><strong className="mt-1 block">{grams(result.plasterTotal + result.wasteAmount)}</strong>{result.wasteAmount > 0 && <span className="text-xs text-neutral-500 dark:text-neutral-400">incluye {grams(result.wasteAmount)} de merma</span>}</div>
          <div className="rounded-2xl bg-neutral-50 p-3 dark:bg-neutral-950"><span className="text-neutral-500 dark:text-neutral-400">Agua total</span><strong className="mt-1 block">{grams(result.waterTotal)}</strong></div>
        </div>
      </section>

      <section className={cardClass}>
        <h2 className="font-semibold">2. Costos</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {materials.length > 0 && (
            <label className="text-sm font-medium">Yeso de mis materiales
              <select value={materialId} onChange={e => { setMaterialId(e.target.value); setStatus(null); }} className={inputClass}>
                <option value="">Cargar el precio a mano</option>
                {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
          )}
          <label className="text-sm font-medium">Precio del yeso por kg
            <input value={material ? String(Math.round(material.pricePerKg * 100) / 100) : input.plasterPriceKg} onChange={e => set({ plasterPriceKg: e.target.value })} readOnly={Boolean(material)} type="number" min="0" step="any" className={`${inputClass} ${material ? 'opacity-70' : ''}`} />
            {material && <span className={hintClass}>Precio actual de {material.name}.</span>}
          </label>
          <label className="text-sm font-medium">Merma (%)<input {...field('waste')} type="number" min="0" step="any" className={inputClass} /><span className={hintClass}>Yeso que se pierde al preparar la mezcla.</span></label>
          {showStandard && (
            <label className="text-sm font-medium">Molde (para esta tanda)
              <input value={moldCostAuto && moldPerUse != null ? String(Math.round(moldPerUse * result.pieces * 100) / 100) : input.moldCost} onChange={e => { setMoldCostAuto(false); set({ moldCost: e.target.value }); }} type="number" min="0" step="any" className={inputClass} />
              {moldCostAuto && moldPerUse != null && <span className={hintClass}>{money(moldPerUse)} por uso × {result.pieces} piezas.</span>}
            </label>
          )}
          {showStandard && <label className="text-sm font-medium">Packaging (para esta tanda)<input {...field('packaging')} type="number" min="0" step="any" className={inputClass} /></label>}
          {showPersonalized && <>
            <label className="text-sm font-medium">Mano de obra<input {...field('labor')} type="number" min="0" step="any" className={inputClass} /></label>
            <label className="text-sm font-medium">Electricidad<input {...field('electricity')} type="number" min="0" step="any" className={inputClass} /></label>
            <label className="text-sm font-medium">Gas<input {...field('gas')} type="number" min="0" step="any" className={inputClass} /></label>
            <label className="text-sm font-medium">Comisiones<input {...field('commissions')} type="number" min="0" step="any" className={inputClass} /></label>
            <label className="text-sm font-medium">Otros<input {...field('other')} type="number" min="0" step="any" className={inputClass} /></label>
          </>}
        </div>
        {input.mode !== 'personalized' && <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">Los costos de otros modos se conservan, pero solo suman los del modo elegido.</p>}
      </section>

      <section className={cardClass}>
        <h2 className="font-semibold">3. Precio</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">{([['percentage', '% de ganancia'], ['fixed', 'Ganancia fija'], ['manual', 'Precio manual']] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={input.priceMethod === value} onClick={() => set({ priceMethod: value as PriceMethod })} className={`rounded-xl border p-3 text-sm font-medium ${input.priceMethod === value ? 'border-orange-700 bg-orange-50 text-neutral-900 dark:bg-orange-950/30 dark:text-white' : 'border-neutral-300 dark:border-neutral-700'}`}>{label}</button>)}</div>
        <div className="mt-4">
          {input.priceMethod === 'percentage' && <label className="text-sm font-medium">Ganancia sobre el costo (%)<input {...field('profitPercentage')} type="number" min="0" step="any" className={inputClass} /></label>}
          {input.priceMethod === 'fixed' && <label className="text-sm font-medium">Ganancia fija por pieza<input {...field('fixedProfit')} type="number" min="0" step="any" className={inputClass} /></label>}
          {input.priceMethod === 'manual' && <label className="text-sm font-medium">Precio por pieza<input {...field('manualPrice')} type="number" min="0" step="any" className={inputClass} /></label>}
        </div>
      </section>

      <section className="mt-5 rounded-3xl bg-neutral-950 p-5 text-white dark:bg-white dark:text-neutral-950" aria-live="polite">
        <p className="text-sm opacity-70">Resultado</p>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div><span className="opacity-60">Costo total</span><strong className="mt-1 block text-xl" data-testid="total-cost">{money(result.totalCost)}</strong></div>
          <div><span className="opacity-60">Costo unitario</span><strong className="mt-1 block text-xl" data-testid="unit-cost">{money(result.unitCost)}</strong></div>
          <div><span className="opacity-60">Precio sugerido</span><strong className="mt-1 block text-xl" data-testid="price">{money(result.price)}</strong></div>
          <div><span className="opacity-60">Ganancia por unidad</span><strong className="mt-1 block text-xl" data-testid="profit">{money(result.profit)}</strong></div>
        </div>
        <div className="mt-4 rounded-2xl bg-white/10 p-3 text-sm dark:bg-black/10">Margen: <strong data-testid="margin">{result.margin.toLocaleString('es-AR', { maximumFractionDigits: 1 })} %</strong>. El precio sugerido es una referencia: vos decidís el precio final.</div>
        <button type="button" onClick={save} disabled={saving} className="mt-4 min-h-11 w-full rounded-xl bg-orange-500 px-4 font-semibold text-white disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar cálculo'}</button>
        {status && <p role={status.ok ? 'status' : 'alert'} className={`mt-3 rounded-xl p-3 text-sm ${status.ok ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>{status.message}{status.id && <> <Link href={`/historial/${status.id}`} className="underline">Ver en el historial</Link></>}</p>}
        {status?.ok && <Link href="/ventas/nueva" className="mt-3 flex min-h-11 items-center justify-center rounded-xl bg-white/15 px-4 font-semibold dark:bg-black/10">¿Ya lo vendiste? Registrá la venta →</Link>}
      </section>
    </>
  );
}
