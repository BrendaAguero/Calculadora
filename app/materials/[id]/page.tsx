import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOwnedActivities } from '@/lib/access/activities';
import { addMaterialPrice, archiveMaterial, updateMaterial } from '../actions';

const units = ['g', 'kg', 'ml', 'l', 'unidad'];

export default async function MaterialDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const { error } = await searchParams;
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <main className="p-6">Iniciá sesión para continuar.</main>;

  const { data: material } = await supabase.from('materials').select('id,name,default_unit,activity_id,status').eq('id', id).eq('user_id', user.id).single();
  if (!material) notFound();
  const { activities } = await getOwnedActivities(supabase, user.id);
  // Si el material tiene una actividad que la usuaria ya no tiene, se muestra igual para no perderla.
  const { data: linked } = material.activity_id && !activities.some(a => a.id === material.activity_id)
    ? await supabase.from('activities').select('id,name').eq('id', material.activity_id).maybeSingle()
    : { data: null };
  const activityOptions = [...activities.map(a => ({ id: a.id, name: a.name })), ...(linked ? [linked] : [])];
  const { data: prices } = await supabase.from('material_prices').select('id,purchase_price,purchase_quantity,purchase_unit,unit_cost,currency,is_estimated,valid_from,valid_until').eq('material_id', id).order('valid_from', { ascending: false });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-6 pb-24">
      <header><Link href="/materials" className="text-sm text-neutral-500">← Materiales</Link><h1 className="mt-4 text-2xl font-semibold">{material.name}</h1><p className="text-sm text-neutral-500">{material.status === 'active' ? 'Activo' : 'Archivado'} · unidad {material.default_unit}</p></header>

      {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{error}</div>}
      <form action={updateMaterial} className="grid gap-4 rounded-2xl border p-5">
        <input type="hidden" name="material_id" value={id} />
        <label className="grid gap-1 text-sm font-medium">Nombre<input name="name" defaultValue={material.name} required className="rounded-xl border p-3 font-normal" /></label>
        <label className="grid gap-1 text-sm font-medium">Unidad de referencia<select name="default_unit" defaultValue={material.default_unit} className="rounded-xl border p-3 font-normal">{units.map(unit => <option key={unit}>{unit}</option>)}</select></label>
        <label className="grid gap-1 text-sm font-medium">Actividad<select name="activity_id" defaultValue={material.activity_id ?? ''} className="rounded-xl border p-3 font-normal"><option value="">Compartido (todas mis actividades)</option>{activityOptions.map(activity => <option key={activity.id} value={activity.id}>{activity.name}</option>)}</select></label>
        <button className="rounded-xl bg-neutral-900 px-4 py-3 font-medium text-white">Guardar cambios</button>
      </form>

      {material.status === 'active' && <form action={archiveMaterial}><input type="hidden" name="material_id" value={id} /><button className="text-sm text-red-600">Archivar material</button></form>}

      <section className="grid gap-3">
        <div><h2 className="text-lg font-semibold">Agregar precio</h2><p className="text-sm text-neutral-500">Nunca reemplaza los precios anteriores.</p></div>
        <form action={addMaterialPrice} className="grid gap-3 rounded-2xl border p-5">
          <input type="hidden" name="material_id" value={id} /><input type="hidden" name="default_unit" value={material.default_unit} />
          <label className="grid gap-1 text-sm font-medium">Precio<input name="purchase_price" inputMode="decimal" required className="rounded-xl border p-3 font-normal" /></label>
          <div className="grid grid-cols-2 gap-3"><label className="grid gap-1 text-sm font-medium">Cantidad<input name="purchase_quantity" inputMode="decimal" required className="rounded-xl border p-3 font-normal" /></label><label className="grid gap-1 text-sm font-medium">Unidad<select name="purchase_unit" defaultValue={material.default_unit} className="rounded-xl border p-3 font-normal">{units.map(unit => <option key={unit}>{unit}</option>)}</select></label></div>
          <button className="rounded-xl border px-4 py-3 font-medium">Agregar precio</button>
        </form>
      </section>

      <section className="grid gap-3"><h2 className="text-lg font-semibold">Historial de precios</h2>{(prices ?? []).map(price => <article key={price.id} className="rounded-2xl border p-4"><div className="flex justify-between gap-3"><strong>${Number(price.purchase_price).toFixed(2)} {price.currency}</strong><span className="text-sm text-neutral-500">{new Date(price.valid_from).toLocaleDateString('es-AR')}</span></div><p className="mt-1 text-sm text-neutral-600">{price.purchase_quantity} {price.purchase_unit} · costo unitario: ${Number(price.unit_cost).toFixed(4)} / {material.default_unit}</p></article>)}</section>
    </main>
  );
}
