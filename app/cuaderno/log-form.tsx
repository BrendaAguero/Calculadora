import { PhotoInput } from '@/components/photo-input';
import { SubmitButton } from '@/components/submit-button';
import { COLOR_MATERIALS } from '@/lib/colors';
import { PROBLEMS } from '@/lib/problems';
import { RESULTS } from '@/lib/test-logs';
import { inputClass, labelClass, primaryButton } from '@/lib/ui';

type Initial = { id?: string; made_on?: string; title?: string | null; material?: string | null; mix?: string | null; color_recipe_id?: string | null; temperature?: number | null; cure_hours?: number | null; result?: string; problems?: string[]; notes?: string | null; photo?: string | null; photoSrc?: string | null };
const num = (n: number | null | undefined) => (n == null ? '' : String(n).replace('.', ','));

export function LogForm({ action, initial, colors, today, submitLabel }: { action: (formData: FormData) => Promise<void>; initial?: Initial; colors: { id: string; name: string }[]; today: string; submitLabel: string }) {
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      {initial?.id && <input type="hidden" name="log_id" value={initial.id} />}
      <label className={labelClass}>Qué hiciste<input name="title" maxLength={120} defaultValue={initial?.title ?? ''} placeholder="Ej.: Maceta chica, prueba de color" className={inputClass} /></label>
      <label className={labelClass}>Fecha<input name="made_on" type="date" defaultValue={initial?.made_on ?? today} className={inputClass} /></label>
      <label className={labelClass}>Material
        <select name="material" defaultValue={initial?.material ?? ''} className={inputClass}>
          <option value="">—</option>
          {COLOR_MATERIALS.map((m) => <option key={m}>{m}</option>)}
        </select>
      </label>
      <label className={labelClass}>Proporción o receta<input name="mix" maxLength={300} defaultValue={initial?.mix ?? ''} placeholder="Ej.: 100 g yeso + 75 g agua" className={inputClass} /></label>
      {colors.length > 0 && (
        <label className={labelClass}>Color usado
          <select name="color_recipe_id" defaultValue={initial?.color_recipe_id ?? ''} className={inputClass}>
            <option value="">Sin color / otro</option>
            {colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      )}
      <label className={labelClass}>Temperatura del ambiente (°C)<input name="temperature" inputMode="decimal" defaultValue={num(initial?.temperature)} placeholder="Ej.: 22" className={inputClass} /></label>
      <label className={labelClass}>Horas hasta desmoldar<input name="cure_hours" inputMode="decimal" defaultValue={num(initial?.cure_hours)} placeholder="Ej.: 1,5" className={inputClass} /></label>

      <fieldset className="grid gap-2 sm:col-span-2">
        <legend className="mb-1 text-xs text-neutral-500 dark:text-neutral-400">¿Cómo salió? *</legend>
        <div className="flex flex-wrap gap-2">
          {RESULTS.map((r) => (
            <label key={r.value} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-neutral-300 px-3 py-1.5 text-sm has-[:checked]:border-orange-700 has-[:checked]:bg-orange-50 dark:border-neutral-700 dark:has-[:checked]:bg-orange-950/40">
              <input type="radio" name="result" value={r.value} required defaultChecked={initial?.result === r.value} className="sr-only" />{r.emoji} {r.label}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="grid gap-2 sm:col-span-2">
        <legend className="mb-1 text-xs text-neutral-500 dark:text-neutral-400">¿Tuvo algún problema?</legend>
        <div className="flex flex-wrap gap-2">
          {PROBLEMS.map((p) => (
            <label key={p.id} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-neutral-300 px-3 py-1.5 text-sm has-[:checked]:border-red-600 has-[:checked]:bg-red-50 dark:border-neutral-700 dark:has-[:checked]:bg-red-950/40">
              <input type="checkbox" name="problems" value={p.id} defaultChecked={initial?.problems?.includes(p.id)} className="sr-only" />{p.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className={`${labelClass} sm:col-span-2`}>Notas<textarea name="notes" maxLength={2000} rows={3} defaultValue={initial?.notes ?? ''} placeholder="Qué cambiarías la próxima vez, marca del material, cómo mezclaste…" className={inputClass} /></label>
      <div className="sm:col-span-2"><PhotoInput defaultValue={initial?.photo} previewSrc={initial?.photoSrc} /></div>
      <div className="sm:col-span-2"><SubmitButton className={primaryButton} pendingText="Guardando…">{submitLabel}</SubmitButton></div>
    </form>
  );
}
