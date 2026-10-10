import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

const pageClass = 'mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 bg-white px-4 py-6 pb-24 text-neutral-900 dark:bg-neutral-950 dark:text-white';

function money(value: number | string | null) {
  return Number(value ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function MoldesPage({ searchParams }: { searchParams: Promise<{ guardado?: string }> }) {
  const { guardado } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <main className={pageClass}>Iniciá sesión para ver tus moldes.</main>;

  const { data: molds, error } = await supabase
    .from('molds')
    .select('id,name,photo_url,reference_measurement_value,reference_measurement_unit,cost,estimated_uses,status')
    .eq('user_id', user.id)
    .order('status', { ascending: true })
    .order('name', { ascending: true });

  return (
    <main className={pageClass}>
      <header className="flex items-center justify-between gap-4">
        <div>
          <Link href="/gestion" className="text-sm text-neutral-500 dark:text-neutral-400">← Gestión</Link>
          <h1 className="text-2xl font-semibold">Moldes</h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Guardá la medición de referencia, el costo y los usos de cada molde.</p>
        </div>
        <Link href="/gestion/moldes/new" className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">Nuevo</Link>
      </header>

      {guardado && !error && <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">Molde guardado.</div>}

      {/* Un error de consulta nunca debe verse como "no tenés moldes". */}
      {error
        ? <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">No se pudieron cargar los moldes: {error.message}</div>
        : !molds.length
          ? <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">Todavía no tenés moldes. Creá el primero para vincularlo después a tus productos.</div>
          : <section className="grid gap-3">
            {molds.map(mold => (
              <Link key={mold.id} href={`/gestion/moldes/${mold.id}`} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900">
                <div className="flex gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element -- la foto es una URL externa elegida por la usuaria */}
                  {mold.photo_url ? <img src={mold.photo_url} alt="" className="h-20 w-20 rounded-xl object-cover" /> : <div className="h-20 w-20 rounded-xl bg-neutral-100 dark:bg-neutral-800" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="font-medium">{mold.name}</h2>
                      <span className={`rounded-full px-2.5 py-1 text-xs ${mold.status === 'active' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'}`}>{mold.status === 'active' ? 'Activo' : 'Archivado'}</span>
                    </div>
                    <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">Medición: {Number(mold.reference_measurement_value)} {mold.reference_measurement_unit ?? ''}</p>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">Costo: ${money(mold.cost)}{mold.estimated_uses ? ` · Usos estimados: ${mold.estimated_uses}` : ''}</p>
                  </div>
                </div>
              </Link>
            ))}
          </section>}
    </main>
  );
}
