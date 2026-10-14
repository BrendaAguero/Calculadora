'use client';

import { parseAR } from '@/lib/num';
import { useState } from 'react';
import { ArrowDownUp, Calculator, Clock, Package, Scale, Store, Weight } from 'lucide-react';
import { QuickCalc } from '@/components/quick-calc';
import { MEASURE_MATERIALS, MEASURE_UNITS, convertMeasure, hourlyFromMonthly, kitPrice, laborPerPiece, marketplacePrice, piecesFrom, type MeasureUnit } from '@/lib/tools';
import { roundPrice } from '@/lib/pricing';
import { cardClass, inputClass } from '@/lib/ui';

const n = (value: string) => { const v = parseAR(String(value)); return Number.isFinite(v) ? v : 0; };
const money = (value: number) => value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const label = 'grid gap-1 text-sm font-medium';
const result = 'mt-4 rounded-2xl bg-orange-800 p-4 text-white dark:bg-orange-900';

const TABS = [
  { key: 'precio', label: 'Precio rápido', icon: Calculator },
  { key: 'online', label: 'Vender online', icon: Store },
  { key: 'piezas', label: '¿Cuántas salen?', icon: Weight },
  { key: 'kit', label: 'Kits y combos', icon: Package },
  { key: 'tiempo', label: 'Tu tiempo', icon: Clock },
  { key: 'medidas', label: 'Medidas', icon: Scale },
] as const;

export function Tools({ net: initialNet, cost: initialCost }: { net: string; cost: string }) {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>(initialNet ? 'online' : initialCost ? 'kit' : 'precio');
  return (
    <div className="mt-5">
      <div role="tablist" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {TABS.map(({ key, label: text, icon: Icon }) => (
          <button key={key} role="tab" type="button" aria-selected={tab === key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 rounded-2xl px-3 py-3 text-left text-sm font-semibold ${tab === key ? 'bg-orange-800 text-white dark:bg-orange-600' : 'bg-white dark:bg-neutral-900'}`}>
            <Icon size={18} aria-hidden="true" />{text}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {tab === 'precio' && <QuickCalc />}
        {tab === 'online' && <Online initialNet={initialNet} />}
        {tab === 'piezas' && <Pieces />}
        {tab === 'kit' && <Kit initialCost={initialCost} />}
        {tab === 'tiempo' && <Time />}
        {tab === 'medidas' && <Measures />}
      </div>
    </div>
  );
}

function Online({ initialNet }: { initialNet: string }) {
  const [net, setNet] = useState(initialNet);
  const [fee, setFee] = useState('15');
  const [fixed, setFixed] = useState('');
  const [shipping, setShipping] = useState('');
  const price = marketplacePrice(n(net), n(fee), n(fixed), n(shipping));
  const rounded = roundPrice(price, 100);
  return (
    <section className={cardClass}>
      <h2 className="text-lg font-semibold">Precio para publicar en Mercado Libre, Tiendanube u otra tienda</h2>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Poné cuánto querés recibir por la pieza y te decimos a cuánto publicarla para que la comisión no te coma la ganancia.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className={label}>Querés recibir ($)<input value={net} onChange={(e) => setNet(e.target.value)} inputMode="decimal" placeholder="Ej.: 5000" className={inputClass} /></label>
        <label className={label}>Comisión de la tienda (%)<input value={fee} onChange={(e) => setFee(e.target.value)} inputMode="decimal" className={inputClass} />
          <span className="flex flex-wrap gap-1.5 text-xs font-normal">{['10', '13', '15', '18', '20'].map((v) => <button key={v} type="button" onClick={() => setFee(v)} className="rounded-full bg-neutral-100 px-2 py-0.5 dark:bg-neutral-800">{v} %</button>)}</span></label>
        <label className={label}>Cargo fijo por venta ($, si hay)<input value={fixed} onChange={(e) => setFixed(e.target.value)} inputMode="decimal" placeholder="0" className={inputClass} /></label>
        <label className={label}>Envío que pagás vos ($)<input value={shipping} onChange={(e) => setShipping(e.target.value)} inputMode="decimal" placeholder="0" className={inputClass} /></label>
      </div>
      <p className="mt-2 text-xs text-neutral-500">La comisión cambia según la tienda, la categoría y el tipo de publicación: revisá la tuya y escribila arriba.</p>
      {price > 0 && (
        <div className={result}>
          <p className="text-sm text-white/80">Publicala a</p>
          <p className="font-display text-4xl font-bold">{money(rounded)}</p>
          <p className="mt-1 text-sm text-white/80">La tienda se queda con {money(rounded * n(fee) / 100 + n(fixed))}{n(shipping) > 0 ? `, el envío ${money(n(shipping))}` : ''} y te quedan {money(rounded - rounded * n(fee) / 100 - n(fixed) - n(shipping))}.</p>
        </div>
      )}
    </section>
  );
}

function Pieces() {
  const [stock, setStock] = useState('');
  const [unit, setUnit] = useState<'kg' | 'g'>('kg');
  const [per, setPer] = useState('');
  const [waste, setWaste] = useState('5');
  const grams = n(stock) * (unit === 'kg' ? 1000 : 1);
  const r = piecesFrom(grams, n(per), n(waste));
  return (
    <section className={cardClass}>
      <h2 className="text-lg font-semibold">¿Cuántas piezas me salen?</h2>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Con el material que tenés y lo que lleva cada pieza.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className={label}>Material que tenés
          <span className="flex gap-2"><input value={stock} onChange={(e) => setStock(e.target.value)} inputMode="decimal" placeholder="Ej.: 5" className={inputClass} />
            <select value={unit} onChange={(e) => setUnit(e.target.value as 'kg' | 'g')} className={`${inputClass} w-20`}><option>kg</option><option>g</option></select></span></label>
        <label className={label}>Gramos por pieza<input value={per} onChange={(e) => setPer(e.target.value)} inputMode="decimal" placeholder="Ej.: 200" className={inputClass} /></label>
        <label className={label}>Merma (%)<input value={waste} onChange={(e) => setWaste(e.target.value)} inputMode="decimal" className={inputClass} /></label>
      </div>
      {r.pieces > 0 && (
        <div className={result}>
          <p className="font-display text-4xl font-bold">{r.pieces.toLocaleString('es-AR')} {r.pieces === 1 ? 'pieza' : 'piezas'}</p>
          <p className="mt-1 text-sm text-white/80">Te sobran {Math.round(r.leftover).toLocaleString('es-AR')} g.</p>
        </div>
      )}
    </section>
  );
}

function Kit({ initialCost }: { initialCost: string }) {
  const [rows, setRows] = useState([{ name: '', cost: initialCost, qty: '1' }, { name: '', cost: '', qty: '1' }]);
  const [packaging, setPackaging] = useState('');
  const [profit, setProfit] = useState('50');
  const set = (i: number, key: 'name' | 'cost' | 'qty', value: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [key]: value } : r)));
  const { cost, price } = kitPrice(rows.map((r) => ({ cost: n(r.cost), qty: n(r.qty) })), n(packaging), n(profit));
  return (
    <section className={cardClass}>
      <h2 className="text-lg font-semibold">Kits y combos</h2>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Sumá varias piezas y el packaging (caja, moño, papel) en un solo precio. El costo de cada pieza lo ves en Calcular o en tu historial.</p>
      <div className="mt-4 grid gap-2">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_6rem_4rem] gap-2">
            <input value={r.name} onChange={(e) => set(i, 'name', e.target.value)} placeholder={`Pieza ${i + 1}`} aria-label={`Pieza ${i + 1}`} className={inputClass} />
            <input value={r.cost} onChange={(e) => set(i, 'cost', e.target.value)} inputMode="decimal" placeholder="Costo $" aria-label={`Costo de la pieza ${i + 1}`} className={inputClass} />
            <input value={r.qty} onChange={(e) => set(i, 'qty', e.target.value)} inputMode="decimal" aria-label={`Cantidad de la pieza ${i + 1}`} className={inputClass} />
          </div>
        ))}
        {rows.length < 8 && <button type="button" onClick={() => setRows([...rows, { name: '', cost: '', qty: '1' }])} className="justify-self-start text-sm font-semibold text-orange-800 underline dark:text-orange-300">+ Sumar otra pieza</button>}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className={label}>Packaging del kit ($)<input value={packaging} onChange={(e) => setPackaging(e.target.value)} inputMode="decimal" placeholder="0" className={inputClass} /></label>
        <label className={label}>Ganancia (%)<input value={profit} onChange={(e) => setProfit(e.target.value)} inputMode="decimal" className={inputClass} /></label>
      </div>
      {cost > 0 && (
        <div className={result}>
          <p className="text-sm text-white/80">Precio del kit</p>
          <p className="font-display text-4xl font-bold">{money(roundPrice(price, 100))}</p>
          <p className="mt-1 text-sm text-white/80">Te cuesta {money(cost)} y ganás {money(roundPrice(price, 100) - cost)}.</p>
        </div>
      )}
    </section>
  );
}

function Time() {
  const [monthly, setMonthly] = useState('');
  const [hours, setHours] = useState('80');
  const [hourly, setHourly] = useState('');
  const [minutes, setMinutes] = useState('');
  const rate = n(hourly) || hourlyFromMonthly(n(monthly), n(hours));
  const perPiece = laborPerPiece(rate, n(minutes));
  return (
    <section className={cardClass}>
      <h2 className="text-lg font-semibold">Tu tiempo también se cobra</h2>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Calculá cuánto sumar por tu trabajo en cada pieza. Después ponelo en «Mano de obra» en Calcular (modo Personalizado).</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className={label}>¿Cuánto querés ganar por mes? ($)<input value={monthly} onChange={(e) => setMonthly(e.target.value)} inputMode="decimal" placeholder="Ej.: 400000" className={inputClass} /></label>
        <label className={label}>Horas que trabajás por mes<input value={hours} onChange={(e) => setHours(e.target.value)} inputMode="decimal" className={inputClass} /></label>
        <label className={label}>O directamente: valor de tu hora ($)<input value={hourly} onChange={(e) => setHourly(e.target.value)} inputMode="decimal" placeholder={rate ? String(Math.round(rate)) : 'Ej.: 4000'} className={inputClass} /></label>
        <label className={label}>Minutos que te lleva cada pieza<input value={minutes} onChange={(e) => setMinutes(e.target.value)} inputMode="decimal" placeholder="Ej.: 15" className={inputClass} /></label>
      </div>
      {perPiece > 0 && (
        <div className={result}>
          <p className="text-sm text-white/80">Sumá por tu trabajo</p>
          <p className="font-display text-4xl font-bold">{money(perPiece)} por pieza</p>
          <p className="mt-1 text-sm text-white/80">Tu hora vale {money(rate)}.</p>
        </div>
      )}
    </section>
  );
}

const UNIT_KEYS = Object.keys(MEASURE_UNITS) as MeasureUnit[];

// Conversor: cucharadas, tazas, ml y gramos según el material (densidad aproximada).
function Measures() {
  const [value, setValue] = useState('1');
  const [from, setFrom] = useState<MeasureUnit>('cda');
  const [to, setTo] = useState<MeasureUnit>('g');
  const [material, setMaterial] = useState<string>('yeso');
  const density = MEASURE_MATERIALS.find((m) => m.id === material)?.density ?? 1;
  const out = convertMeasure(n(value), from, to, density);
  const select = (v: MeasureUnit, set: (u: MeasureUnit) => void, aria: string) => (
    <select value={v} onChange={(e) => set(e.target.value as MeasureUnit)} aria-label={aria} className={inputClass}>
      {UNIT_KEYS.map((u) => <option key={u} value={u}>{MEASURE_UNITS[u].label}</option>)}
    </select>
  );
  return (
    <div className={cardClass}>
      <div className="grid gap-3">
        <label className={label}>Material
          <select value={material} onChange={(e) => setMaterial(e.target.value)} className={inputClass}>
            {MEASURE_MATERIALS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-[1fr_1.4fr] gap-2">
          <label className={label}>Cantidad<input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" className={inputClass} /></label>
          <label className={label}>De{select(from, setFrom, 'Unidad de origen')}</label>
        </div>
        <button type="button" onClick={() => { setFrom(to); setTo(from); }} className="mx-auto flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1.5 text-sm font-medium dark:bg-neutral-800"><ArrowDownUp size={16} aria-hidden="true" />Invertir</button>
        <label className={label}>A{select(to, setTo, 'Unidad de destino')}</label>
      </div>
      <div className={result}>
        <p className="text-sm text-white/80">{value || 0} {MEASURE_UNITS[from].label} de {MEASURE_MATERIALS.find((m) => m.id === material)?.label.toLowerCase()} son</p>
        <p className="text-3xl font-bold">{out.toLocaleString('es-AR', { maximumFractionDigits: out < 10 ? 2 : 1 })} {MEASURE_UNITS[to].label}</p>
      </div>
      <p className="mt-3 text-xs text-neutral-500">Cucharada = 15 ml, cucharadita = 5 ml, taza = 240 ml. Los polvos cambian según cuánto se aprieten: es una referencia, para precisión pesá con balanza.</p>
    </div>
  );
}
