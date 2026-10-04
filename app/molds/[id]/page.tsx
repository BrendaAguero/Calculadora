import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { archiveMold, updateMold } from '@/lib/molds/actions';

export default async function MoldDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <main className="p-6">Iniciá sesión para ver el molde.</main>;

  const [{ data: mold }, { data: userActivities }] = await Promise.all([
    supabase.from('molds').select('id,name,photo_url,reference_measurement_value,reference_measurement_unit,cost,estimated_uses,notes,status,activity_id').eq('id', id).eq('user_id', user.id).maybeSingle(),
    supabase.from('user_activities').select('activity_id, activities(id,name)').eq('user_id', user.id).eq('status', 'active'),
  ]);
  if (!mold) notFound();
  const activities = (userActivities ?? []).map((row: any) => row.activities).filter(Boolean);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 pb-24">
      <div className="flex items-center justify-between"><Link href="/molds" className="text-sm text-neutral-500">← Moldes</Link><span className={`rounded-full px-2.5 py-1 text-xs ${mold.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-500'}`}>{mold.status === 'active' ? 'Activo' : 'Archivado'}</span></div>
      {mold.photo_url && <img src={mold.photo_url} alt="" className="mt-5 h-56 w-full rounded-2xl object-cover" />}
      <h1 className="mt-5 text-2xl font-semibold">{mold.name}</h1>

      <form action={updateMold} className="mt-6 grid gap-4">
        <input type="hidden" name="id" value={mold.id} />
        <label className="grid gap-2 text-sm font-medium">Nombre<input name="name" required defaultValue={mold.name} className="rounded-xl border p-3 font-normal" /></label>
        <label className="grid gap-2 text-sm font-medium">Actividad<select name="activity_id" required defaultValue={mold.activity_id} className="rounded-xl border p-3 font-normal">{activities.map((activity: any) => <option key={activity.id} value={activity.id}>{activity.name}</option>)}</select></label>
        <label className="grid gap-2 text-sm font-medium">Foto (URL)<input name="photo_url" type="url" defaultValue={mold.photo_url ?? ''} className="rounded-xl border p-3 font-normal" /></label>
        <div className="grid grid-cols-2 gap-3"><label className="grid gap-2 text-sm font-medium">Medida de referencia<input name="reference_measurement_value" inputMode="decimal" defaultValue={mold.reference_measurement_value ?? ''} className="rounded-xl border p-3 font-normal" /></label><label className="grid gap-2 text-sm font-medium">Unidad<select name="reference_measurement_unit" defaultValue={mold.reference_measurement_unit ?? 'g'} className="rounded-xl border p-3 font-normal"><option value="g">g</option><option value="kg">kg</option><option value="ml">ml</option><option value="l">l</option><option value="unidad">unidad</option></select></label></div>
        <div className="grid grid-cols-2 gap-3"><label className="grid gap-2 text-sm font-medium">Costo<input name="cost" inputMode="decimal" defaultValue={mold.cost ?? ''} className="rounded-xl border p-3 font-normal" /></label><label className="grid gap-2 text-sm font-medium">Usos estimados<input name="estimated_uses" inputMode="numeric" defaultValue={mold.estimated_uses ?? ''} className="rounded-xl border p-3 font-normal" /></label></div>
        <label className="grid gap-2 text-sm font-medium">Notas<textarea name="notes" rows={4} defaultValue={mold.notes ?? ''} className="rounded-xl border p-3 font-normal" /></label>
        <button type="submit" className="rounded-xl bg-neutral-900 px-4 py-3 font-medium text-white">Guardar cambios</button>
      </form>

      {mold.status === 'active' && <form action={archiveMold} className="mt-3"><input type="hidden" name="id" value={mold.id} /><button type="submit" className="w-full rounded-xl border border-red-200 px-4 py-3 text-sm font-medium text-red-700">Archivar molde</button></form>}
    </main>
  );
}
