import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function MoldesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <main className="p-6">Iniciá sesión para ver tus moldes.</main>;
  const { data: molds } = await supabase.from('molds').select('id,name,photo_url,water_capacity,water_unit,plaster_per_piece,cost,estimated_uses,status,notes').eq('user_id', user.id).order('status', { ascending: true }).order('name', { ascending: true });

  return <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 px-4 py-6 pb-24">
    <header className="flex items-center justify-between gap-4"><div><p className="text-sm text-neutral-500">Gestión</p><h1 className="text-2xl font-semibold">Moldes</h1><p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Guardá la capacidad de agua, costo y usos de cada molde.</p></div><Link href="/gestion/moldes/new" className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white">Nuevo</Link></header>
    <section className="grid gap-3">{(molds ?? []).map(mold => <Link key={mold.id} href={`/gestion/moldes/${mold.id}`} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900"><div className="flex gap-4">{mold.photo_url ? <img src={mold.photo_url} alt="" className="h-20 w-20 rounded-xl object-cover" /> : <div className="h-20 w-20 rounded-xl bg-neutral-100 dark:bg-neutral-800" />}<div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><h2 className="font-medium">{mold.name}</h2><span className={`rounded-full px-2.5 py-1 text-xs ${mold.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-500'}`}>{mold.status === 'active' ? 'Activo' : 'Archivado'}</span></div><p className="mt-2 text-sm text-neutral-500">Capacidad: {Number(mold.water_capacity)} {mold.water_unit}</p><p className="text-sm text-neutral-500">Costo: ${Number(mold.cost).toFixed(2)}{mold.estimated_uses ? ` · Usos estimados: ${mold.estimated_uses}` : ''}</p></div></div></Link>)}{!molds?.length && <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-neutral-500">Todavía no tenés moldes. Creá el primero para vincularlo después a tus productos.</div>}</section>
  </main>;
}
