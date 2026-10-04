import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function MoldesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <main className="min-h-screen bg-white p-6 text-neutral-900 dark:bg-neutral-950 dark:text-white">Iniciá sesión para ver tus moldes.</main>;
  const { data: molds, error } = await supabase
    .from('molds')
    .select('id,name,photo_url,reference_measurement_value,reference_measurement_unit,cost,estimated_uses,status,notes')
    .eq('user_id', user.id)
    .order('status', { ascending: true })
    .order('name', { ascending: true });

  return <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 bg-white px-4 py-6 pb-24 text-neutral-900 dark:bg-neutral-950 dark:text-white">
    <header className="flex items-center justify-between gap-4"><div><p className="text-sm text-neutral-500 dark:text-neutral-400">Gestión</p><h1 className="text-2xl font-semibold">Moldes</h1><p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Guardá la capacidad de agua, costo y usos de cada molde.</p></div><Link href="/gestion/moldes/new" className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">Nuevo</Link></header>
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">No se pudieron cargar los moldes: {error.message}</div>}
    <section className="grid gap-3">{(molds ?? []).map(mold => <Link key={mold.id} href={`/gestion/moldes/${mold.id}`} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900"><div className="flex gap-4">{mold.photo_url ? <img src={mold.photo_url} alt="" className="h-20 w-20 rounded-xl object-cover" /> : <div className="h-20 w-20 rounded-xl bg-neutral-100 dark:bg-neutral-800" />}<div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><h2 className="font-medium">{mold.name}</h2><span className={`rounded-full px-2.5 py-1 text-xs ${mold.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-500'}`}>{mold.status === 'active' ? 'Activo' : 'Archivado'}</span></div><p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">Capacidad: {Number(mold.reference_measurement_value)} {mold.reference_measurement_unit ?? ''}</p><p className="text-sm text-neutral-500 dark:text-neutral-400">Costo: ${Number(mold.cost ?? 0).toFixed(2)}{mold.estimated_uses ? ` · Usos estimados: ${mold.estimated_uses}` : ''}</p></div></div></Link>)}{!error && !molds?.length && <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">Todavía no tenés moldes. Creá el primero para vincularlo después a tus productos.</div>}</section>
  </main>;
}
