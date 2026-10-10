import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { updateFormulaInfo } from '../../actions';
import { loadFormOptions } from '../../data';
import { FormulaForm } from '../../formula-form';

export default async function EditFormulaInfoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: formula } = await supabase.from('formulas').select('id,name,category,mold_id,photo_url,notes').eq('id', id).eq('user_id', user.id).maybeSingle();
  if (!formula) notFound();
  const options = await loadFormOptions(supabase, user.id);
  // Si el molde vinculado está archivado, se muestra igual para no perderlo al guardar.
  const linkedMold = formula.mold_id && !options.molds.some(m => m.id === formula.mold_id)
    ? (await supabase.from('molds').select('id,name').eq('id', formula.mold_id).maybeSingle()).data
    : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-5 bg-white px-4 py-6 pb-24 text-neutral-900 dark:bg-neutral-950 dark:text-white">
      <header>
        <Link href={`/formulas/${id}`} className="text-sm text-neutral-500 dark:text-neutral-400">← {formula.name}</Link>
        <h1 className="mt-3 text-2xl font-semibold">Editar datos</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Nombre, categoría, molde, foto y notas. Para cambiar ingredientes, rendimiento o agua usá «Editar receta», que crea una versión nueva.</p>
      </header>
      <FormulaForm
        mode="info"
        action={updateFormulaInfo}
        formulaId={id}
        molds={linkedMold ? [...options.molds, { ...linkedMold, name: `${linkedMold.name} (archivado)` }] : options.molds}
        initialValues={{ name: formula.name, category: formula.category ?? '', mold_id: formula.mold_id ?? '', photo_url: formula.photo_url ?? '', notes: formula.notes ?? '' }}
        submitLabel="Guardar datos"
      />
    </main>
  );
}
