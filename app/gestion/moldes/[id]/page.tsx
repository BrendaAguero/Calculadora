import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { archiveMold, restoreMold, updateMold } from '../actions';
import { MoldForm } from '../mold-form';

const pageClass = 'mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-5 px-4 py-6 pb-10 text-neutral-900 dark:text-white lg:py-10';
const errorClass = 'rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200';

export default async function MoldDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <main className={pageClass}>Iniciá sesión para continuar.</main>;

  const { data: mold, error: loadError } = await supabase
    .from('molds')
    .select('id,name,photo_url,reference_measurement_value,reference_measurement_unit,cost,estimated_uses,notes,status,activities(name,code)')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (loadError) {
    return <main className={pageClass}><Link href="/gestion/moldes" className="text-sm text-neutral-500 dark:text-neutral-400">← Volver a moldes</Link><div className={errorClass}>No se pudo cargar el molde: {loadError.message}</div></main>;
  }
  if (!mold) notFound();

  const archived = mold.status === 'archived';
  const activity = Array.isArray(mold.activities) ? mold.activities[0] : mold.activities;

  return (
    <main className={pageClass}>
      <header>
        <Link href="/gestion/moldes" className="text-sm text-neutral-500 dark:text-neutral-400">← Volver a moldes</Link>
        <h1 className="mt-3 text-2xl font-semibold">Editar molde</h1>
        {activity && <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Actividad: {activity.name}</p>}
        {archived && <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Este molde está archivado. Sus datos se conservan.</p>}
      </header>
      {error && <div role="alert" className={errorClass}>{error}</div>}
      <MoldForm
        action={updateMold}
        activityCode={activity?.code}
        moldId={mold.id}
        submitLabel="Guardar cambios"
        initialValues={{
          name: mold.name ?? '',
          photo_url: mold.photo_url ?? '',
          reference_measurement_value: mold.reference_measurement_value == null ? '' : String(mold.reference_measurement_value),
          reference_measurement_unit: mold.reference_measurement_unit ?? 'g',
          cost: mold.cost == null ? '' : String(mold.cost),
          estimated_uses: mold.estimated_uses == null ? '' : String(mold.estimated_uses),
          notes: mold.notes ?? '',
        }}
      />
      <form action={archived ? restoreMold : archiveMold}>
        <input type="hidden" name="mold_id" value={mold.id} />
        {archived
          ? <button type="submit" className="rounded-xl border border-neutral-300 px-4 py-3 text-sm font-medium text-neutral-800 dark:border-neutral-700 dark:text-neutral-200">Reactivar molde</button>
          : <button type="submit" className="rounded-xl border border-red-200 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900 dark:text-red-300">Archivar molde</button>}
      </form>
    </main>
  );
}
