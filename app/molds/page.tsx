import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function MoldsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <main className="p-6">Iniciá sesión para ver tus moldes.</main>;

  const { data: molds } = await supabase
    .from('molds')
    .select('id,name,photo_url,reference_measurement_value,reference_measurement_unit,cost,estimated_uses,status,activity_id')
    .eq('user_id', user.id)
    .order('status', { ascending: true })
    .order('name', { ascending: true });

  const activityIds = [...new Set((molds ?? []).map(m => m.activity_id).filter(Boolean))];
  const { data: activities } = activityIds.length
    ? await supabase.from('activities').select('id,name').in('id', activityIds)
    : { data: [] as { id: string; name: string }[] };
  const activityMap = new Map((activities ?? []).map(a => [a.id, a.name]));

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 px-4 py-6 pb-24">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-neutral-500">Gestión</p>
          <h1 className="text-2xl font-semibold">Moldes</h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Guardá tus moldes, medidas de referencia, costo y usos estimados.</p>
        </div>
        <Link href="/molds/new" className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white">Nuevo</Link>
      </header>

      <section className="grid gap-3">
        {(molds ?? []).map(mold => (
          <Link key={mold.id} href={`/molds/${mold.id}`} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-start gap-4">
              {mold.photo_url ? <img src={mold.photo_url} alt="" className="h-16 w-16 rounded-xl object-cover" /> : <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-neutral-100 text-xs text-neutral-500 dark:bg-neutral-800">Sin foto</div>}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-medium">{mold.name}</h2>
                    <p className="mt-1 text-xs text-neutral-500">{activityMap.get(mold.activity_id) ?? 'Actividad'}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs ${mold.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-500'}`}>{mold.status === 'active' ? 'Activo' : 'Archivado'}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-500">
                  {mold.reference_measurement_value != null && <span className="rounded-full bg-neutral-100 px-2 py-1 dark:bg-neutral-800">Medida: {mold.reference_measurement_value} {mold.reference_measurement_unit ?? ''}</span>}
                  {mold.cost != null && <span className="rounded-full bg-neutral-100 px-2 py-1 dark:bg-neutral-800">Costo: ${Number(mold.cost).toFixed(2)}</span>}
                  {mold.estimated_uses != null && <span className="rounded-full bg-neutral-100 px-2 py-1 dark:bg-neutral-800">Usos: {mold.estimated_uses}</span>}
                </div>
              </div>
            </div>
          </Link>
        ))}
        {!molds?.length && <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-neutral-500">Todavía no tenés moldes. Creá el primero para empezar.</div>}
      </section>
    </main>
  );
}
