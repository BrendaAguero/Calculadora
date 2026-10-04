import Link from 'next/link';
import { notFound } from 'next/navigation';
import { addMaterialPrice, archiveMaterial, updateMaterial } from '../actions';

const units = ['g', 'kg', 'ml', 'l', 'unidad'];

export default async function MaterialDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <main className="p-6">Iniciá sesión para continuar.</main>;

  const { data: material } = await supabase.from('materials').select('id,name,default_unit,activity_id,status').eq('id', id).eq('user_id', user.id).single();
  if (!material) notFound();
  const { data: prices } = await supabase.from('material_prices').select('id,purchase_price,purchase_quantity,purchase_unit,unit_cost,currency,is_estimated,valid_from,valid_until').eq('material_id', id).order('valid_from', { ascending: false });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-6 pb-24">
      <header><Link href="/materials" className="text-sm text-neutral-500">← Materiales</Link><h1 className="mt-4 text-2xl font-semibold">{material.name}</h1><p className="text-sm text-neutral-500">{material.status === 'active' ? 'Activo' : 'Archivado'} · unidad {material.default_unit}</p></header>

      <form action={updateMaterial} className="grid gap-4 rounded-2xl border p-5">
        <input type="hidden" name="material_id" value={id} />
        <label className="grid gap-1 text-sm font-medium">Nombre<input name="name" defaultValue={material.name} required className="rounded-xl border p-3 font-normal" /></label>
        <label className="grid gap-1 text-sm font-medium">Unidad de referencia<select name="default_unit" defaultValue={material.default_unit} className="rounded-xl border p-3 font-normal">{units.map(unit => <option key={unit}>{unit}</option>)}</select></label>
        <label className="grid gap-1 text-sm font-medium">Actividad<input name="activity_id" defaultValue={material.activity_id ?? ''} placeholder="Vacío = compartido" className="rounded-xl border p-3 font-normal" /></label>
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
