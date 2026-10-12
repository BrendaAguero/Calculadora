'use client';

import { parseAR } from '@/lib/num';
import { useState } from 'react';
import { moldVolumeMl, type MoldShape } from '@/lib/volume';

const n = (value: string) => { const v = parseAR(String(value)); return Number.isFinite(v) && v > 0 ? v : 0; };

// Cuánto entra en el molde: llenándolo con agua (ml) o con sus medidas (cm).
// onChange recibe siempre los ml del molde.
export function MoldVolume({ value, onChange, dark = false, inputClass }: { value: string; onChange: (ml: string) => void; dark?: boolean; inputClass: string }) {
  const [how, setHow] = useState<'agua' | 'medidas'>('agua');
  const [shape, setShape] = useState<MoldShape>('rect');
  const [dims, setDims] = useState({ length: '', width: '', diameter: '', height: '' });
  const setDim = (key: keyof typeof dims, v: string) => {
    const next = { ...dims, [key]: v };
    setDims(next);
    const ml = moldVolumeMl(shape, { length: n(next.length), width: n(next.width), diameter: n(next.diameter), height: n(next.height) });
    onChange(ml > 0 ? String(Math.round(ml)) : '');
  };
  const chip = (active: boolean) => `rounded-full px-3 py-1.5 text-sm font-semibold ${active ? (dark ? 'bg-white text-neutral-900' : 'bg-orange-800 text-white') : (dark ? 'bg-white/15' : 'bg-neutral-100 dark:bg-neutral-800')}`;
  const hint = dark ? 'text-white/75' : 'text-neutral-500 dark:text-neutral-400';
  const label = `grid gap-1 text-sm font-medium ${dark ? 'text-white/85' : ''}`;

  return (
    <div className="grid gap-2">
      <span className={label}>¿Cuánto entra en tu molde?</span>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setHow('agua')} aria-pressed={how === 'agua'} className={chip(how === 'agua')}>Lo lleno con agua</button>
        <button type="button" onClick={() => setHow('medidas')} aria-pressed={how === 'medidas'} className={chip(how === 'medidas')}>Con sus medidas</button>
      </div>
      {how === 'agua' ? (
        <>
          <label className={label}>Agua que entra (ml o gramos)<input value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal" placeholder="Ej.: 250" className={inputClass} /></label>
          <p className={`text-xs ${hint}`}>Llená el molde con agua y medila con una jarra o pesala (1 g de agua = 1 ml). Ese es el espacio que vas a llenar con la mezcla.</p>
        </>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setShape('rect')} aria-pressed={shape === 'rect'} className={chip(shape === 'rect')}>Cuadrado o rectangular</button>
            <button type="button" onClick={() => setShape('round')} aria-pressed={shape === 'round'} className={chip(shape === 'round')}>Redondo</button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {shape === 'rect' ? (
              <>
                <label className={label}>Largo (cm)<input value={dims.length} onChange={(e) => setDim('length', e.target.value)} inputMode="decimal" className={inputClass} /></label>
                <label className={label}>Ancho (cm)<input value={dims.width} onChange={(e) => setDim('width', e.target.value)} inputMode="decimal" className={inputClass} /></label>
              </>
            ) : (
              <label className={`${label} col-span-2`}>Diámetro (cm)<input value={dims.diameter} onChange={(e) => setDim('diameter', e.target.value)} inputMode="decimal" className={inputClass} /></label>
            )}
            <label className={label}>Alto (cm)<input value={dims.height} onChange={(e) => setDim('height', e.target.value)} inputMode="decimal" className={inputClass} /></label>
          </div>
          <p className={`text-xs ${hint}`}>{n(value) ? `Tu molde tiene unos ${Math.round(n(value)).toLocaleString('es-AR')} ml (1 cm³ = 1 ml).` : 'Medí por dentro, donde va la mezcla.'} Si la pieza tiene formas, conviene llenarlo con agua: es más exacto.</p>
        </>
      )}
    </div>
  );
}
