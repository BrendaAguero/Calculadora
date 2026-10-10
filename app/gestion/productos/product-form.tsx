'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import type { ProductFormState } from './actions';

type Option = { id: string; name: string; activity_id: string };
type Activity = { id: string; name: string };

const inputClass = 'w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-neutral-900 placeholder:text-neutral-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:placeholder:text-neutral-500';

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="rounded-xl bg-neutral-900 px-4 py-3 font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900">{pending ? 'Guardando…' : 'Crear producto'}</button>;
}

export function ProductForm({ action, activities, formulas, molds }: { action: (state: ProductFormState, formData: FormData) => Promise<ProductFormState>; activities: Activity[]; formulas: Option[]; molds: Option[] }) {
  const [state, formAction] = useActionState(action, { error: null, values: null });
  const values = state.values;
  const [activityId, setActivityId] = useState(values?.activity_id || activities[0]?.id || '');
  // Solo se ofrecen fórmulas y moldes de la actividad del producto.
  const activityFormulas = formulas.filter(f => f.activity_id === activityId);
  const activityMolds = molds.filter(m => m.activity_id === activityId);

  return (
    <>
      {state.error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"><strong>No se guardó.</strong><div className="mt-1">{state.error}</div></div>}
      <form key={JSON.stringify(values)} action={formAction} className="grid gap-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <label className="grid gap-1 text-sm font-medium">Nombre *<input name="name" required defaultValue={values?.name ?? ''} placeholder="Ej. Porta sahumerio Luna" className={inputClass} /></label>
        {activities.length === 1
          ? <p className="text-sm text-neutral-500 dark:text-neutral-400">Actividad: {activities[0].name}<input type="hidden" name="activity_id" value={activities[0].id} /></p>
          : <label className="grid gap-1 text-sm font-medium">Actividad *<select name="activity_id" value={activityId} onChange={e => setActivityId(e.target.value)} className={inputClass}>{activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium">Fórmula predeterminada
            <select name="formula_id" defaultValue={values?.formula_id ?? ''} className={inputClass}><option value="">Sin fórmula</option>{activityFormulas.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
          </label>
          <label className="grid gap-1 text-sm font-medium">Molde predeterminado
            <select name="mold_id" defaultValue={values?.mold_id ?? ''} className={inputClass}><option value="">Sin molde</option>{activityMolds.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
          </label>
        </div>
        <label className="grid gap-1 text-sm font-medium">Foto (URL)<input name="photo_url" type="url" defaultValue={values?.photo_url ?? ''} placeholder="https://..." className={inputClass} /></label>
        <label className="grid gap-1 text-sm font-medium">Notas<textarea name="notes" rows={2} defaultValue={values?.notes ?? ''} className={inputClass} /></label>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">Después de crearlo vas a poder sumar más fórmulas y moldes, y cargar los precios.</p>
        <SubmitButton />
      </form>
    </>
  );
}
