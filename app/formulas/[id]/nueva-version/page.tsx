import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createVersion } from '../../actions';
import { loadFormOptions } from '../../data';
import { FormulaForm } from '../../formula-form';

export default async function NewVersionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: formula } = await supabase.from('formulas').select('id,name,current_version_id,activities(code)').eq('id', id).eq('user_id', user.id).maybeSingle();
  if (!formula) notFound();

  // El formulario arranca con la versión actual; al guardar se crea una nueva y la actual queda intacta.
  const [{ data: current }, { data: items }, options] = await Promise.all([
    formula.current_version_id
      ? supabase.from('formula_versions').select('version_number,yield_quantity,water_percentage').eq('id', formula.current_version_id).maybeSingle()
      : Promise.resolve({ data: null }),
    formula.current_version_id
      ? supabase.from('formula_items').select('ingredient_type,material_id,quantity,unit,notes').eq('formula_version_id', formula.current_version_id)
      : Promise.resolve({ data: [] }),
    loadFormOptions(supabase, user.id),
  ]);
  const activity = Array.isArray(formula.activities) ? formula.activities[0] : formula.activities;

  // Un material archivado que ya estaba en la receta sigue apareciendo como opción.
  const missing = (items ?? []).map(item => item.material_id).filter((m): m is string => Boolean(m) && !options.materials.some(o => o.id === m));
  const { data: extra } = missing.length ? await supabase.from('materials').select('id,name,default_unit').in('id', missing) : { data: [] };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-5 bg-white px-4 py-6 pb-24 text-neutral-900 dark:bg-neutral-950 dark:text-white">
      <header>
        <Link href={`/formulas/${id}`} className="text-sm text-neutral-500 dark:text-neutral-400">← {formula.name}</Link>
        <h1 className="mt-3 text-2xl font-semibold">Editar receta</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Se guardará como versión {(current?.version_number ?? 0) + 1}. La versión {current?.version_number ?? 1} queda guardada sin cambios en el historial.</p>
      </header>
      <FormulaForm
        mode="version"
        action={createVersion}
        formulaId={id}
        activityCode={activity?.code}
        materials={[...options.materials, ...(extra ?? []).map(m => ({ ...m, name: `${m.name} (archivado)` }))]}
        initialValues={{
          yield_quantity: current ? String(current.yield_quantity) : '1',
          water_percentage: current?.water_percentage == null ? '' : String(current.water_percentage),
          items: (items ?? []).map(item => ({ ingredient_type: item.ingredient_type, material_id: item.material_id ?? '', quantity: String(item.quantity), unit: item.unit, notes: item.notes ?? '' })),
        }}
        submitLabel="Guardar como versión nueva"
      />
    </main>
  );
}
