import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { archiveFormula, duplicateFormula, restoreFormula } from '../actions';
import { INGREDIENT_LABELS } from '../constants';
import { Scaler } from '../scaler';

const pageClass = 'mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 px-4 py-6 pb-10 text-neutral-900 dark:text-white lg:py-10';
const cardClass = 'rounded-3xl bg-white p-5 dark:bg-neutral-900';
const errorClass = 'rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200';
const secondaryButton = 'rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium dark:border-neutral-700';

type Item = { id: string; formula_version_id: string; material_id: string | null; ingredient_type: string; quantity: number; unit: string; notes: string | null };

function format(value: number | string | null) {
  return Number(value ?? 0).toLocaleString('es-AR', { maximumFractionDigits: 2 });
}

export default async function FormulaDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; guardado?: string }> }) {
  const { id } = await params;
  const { error, guardado } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <main className={pageClass}>Iniciá sesión para continuar.</main>;

  const { data: formula, error: loadError } = await supabase
    .from('formulas')
    .select('id,name,category,status,photo_url,notes,current_version_id,activities(name,code),molds(name)')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (loadError) return <main className={pageClass}><Link href="/formulas" className="text-sm text-neutral-500 dark:text-neutral-400">← Fórmulas</Link><div role="alert" className={errorClass}>No se pudo cargar la fórmula: {loadError.message}</div></main>;
  if (!formula) notFound();

  const { data: versions, error: versionsError } = await supabase
    .from('formula_versions')
    .select('id,version_number,water_percentage,yield_quantity,notes,created_at')
    .eq('formula_id', id)
    .order('version_number', { ascending: false });
  const versionIds = (versions ?? []).map(v => v.id);
  const { data: items, error: itemsError } = versionIds.length
    ? await supabase.from('formula_items').select('id,formula_version_id,material_id,ingredient_type,quantity,unit,notes').in('formula_version_id', versionIds)
    : { data: [] as Item[], error: null };
  const materialIds = [...new Set((items ?? []).map(item => item.material_id).filter((m): m is string => Boolean(m)))];
  const { data: materials } = materialIds.length
    ? await supabase.from('materials').select('id,name').in('id', materialIds)
    : { data: [] as { id: string; name: string }[] };
  const materialName = new Map((materials ?? []).map(m => [m.id, m.name]));

  const activity = Array.isArray(formula.activities) ? formula.activities[0] : formula.activities;
  const mold = Array.isArray(formula.molds) ? formula.molds[0] : formula.molds;
  const current = versions?.find(v => v.id === formula.current_version_id) ?? versions?.[0];
  const itemsOf = (versionId: string) => (items ?? []).filter(item => item.formula_version_id === versionId);
  const label = (item: Item) => [INGREDIENT_LABELS[item.ingredient_type] ?? item.ingredient_type, item.material_id ? materialName.get(item.material_id) ?? 'Material' : null].filter(Boolean).join(': ');
  const archived = formula.status === 'archived';
  const loadProblem = versionsError?.message ?? itemsError?.message;

  const ingredientList = (versionId: string) => {
    const list = itemsOf(versionId);
    if (!list.length) return <p className="text-sm text-neutral-500 dark:text-neutral-400">Sin ingredientes.</p>;
    return <ul className="grid gap-1 text-sm">{list.map(item => <li key={item.id} className="flex justify-between gap-4 border-b border-neutral-100 py-1 dark:border-neutral-800"><span>{label(item)}</span><span className="font-medium">{format(item.quantity)} {item.unit}</span></li>)}</ul>;
  };

  return (
    <main className={pageClass}>
      <header className="flex items-start justify-between gap-4">
        <div>
          <Link href="/formulas" className="text-sm text-neutral-500 dark:text-neutral-400">← Fórmulas</Link>
          <h1 className="mt-2 text-2xl font-semibold">{formula.name}</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{[activity?.name, formula.category || 'Sin categoría', mold ? `Molde: ${mold.name}` : null, archived ? 'Archivada' : 'Activa'].filter(Boolean).join(' · ')}</p>
          {formula.notes && <p className="mt-2 text-sm">{formula.notes}</p>}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- la foto es una URL externa elegida por la usuaria */}
        {formula.photo_url && <img src={formula.photo_url} alt="" className="h-16 w-16 rounded-xl object-cover" />}
      </header>

      {guardado && !error && <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">Guardado.</div>}
      {error && <div role="alert" className={errorClass}>{error}</div>}
      {loadProblem && <div role="alert" className={errorClass}>No se pudo cargar todo el historial: {loadProblem}</div>}

      <section className={cardClass}>
        <h2 className="font-semibold">Versión actual{current ? `: v${current.version_number}` : ''}</h2>
        {current
          ? <>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Rendimiento: {format(current.yield_quantity)} {Number(current.yield_quantity) === 1 ? 'pieza' : 'piezas'}{current.water_percentage != null ? ` · Agua: ${format(current.water_percentage)} %` : ''}</p>
            {current.notes && <p className="mt-1 text-sm">{current.notes}</p>}
            <div className="mt-4">{ingredientList(current.id)}</div>
          </>
          : <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Esta fórmula no tiene versiones.</p>}
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href={`/formulas/${id}/nueva-version`} className="rounded-xl bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">Editar receta (versión nueva)</Link>
          <Link href={`/formulas/${id}/editar`} className={secondaryButton}>Editar datos</Link>
          <form action={duplicateFormula}><input type="hidden" name="formula_id" value={id} /><button type="submit" className={secondaryButton}>Duplicar</button></form>
          <form action={archived ? restoreFormula : archiveFormula}><input type="hidden" name="formula_id" value={id} /><button type="submit" className={archived ? secondaryButton : `${secondaryButton} text-red-700 dark:text-red-300`}>{archived ? 'Reactivar' : 'Archivar'}</button></form>
        </div>
      </section>

      {current && <Scaler yieldQuantity={Number(current.yield_quantity)} items={itemsOf(current.id).map(item => ({ label: label(item), quantity: Number(item.quantity), unit: item.unit }))} />}

      <section>
        <h2 className="mb-2 font-semibold">Historial de versiones</h2>
        <div className="grid gap-2">
          {(versions ?? []).map(version => (
            <details key={version.id} className="rounded-xl border border-neutral-200 p-3 text-sm dark:border-neutral-800">
              <summary className="cursor-pointer">
                <b>v{version.version_number}</b>{version.id === current?.id ? ' · actual' : ''} · {new Date(version.created_at).toLocaleDateString('es-AR')} · rendimiento {format(version.yield_quantity)}{version.water_percentage != null ? ` · agua ${format(version.water_percentage)} %` : ''} · {itemsOf(version.id).length} ingredientes
              </summary>
              <div className="mt-3">
                {version.notes && <p className="mb-2">{version.notes}</p>}
                {ingredientList(version.id)}
              </div>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
