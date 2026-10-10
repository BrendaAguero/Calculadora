import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getOwnedActivities } from '@/lib/access/activities';
import { createFormula } from '../actions';
import { loadFormOptions } from '../data';
import { FormulaForm } from '../formula-form';
import { NoActivities } from '@/components/no-activities';

export default async function NewFormulaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ activities, error: activitiesError }, options] = await Promise.all([getOwnedActivities(supabase, user.id), loadFormOptions(supabase, user.id)]);
  const primary = activities.find(activity => activity.isPrimary) ?? activities[0];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-5 bg-white px-4 py-6 pb-24 text-neutral-900 dark:bg-neutral-950 dark:text-white">
      <header>
        <Link href="/formulas" className="text-sm text-neutral-500 dark:text-neutral-400">← Volver a fórmulas</Link>
        <h1 className="mt-3 text-2xl font-semibold">Nueva fórmula</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Se guarda como versión 1. Cada cambio posterior crea una versión nueva.</p>
      </header>
      {(activitiesError ?? options.error) && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">No se pudieron cargar tus datos: {activitiesError ?? options.error}</div>}
      {!activitiesError && !activities.length
        ? <NoActivities />
        : <FormulaForm mode="create" action={createFormula} activities={activities} materials={options.materials} molds={options.molds} initialValues={{ activity_id: primary?.id ?? '' }} submitLabel="Crear fórmula" />}
    </main>
  );
}
