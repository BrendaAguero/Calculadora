import Link from 'next/link';
import { HelpTip } from '@/components/help-tip';
import { createClient } from '@/lib/supabase/server';

const pageClass = 'mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 px-4 py-6 pb-10 text-neutral-900 dark:text-white lg:py-10';

export default async function FormulasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <main className={pageClass}>Iniciá sesión para ver tus fórmulas.</main>;

  const { data: formulas, error } = await supabase
    .from('formulas')
    .select('id,name,category,status,activities(name),formula_versions!formula_versions_formula_id_fkey(version_number)')
    .eq('user_id', user.id)
    .order('status', { ascending: true })
    .order('name', { ascending: true });

  return (
    <main className={pageClass}>
      <header className="flex items-center justify-between gap-4">
        <div>
          <Link href="/gestion" className="text-sm text-neutral-500 dark:text-neutral-400">← Gestión</Link>
          <h1 className="text-2xl font-semibold">Fórmulas</h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Recetas con ingredientes y versiones: cada cambio crea una versión nueva y las anteriores se conservan.</p>
        </div>
        <Link href="/formulas/new" className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">Nueva</Link>
      </header>
      <HelpTip guide="empezar"><p>Una fórmula guarda tu mezcla (por ejemplo, yeso con 75 % de agua) para usarla en la calculadora y en tus productos.</p><p>Cada cambio crea una versión nueva.</p></HelpTip>

      {/* Un error de consulta nunca debe verse como "no tenés fórmulas". */}
      {error
        ? <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">No se pudieron cargar las fórmulas: {error.message}</div>
        : !formulas.length
          ? <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">Todavía no tenés fórmulas. Creá la primera.</div>
          : <section className="grid gap-3">
            {formulas.map(formula => {
              const activity = Array.isArray(formula.activities) ? formula.activities[0] : formula.activities;
              const versions = formula.formula_versions?.length ?? 0;
              return (
                <Link key={formula.id} href={`/formulas/${formula.id}`} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-medium">{formula.name}</h2>
                      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{[activity?.name, formula.category || 'Sin categoría', `${versions} ${versions === 1 ? 'versión' : 'versiones'}`].filter(Boolean).join(' · ')}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs ${formula.status === 'active' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'}`}>{formula.status === 'active' ? 'Activa' : 'Archivada'}</span>
                  </div>
                </Link>
              );
            })}
          </section>}
    </main>
  );
}
