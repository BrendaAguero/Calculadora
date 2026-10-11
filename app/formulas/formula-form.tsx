'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import type { FormulaFormState, FormulaFormValues, IngredientInput } from './actions';
import { INGREDIENT_LABELS, INGREDIENT_TYPES, INGREDIENT_UNITS } from './constants';

type Option = { id: string; name: string };
type Activity = Option & { code: string };
type Material = Option & { default_unit: string };

type Props = {
  // create: fórmula nueva con su v1 · version: versión nueva de la receta · info: datos generales.
  mode: 'create' | 'version' | 'info';
  action: (state: FormulaFormState, formData: FormData) => Promise<FormulaFormState>;
  formulaId?: string;
  activities?: Activity[];
  activityCode?: string;
  materials?: Material[];
  molds?: Option[];
  initialValues?: Partial<FormulaFormValues>;
  submitLabel: string;
};

const inputClass = 'w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-neutral-900 placeholder:text-neutral-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:placeholder:text-neutral-500';
const emptyItem: IngredientInput = { ingredient_type: 'material', material_id: '', quantity: '', unit: 'g', notes: '' };

function SubmitButton({ label }: { label: string }) {
  // Deshabilitado mientras guarda, para que varios clics no creen duplicados.
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="rounded-xl bg-neutral-900 px-4 py-3 font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900">{pending ? 'Guardando…' : label}</button>;
}

function Ingredients({ items, setItems, materials }: { items: IngredientInput[]; setItems: (items: IngredientInput[]) => void; materials: Material[] }) {
  const update = (index: number, patch: Partial<IngredientInput>) => setItems(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  return (
    <fieldset className="grid gap-3">
      <legend className="mb-2 text-sm font-medium">Ingredientes</legend>
      {items.length === 0 && <p className="text-sm text-neutral-500 dark:text-neutral-400">Todavía no agregaste ingredientes.</p>}
      {items.map((item, index) => (
        <div key={index} className="grid gap-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-xs text-neutral-500 dark:text-neutral-400">Tipo
              <select aria-label={`Tipo del ingrediente ${index + 1}`} value={item.ingredient_type} onChange={e => update(index, { ingredient_type: e.target.value, material_id: e.target.value === 'material' ? item.material_id : '' })} className={inputClass}>
                {INGREDIENT_TYPES.map(type => <option key={type} value={type}>{INGREDIENT_LABELS[type]}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs text-neutral-500 dark:text-neutral-400">Material{item.ingredient_type === 'material' ? ' *' : ' (opcional)'}
              <select aria-label={`Material del ingrediente ${index + 1}`} value={item.material_id} onChange={e => { const material = materials.find(m => m.id === e.target.value); update(index, { material_id: e.target.value, unit: material?.default_unit && (INGREDIENT_UNITS as readonly string[]).includes(material.default_unit) ? material.default_unit : item.unit }); }} className={inputClass}>
                <option value="">{materials.length ? 'Elegí…' : 'No tenés materiales'}</option>
                {materials.map(material => <option key={material.id} value={material.id}>{material.name}</option>)}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-[1fr_100px_auto] items-end gap-2">
            <label className="grid gap-1 text-xs text-neutral-500 dark:text-neutral-400">Cantidad *
              <input aria-label={`Cantidad del ingrediente ${index + 1}`} type="number" min="0" step="any" value={item.quantity} onChange={e => update(index, { quantity: e.target.value })} className={inputClass} />
            </label>
            <label className="grid gap-1 text-xs text-neutral-500 dark:text-neutral-400">Unidad
              <select aria-label={`Unidad del ingrediente ${index + 1}`} value={item.unit} onChange={e => update(index, { unit: e.target.value })} className={inputClass}>
                {INGREDIENT_UNITS.map(unit => <option key={unit} value={unit}>{unit}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => setItems(items.filter((_, i) => i !== index))} className="rounded-xl border border-neutral-300 px-3 py-2.5 text-sm text-red-700 dark:border-neutral-700 dark:text-red-300" aria-label={`Quitar ingrediente ${index + 1}`}>Quitar</button>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => setItems([...items, { ...emptyItem }])} className="justify-self-start rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-700">+ Agregar ingrediente</button>
      {materials.length === 0 && <p className="text-xs text-neutral-500 dark:text-neutral-400">Para usar un material, primero cargalo en Materiales. Agua y otros tipos se pueden agregar sin material.</p>}
    </fieldset>
  );
}

function FormulaFields({ mode, values, activities, activityCode, materials, molds }: { mode: Props['mode']; values: Partial<FormulaFormValues>; activities: Activity[]; activityCode?: string; materials: Material[]; molds: Option[] }) {
  const [items, setItems] = useState<IngredientInput[]>(values.items?.length ? values.items : mode === 'info' ? [] : [{ ...emptyItem }]);
  const [activityId, setActivityId] = useState(values.activity_id || (activities.length === 1 ? activities[0].id : ''));
  const code = activityCode ?? activities.find(a => a.id === activityId)?.code;
  const showInfo = mode !== 'version';
  const showRecipe = mode !== 'info';

  return (
    <>
      {showInfo && (
        <>
          <label className="grid gap-1 text-sm font-medium">Nombre *
            <input name="name" required defaultValue={values.name ?? ''} placeholder="Ej. Porta sahumerio" className={inputClass} />
          </label>
          {mode === 'create' && activities.length === 1 && (
            // Con una sola actividad no hace falta preguntar.
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Actividad: {activities[0].name}<input type="hidden" name="activity_id" value={activities[0].id} /></p>
          )}
          {mode === 'create' && activities.length > 1 && (
            <label className="grid gap-1 text-sm font-medium">Actividad *
              <select name="activity_id" required value={activityId} onChange={e => setActivityId(e.target.value)} className={inputClass}>
                <option value="">Elegí una actividad</option>
                {activities.map(activity => <option key={activity.id} value={activity.id}>{activity.name}</option>)}
              </select>
            </label>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-sm font-medium">Categoría
              <input name="category" defaultValue={values.category ?? ''} placeholder="Ej. Decoración" className={inputClass} />
            </label>
            <label className="grid gap-1 text-sm font-medium">Molde
              <select name="mold_id" defaultValue={values.mold_id ?? ''} className={inputClass}>
                <option value="">Sin molde</option>
                {molds.map(mold => <option key={mold.id} value={mold.id}>{mold.name}</option>)}
              </select>
            </label>
          </div>
          <label className="grid gap-1 text-sm font-medium">Foto (URL)
            <input name="photo_url" type="url" defaultValue={values.photo_url ?? ''} placeholder="https://..." className={inputClass} />
          </label>
          <label className="grid gap-1 text-sm font-medium">Notas de la fórmula
            <textarea name="notes" rows={2} defaultValue={values.notes ?? ''} className={inputClass} />
          </label>
        </>
      )}
      {showRecipe && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-sm font-medium">Rendimiento (piezas) *
              <input name="yield_quantity" type="number" min="0.01" step="any" required defaultValue={values.yield_quantity ?? '1'} className={inputClass} />
            </label>
            <label className="grid gap-1 text-sm font-medium">Agua (%)
              <input name="water_percentage" type="number" min="0" step="any" defaultValue={values.water_percentage ?? ''} placeholder="Opcional" className={inputClass} />
            </label>
          </div>
          {code === 'YESO' && (
            <p className="-mt-2 text-xs text-neutral-500 dark:text-neutral-400">
              Valores orientativos para Yeso: 70 %, 75 % u 80 % del peso del yeso. Son referencias, no reglas: usá el porcentaje que te funcione. Este porcentaje es de la fórmula, no del molde.
            </p>
          )}
          <Ingredients items={items} setItems={setItems} materials={materials} />
          <input type="hidden" name="items" value={JSON.stringify(items)} />
          <label className="grid gap-1 text-sm font-medium">Notas de esta versión
            <textarea name="version_notes" rows={2} defaultValue={values.version_notes ?? ''} placeholder="Qué cambió y por qué" className={inputClass} />
          </label>
        </>
      )}
    </>
  );
}

export function FormulaForm({ mode, action, formulaId, activities = [], activityCode, materials = [], molds = [], initialValues, submitLabel }: Props) {
  const [state, formAction] = useActionState(action, { error: null, values: null });
  const values = state.values ?? initialValues ?? {};

  return (
    <>
      {state.error && (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          <strong>No se guardó.</strong>
          <div className="mt-1 break-words">{state.error}</div>
        </div>
      )}
      {/* key: al volver con error, se remonta con los valores enviados para no perder lo escrito. */}
      <form key={JSON.stringify(values)} action={formAction} className="grid gap-4 rounded-3xl bg-white p-5 dark:bg-neutral-900">
        {formulaId && <input type="hidden" name="formula_id" value={formulaId} />}
        <FormulaFields mode={mode} values={values} activities={activities} activityCode={activityCode} materials={materials} molds={molds} />
        <SubmitButton label={submitLabel} />
      </form>
    </>
  );
}
