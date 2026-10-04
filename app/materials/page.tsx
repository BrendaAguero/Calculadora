import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function MaterialsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <main className="p-6">Iniciá sesión para ver tus materiales.</main>;

  const { data: materials } = await supabase
    .from('materials')
    .select('id,name,default_unit,status,current_price_id')
    .eq('user_id', user.id)
    .order('status', { ascending: true })
    .order('name', { ascending: true });

  const priceIds = (materials ?? []).map(m => m.current_price_id).filter(Boolean) as string[];
  const { data: prices } = priceIds.length
    ? await supabase.from('material_prices').select('id,unit_cost,currency').in('id', priceIds)
    : { data: [] as any[] };
  const priceMap = new Map((prices ?? []).map(price => [price.id, price]));

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 px-4 py-6 pb-24">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-neutral-500">Gestión</p>
          <h1 className="text-2xl font-semibold">Materiales</h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Precios con historial: los costos usados en cálculos no se modifican.</p>
        </div>
        <Link href="/materials/new" className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white">Nuevo</Link>
      </header>

      <section className="grid gap-3">
        {(materials ?? []).map(material => {
          const current = material.current_price_id ? priceMap.get(material.current_price_id) : null;
          return (
            <Link key={material.id} href={`/materials/${material.id}`} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-medium">{material.name}</h2>
                  <p className="mt-1 text-sm text-neutral-500">Costo por {material.default_unit}: {current ? `$${Number(current.unit_cost).toFixed(2)} ${current.currency}` : 'Sin precio'}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs ${material.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-500'}`}>
                  {material.status === 'active' ? 'Activo' : 'Archivado'}
                </span>
              </div>
            </Link>
          );
        })}
        {!materials?.length && <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-neutral-500">Todavía no tenés materiales. Creá el primero para empezar.</div>}
      </section>
    </main>
  );
}
