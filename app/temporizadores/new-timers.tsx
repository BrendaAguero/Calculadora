'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { SubmitButton } from '@/components/submit-button';
import { CURE_PRESETS, formatDuration, type Stage } from '@/lib/timers';
import { inputClass, labelClass, primaryButton } from '@/lib/ui';

type Row = Stage & { on: boolean; unit: 'min' | 'h' | 'd' };
const UNIT_MINUTES = { min: 1, h: 60, d: 24 * 60 } as const;
const toRow = (s: Stage): Row => {
  const unit = s.minutes % (24 * 60) === 0 && s.minutes >= 48 * 60 ? 'd' : s.minutes % 60 === 0 ? 'h' : 'min';
  return { ...s, on: true, unit };
};

export function NewTimers({ action }: { action: (formData: FormData) => Promise<void> }) {
  const [material, setMaterial] = useState('Yeso');
  const [rows, setRows] = useState<Row[]>(() => CURE_PRESETS.Yeso.map(toRow));
  const pick = (m: string) => { setMaterial(m); setRows(m === 'Otro' ? [{ label: 'Desmoldar', minutes: 60, on: true, unit: 'h' }] : CURE_PRESETS[m].map(toRow)); };
  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <form action={action} className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {[...Object.keys(CURE_PRESETS), 'Otro'].map((m) => (
          <button key={m} type="button" onClick={() => pick(m)} aria-pressed={material === m} className={`rounded-full px-3 py-1.5 text-sm font-medium ${material === m ? 'bg-orange-800 text-white dark:bg-orange-600' : 'bg-neutral-100 dark:bg-neutral-800'}`}>{m}</button>
        ))}
      </div>
      <label className={labelClass}>¿Qué colaste? (opcional)<input name="piece" maxLength={80} placeholder="Ej.: 6 macetas chicas" className={inputClass} /></label>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-xs text-neutral-500 dark:text-neutral-400">Avisarme cuando…</legend>
        {rows.map((r, i) => {
          const amount = r.minutes / UNIT_MINUTES[r.unit];
          return (
            <div key={i} className="grid grid-cols-[auto_1fr] items-center gap-2 rounded-2xl border border-neutral-200 p-2.5 dark:border-neutral-800 sm:grid-cols-[auto_1fr_auto]">
              <input type="checkbox" name="stage_on" value={i} checked={r.on} onChange={(e) => update(i, { on: e.target.checked })} aria-label={`Usar «${r.label}»`} className="h-5 w-5 accent-orange-800" />
              <input name="stage_label" value={r.label} onChange={(e) => update(i, { label: e.target.value })} maxLength={70} aria-label="Etapa" className={inputClass} />
              <span className="col-span-2 flex items-center gap-2 sm:col-span-1">
                <span className="text-sm text-neutral-500">en</span>
                <input value={Number.isFinite(amount) ? String(Math.round(amount * 100) / 100).replace('.', ',') : ''} onChange={(e) => { const n = Number(e.target.value.replace(',', '.')); update(i, { minutes: n > 0 ? n * UNIT_MINUTES[r.unit] : 0 }); }} inputMode="decimal" aria-label={`Tiempo para «${r.label}»`} className={`${inputClass} w-20`} />
                <select value={r.unit} onChange={(e) => update(i, { unit: e.target.value as Row['unit'] })} aria-label="Unidad" className={`${inputClass} w-24`}>
                  <option value="min">min</option><option value="h">horas</option><option value="d">días</option>
                </select>
                <input type="hidden" name="stage_minutes" value={r.minutes} />
              </span>
            </div>
          );
        })}
        {rows.length < 6 && <button type="button" onClick={() => setRows((rs) => [...rs, { label: 'Otra etapa', minutes: 30, on: true, unit: 'min' }])} className="flex w-fit items-center gap-1 text-sm font-medium text-orange-800 dark:text-orange-300"><Plus size={16} aria-hidden="true" />Sumar otra etapa</button>}
      </fieldset>
      <p className="text-xs text-neutral-500">Son tiempos de referencia a 20-25 °C: revisá lo que indica la marca de tu material. Con frío, sumale tiempo. {rows.filter((r) => r.on).map((r) => `${r.label}: ${formatDuration(r.minutes)}`).join(' · ')}</p>
      <div><SubmitButton className={primaryButton} pendingText="Poniendo en marcha…">Empezar</SubmitButton></div>
    </form>
  );
}
