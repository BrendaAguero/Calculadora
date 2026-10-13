'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { PhotoInput } from '@/components/photo-input';
import { SubmitButton } from '@/components/submit-button';
import { COLOR_MATERIALS, PIGMENT_UNITS, type Pigment } from '@/lib/colors';
import { inputClass, labelClass, primaryButton } from '@/lib/ui';

type Row = { key: number; name: string; amount: string; unit: string };
type Initial = { id?: string; name?: string; material?: string | null; base_grams?: number; pigments?: Pigment[]; notes?: string | null; photo?: string | null };

let nextKey = 1;
const row = (p?: Pigment): Row => ({ key: nextKey++, name: p?.name ?? '', amount: p ? String(p.amount).replace('.', ',') : '', unit: p?.unit ?? 'g' });

export function RecipeForm({ action, initial, submitLabel }: { action: (formData: FormData) => Promise<void>; initial?: Initial; submitLabel: string }) {
  const [rows, setRows] = useState<Row[]>(() => (initial?.pigments?.length ? initial.pigments.map(row) : [row()]));
  const set = (key: number, field: 'name' | 'amount' | 'unit', value: string) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)));

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      {initial?.id && <input type="hidden" name="recipe_id" value={initial.id} />}
      <label className={`${labelClass} sm:col-span-2`}>Nombre del color *<input name="name" required maxLength={120} defaultValue={initial?.name} placeholder="Ej.: Rosa empolvado" className={inputClass} /></label>
      <label className={labelClass}>Material
        <select name="material" defaultValue={initial?.material ?? ''} className={inputClass}>
          <option value="">—</option>
          {COLOR_MATERIALS.map((m) => <option key={m}>{m}</option>)}
        </select>
      </label>
      <label className={labelClass}>Para cuántos gramos de mezcla *<input name="base_grams" required inputMode="decimal" defaultValue={initial?.base_grams != null ? String(initial.base_grams).replace('.', ',') : '100'} className={inputClass} /><span>Ej.: 100 g de yeso ya mezclado, o 100 g de resina (A + B).</span></label>

      <fieldset className="grid gap-2 sm:col-span-2">
        <legend className="mb-1 text-xs text-neutral-500 dark:text-neutral-400">Pigmentos *</legend>
        {rows.map((r, i) => (
          <div key={r.key} className="grid grid-cols-[1fr_7rem_auto] items-center gap-2 border-b border-neutral-100 pb-2 dark:border-neutral-800 sm:grid-cols-[1fr_5.5rem_6.5rem_auto] sm:border-0 sm:pb-0">
            <input name="pigment_name" value={r.name} onChange={(e) => set(r.key, 'name', e.target.value)} maxLength={60} placeholder={`Pigmento ${i + 1} (ej.: rojo óxido)`} aria-label={`Pigmento ${i + 1}`} className={`${inputClass} col-span-3 sm:col-span-1`} />
            <input name="pigment_amount" value={r.amount} onChange={(e) => set(r.key, 'amount', e.target.value)} inputMode="decimal" placeholder="Cant." aria-label={`Cantidad del pigmento ${i + 1}`} className={inputClass} />
            <select name="pigment_unit" value={r.unit} onChange={(e) => set(r.key, 'unit', e.target.value)} aria-label={`Unidad del pigmento ${i + 1}`} className={inputClass}>
              {PIGMENT_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
            <button type="button" onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : rs))} aria-label={`Quitar el pigmento ${i + 1}`} className="grid h-10 w-10 place-items-center rounded-xl text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"><Trash2 size={16} aria-hidden="true" /></button>
          </div>
        ))}
        {rows.length < 12 && <button type="button" onClick={() => setRows((rs) => [...rs, row()])} className="flex w-fit items-center gap-1 text-sm font-medium text-orange-800 dark:text-orange-300"><Plus size={16} aria-hidden="true" />Sumar otro pigmento</button>}
      </fieldset>

      <label className={`${labelClass} sm:col-span-2`}>Notas<textarea name="notes" maxLength={1000} rows={2} defaultValue={initial?.notes ?? ''} placeholder="Marca del pigmento, cómo lo mezclaste, cómo queda al secar…" className={inputClass} /></label>
      <div className="sm:col-span-2"><PhotoInput defaultValue={initial?.photo} /></div>
      <div className="sm:col-span-2"><SubmitButton className={primaryButton} pendingText="Guardando…">{submitLabel}</SubmitButton></div>
    </form>
  );
}
