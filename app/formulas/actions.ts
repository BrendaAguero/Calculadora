'use server';

import { parseAR } from '@/lib/num';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ownsActivity } from '@/lib/access/activities';
import { createLimitError } from '@/lib/access/permissions';
import { INGREDIENT_TYPES, INGREDIENT_UNITS } from './constants';

type Supabase = Awaited<ReturnType<typeof createClient>>;


export type IngredientInput = { ingredient_type: string; material_id: string; quantity: string; unit: string; notes: string };

export type FormulaFormValues = {
  name: string;
  activity_id: string;
  category: string;
  mold_id: string;
  photo_url: string;
  notes: string;
  yield_quantity: string;
  water_percentage: string;
  version_notes: string;
  items: IngredientInput[];
};

export type FormulaFormState = { error: string | null; values: FormulaFormValues | null };

function number(value: string) {
  const parsed = parseAR(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function readValues(formData: FormData): FormulaFormValues {
  const text = (key: string) => String(formData.get(key) ?? '').trim();
  let items: IngredientInput[] = [];
  try {
    const parsed = JSON.parse(text('items') || '[]');
    if (Array.isArray(parsed)) {
      items = parsed.map(item => ({
        ingredient_type: String(item?.ingredient_type ?? 'material'),
        material_id: String(item?.material_id ?? ''),
        quantity: String(item?.quantity ?? '').trim(),
        unit: String(item?.unit ?? 'g'),
        notes: String(item?.notes ?? '').trim(),
      }));
    }
  } catch {}
  return {
    name: text('name'),
    activity_id: text('activity_id'),
    category: text('category'),
    mold_id: text('mold_id'),
    photo_url: text('photo_url'),
    notes: text('notes'),
    yield_quantity: text('yield_quantity') || '1',
    water_percentage: text('water_percentage'),
    version_notes: text('version_notes'),
    items,
  };
}

type VersionData = {
  yield_quantity: number;
  water_percentage: number | null;
  notes: string | null;
  items: { ingredient_type: string; material_id: string | null; quantity: number; unit: string; notes: string | null }[];
};

// Valida la versión (rendimiento, agua e ingredientes) y verifica que los materiales sean de la usuaria.
async function parseVersion(supabase: Supabase, userId: string, values: FormulaFormValues): Promise<{ error: string } | { version: VersionData }> {
  const yieldQuantity = number(values.yield_quantity);
  if (!(yieldQuantity > 0)) return { error: 'El rendimiento debe ser un número mayor que 0.' };

  let waterPercentage: number | null = null;
  if (values.water_percentage !== '') {
    waterPercentage = number(values.water_percentage);
    if (!(waterPercentage >= 0)) return { error: 'El porcentaje de agua debe ser un número igual o mayor que 0.' };
  }

  const items: VersionData['items'] = [];
  for (const [index, item] of values.items.entries()) {
    const row = `Ingrediente ${index + 1}`;
    // Filas totalmente vacías se ignoran.
    if (!item.quantity && !item.material_id && item.ingredient_type === 'material') continue;
    if (!INGREDIENT_TYPES.includes(item.ingredient_type as (typeof INGREDIENT_TYPES)[number])) return { error: `${row}: tipo inválido.` };
    if (!INGREDIENT_UNITS.includes(item.unit as (typeof INGREDIENT_UNITS)[number])) return { error: `${row}: unidad inválida.` };
    const quantity = number(item.quantity);
    if (!(quantity > 0)) return { error: `${row}: la cantidad debe ser mayor que 0.` };
    if (item.ingredient_type === 'material' && !item.material_id) return { error: `${row}: elegí el material.` };
    items.push({ ingredient_type: item.ingredient_type, material_id: item.material_id || null, quantity, unit: item.unit, notes: item.notes || null });
  }

  const materialIds = [...new Set(items.map(item => item.material_id).filter((id): id is string => Boolean(id)))];
  if (materialIds.length) {
    const { data, error } = await supabase.from('materials').select('id').eq('user_id', userId).in('id', materialIds);
    if (error) return { error: `No se pudieron verificar los materiales: ${error.message}` };
    if ((data ?? []).length !== materialIds.length) return { error: 'Alguno de los materiales elegidos no existe o no es tuyo.' };
  }

  return { version: { yield_quantity: yieldQuantity, water_percentage: waterPercentage, notes: values.version_notes || null, items } };
}

async function auth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, userId: user.id };
}

// Inserta una versión con sus ingredientes. Si los ingredientes fallan, borra la versión recién creada.
async function insertVersion(supabase: Supabase, userId: string, formulaId: string, versionNumber: number, version: VersionData) {
  const { data: created, error } = await supabase
    .from('formula_versions')
    .insert({ formula_id: formulaId, version_number: versionNumber, yield_quantity: version.yield_quantity, water_percentage: version.water_percentage, notes: version.notes, created_by: userId })
    .select('id')
    .single();
  if (error || !created) return { error: error?.code === '23505' ? 'Se creó otra versión al mismo tiempo. Volvé a intentarlo.' : `No se pudo crear la versión: ${error?.message}` };

  if (version.items.length) {
    const { error: itemsError } = await supabase.from('formula_items').insert(version.items.map(item => ({ ...item, formula_version_id: created.id })));
    if (itemsError) {
      await supabase.from('formula_versions').delete().eq('id', created.id);
      return { error: `No se pudieron guardar los ingredientes: ${itemsError.message}` };
    }
  }

  const { error: currentError } = await supabase.from('formulas').update({ current_version_id: created.id }).eq('id', formulaId).eq('user_id', userId);
  if (currentError) return { error: `La versión se guardó pero no se pudo marcar como actual: ${currentError.message}` };
  return { id: created.id };
}

async function checkMold(supabase: Supabase, userId: string, moldId: string) {
  if (!moldId) return null;
  const { data } = await supabase.from('molds').select('id').eq('id', moldId).eq('user_id', userId).maybeSingle();
  return data ? null : 'El molde elegido no existe o no es tuyo.';
}

export async function createFormula(_prev: FormulaFormState, formData: FormData): Promise<FormulaFormState> {
  const values = readValues(formData);
  if (!values.name) return { error: 'Escribí un nombre para la fórmula.', values };
  if (!values.activity_id) return { error: 'Elegí la actividad.', values };
  if (values.photo_url && !/^https?:\/\//i.test(values.photo_url)) return { error: 'La foto debe ser una dirección que empiece con http:// o https://.', values };

  const { supabase, userId } = await auth();
  const parsed = await parseVersion(supabase, userId, values);
  if ('error' in parsed) return { error: parsed.error, values };

  if (!(await ownsActivity(supabase, userId, values.activity_id))) return { error: 'Elegí una de tus actividades.', values };
  const moldError = await checkMold(supabase, userId, values.mold_id);
  if (moldError) return { error: moldError, values };
  const limitError = await createLimitError(supabase, userId, 'formulas');
  if (limitError) return { error: limitError, values };

  const { data: formula, error } = await supabase
    .from('formulas')
    .insert({ user_id: userId, activity_id: values.activity_id, mold_id: values.mold_id || null, name: values.name, category: values.category || null, photo_url: values.photo_url || null, notes: values.notes || null, status: 'active' })
    .select('id')
    .single();
  if (error || !formula) return { error: `No se pudo crear la fórmula: ${error?.message}`, values };

  const result = await insertVersion(supabase, userId, formula.id, 1, parsed.version);
  if ('error' in result) {
    // Sin versión la fórmula quedaría incompleta: se deshace.
    await supabase.from('formulas').delete().eq('id', formula.id).eq('user_id', userId);
    return { error: result.error ?? 'No se pudo crear la fórmula.', values };
  }

  revalidatePath('/formulas');
  redirect(`/formulas/${formula.id}?guardado=1`);
}

// Editar ingredientes, rendimiento o agua siempre crea una versión nueva; las anteriores no se tocan.
export async function createVersion(_prev: FormulaFormState, formData: FormData): Promise<FormulaFormState> {
  const formulaId = String(formData.get('formula_id') ?? '');
  const values = readValues(formData);
  const { supabase, userId } = await auth();

  const { data: formula } = await supabase.from('formulas').select('id').eq('id', formulaId).eq('user_id', userId).maybeSingle();
  if (!formula) return { error: 'No se encontró la fórmula.', values };

  const parsed = await parseVersion(supabase, userId, values);
  if ('error' in parsed) return { error: parsed.error, values };

  const { data: last, error: lastError } = await supabase.from('formula_versions').select('version_number').eq('formula_id', formulaId).order('version_number', { ascending: false }).limit(1).maybeSingle();
  if (lastError) return { error: `No se pudo leer el historial: ${lastError.message}`, values };

  const result = await insertVersion(supabase, userId, formulaId, (last?.version_number ?? 0) + 1, parsed.version);
  if ('error' in result) return { error: result.error ?? 'No se pudo crear la versión.', values };

  revalidatePath('/formulas');
  revalidatePath(`/formulas/${formulaId}`);
  redirect(`/formulas/${formulaId}?guardado=1`);
}

// Datos generales (nombre, categoría, molde, foto, notas): no forman parte de la receta, se actualizan directo.
export async function updateFormulaInfo(_prev: FormulaFormState, formData: FormData): Promise<FormulaFormState> {
  const formulaId = String(formData.get('formula_id') ?? '');
  const values = readValues(formData);
  if (!values.name) return { error: 'Escribí un nombre para la fórmula.', values };
  if (values.photo_url && !/^https?:\/\//i.test(values.photo_url)) return { error: 'La foto debe ser una dirección que empiece con http:// o https://.', values };

  const { supabase, userId } = await auth();
  const moldError = await checkMold(supabase, userId, values.mold_id);
  if (moldError) return { error: moldError, values };

  const { data, error } = await supabase
    .from('formulas')
    .update({ name: values.name, category: values.category || null, mold_id: values.mold_id || null, photo_url: values.photo_url || null, notes: values.notes || null })
    .eq('id', formulaId)
    .eq('user_id', userId)
    .select('id');
  if (error) return { error: `No se pudieron guardar los datos: ${error.message}`, values };
  if (!data?.length) return { error: 'No se encontró la fórmula.', values };

  revalidatePath('/formulas');
  revalidatePath(`/formulas/${formulaId}`);
  redirect(`/formulas/${formulaId}?guardado=1`);
}

async function setFormulaStatus(formData: FormData, status: 'active' | 'archived') {
  const formulaId = String(formData.get('formula_id') ?? '');
  const { supabase, userId } = await auth();
  // Restaurar vuelve a sumar una fórmula en uso, así que respeta el límite del plan.
  const limitError = status === 'active' ? await createLimitError(supabase, userId, 'formulas') : null;
  if (limitError) redirect(`/formulas/${formulaId}?error=${encodeURIComponent(limitError)}`);
  // Archivar no borra la fórmula ni sus versiones.
  const { data, error } = await supabase.from('formulas').update({ status }).eq('id', formulaId).eq('user_id', userId).select('id');
  const failure = error?.message ?? (!data?.length ? 'No se encontró la fórmula.' : null);
  if (failure) redirect(`/formulas/${formulaId}?error=${encodeURIComponent(failure.slice(0, 300))}`);
  revalidatePath('/formulas');
  revalidatePath(`/formulas/${formulaId}`);
  redirect(status === 'archived' ? `/formulas?archivada=${formulaId}` : `/formulas/${formulaId}`);
}

export async function archiveFormula(formData: FormData) {
  await setFormulaStatus(formData, 'archived');
}

export async function restoreFormula(formData: FormData) {
  await setFormulaStatus(formData, 'active');
}

// Crea una fórmula independiente con una copia de la versión actual (sus ingredientes incluidos).
export async function duplicateFormula(formData: FormData) {
  const formulaId = String(formData.get('formula_id') ?? '');
  const { supabase, userId } = await auth();
  const fail = (message: string) => redirect(`/formulas/${formulaId}?error=${encodeURIComponent(message.slice(0, 300))}`);

  const { data: source } = await supabase.from('formulas').select('activity_id,mold_id,name,category,photo_url,notes,current_version_id').eq('id', formulaId).eq('user_id', userId).maybeSingle();
  if (!source) return fail('No se encontró la fórmula.');
  const limitError = await createLimitError(supabase, userId, 'formulas');
  if (limitError) return fail(limitError);

  let version: VersionData = { yield_quantity: 1, water_percentage: null, notes: null, items: [] };
  if (source.current_version_id) {
    const { data: current } = await supabase.from('formula_versions').select('yield_quantity,water_percentage,notes').eq('id', source.current_version_id).maybeSingle();
    const { data: items, error: itemsError } = await supabase.from('formula_items').select('ingredient_type,material_id,quantity,unit,notes').eq('formula_version_id', source.current_version_id);
    if (itemsError) return fail(`No se pudieron leer los ingredientes: ${itemsError.message}`);
    if (current) version = { yield_quantity: Number(current.yield_quantity), water_percentage: current.water_percentage == null ? null : Number(current.water_percentage), notes: current.notes, items: (items ?? []).map(item => ({ ...item, quantity: Number(item.quantity) })) };
  }

  const { data: copy, error } = await supabase
    .from('formulas')
    .insert({ user_id: userId, activity_id: source.activity_id, mold_id: source.mold_id, name: `${source.name} (copia)`, category: source.category, photo_url: source.photo_url, notes: source.notes, status: 'active' })
    .select('id')
    .single();
  if (error || !copy) return fail(`No se pudo duplicar: ${error?.message}`);

  const result = await insertVersion(supabase, userId, copy.id, 1, version);
  if ('error' in result) {
    await supabase.from('formulas').delete().eq('id', copy.id).eq('user_id', userId);
    return fail(result.error ?? 'No se pudo duplicar.');
  }

  revalidatePath('/formulas');
  redirect(`/formulas/${copy.id}?guardado=1`);
}
