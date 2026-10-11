import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getOwnedActivities } from '@/lib/access/activities';
import { NoActivities } from '@/components/no-activities';
import { createMold } from '../actions';
import { MoldForm } from '../mold-form';

export default async function NewMoldPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { activities, error } = await getOwnedActivities(supabase, user.id);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-5 px-4 py-6 pb-10 text-neutral-900 dark:text-white lg:py-10">
      <header>
        <Link href="/gestion/moldes" className="text-sm text-neutral-500 dark:text-neutral-400">← Volver a moldes</Link>
        <h1 className="mt-3 text-2xl font-semibold">Nuevo molde</h1>
      </header>
      {error
        ? <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">No se pudieron cargar tus actividades: {error}</div>
        : !activities.length
          ? <NoActivities />
          : <MoldForm activities={activities.map(({ id, name, code }) => ({ id, name, code }))} action={createMold} submitLabel="Guardar molde" />}
    </main>
  );
}
