'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import type { MoldFormState, MoldFormValues } from './actions';

type Props = {
  action: (state: MoldFormState, formData: FormData) => Promise<MoldFormState>;
  initialValues?: Partial<MoldFormValues>;
  moldId?: string;
  submitLabel: string;
};

const inputClass = 'rounded-xl border border-neutral-300 bg-white px-3 py-3 text-neutral-900 placeholder:text-neutral-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:placeholder:text-neutral-500';

function SubmitButton({ label }: { label: string }) {
  // Deshabilitado mientras se guarda, para que un doble clic no cree dos moldes.
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-xl bg-neutral-900 px-4 py-3 font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900">
      {pending ? 'Guardando…' : label}
    </button>
  );
}

export function MoldForm({ action, initialValues, moldId, submitLabel }: Props) {
  const [state, formAction] = useActionState(action, { error: null, values: null });
  const values = state.values ?? initialValues ?? {};

  return (
    <>
      {state.error && (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          <strong>No se guardó el molde.</strong>
          <div className="mt-1 break-words">{state.error}</div>
        </div>
      )}
      {/* key: al volver con error, se remonta el formulario con los valores enviados para no perderlos. */}
      <form key={JSON.stringify(values)} action={formAction} className="grid gap-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        {moldId && <input type="hidden" name="mold_id" value={moldId} />}
        <label className="grid gap-1">
          <span className="text-sm font-medium">Nombre *</span>
          <input name="name" required defaultValue={values.name ?? ''} placeholder="Ej. Molde bandeja ovalada" className={inputClass} />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-medium">Foto (URL)</span>
          <input name="photo_url" type="url" defaultValue={values.photo_url ?? ''} placeholder="https://..." className={inputClass} />
        </label>
        <div className="grid grid-cols-[1fr_110px] gap-3">
          <label className="grid gap-1">
            <span className="text-sm font-medium">Medición de referencia *</span>
            <input name="reference_measurement_value" type="number" min="0.01" step="0.01" required defaultValue={values.reference_measurement_value ?? ''} placeholder="300" className={inputClass} />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium">Unidad</span>
            <select name="reference_measurement_unit" defaultValue={values.reference_measurement_unit ?? 'g'} className={inputClass}>
              <option value="g">g</option>
              <option value="kg">kg</option>
              <option value="ml">ml</option>
              <option value="l">l</option>
            </select>
          </label>
        </div>
        <p className="-mt-2 text-xs text-neutral-500 dark:text-neutral-400">
          Para Yeso: llená el molde con agua y pesala. Ese peso en gramos se toma como los gramos de yeso por pieza. El porcentaje de agua se define en la fórmula, no en el molde.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1">
            <span className="text-sm font-medium">Costo del molde</span>
            <input name="cost" type="number" min="0" step="0.01" defaultValue={values.cost ?? ''} placeholder="5000" className={inputClass} />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium">Usos estimados</span>
            <input name="estimated_uses" type="number" min="0" step="1" defaultValue={values.estimated_uses ?? ''} placeholder="30" className={inputClass} />
          </label>
        </div>
        <label className="grid gap-1">
          <span className="text-sm font-medium">Notas</span>
          <textarea name="notes" rows={4} defaultValue={values.notes ?? ''} placeholder="Medidas, cuidados, proveedor, etc." className={inputClass} />
        </label>
        <SubmitButton label={submitLabel} />
      </form>
    </>
  );
}
