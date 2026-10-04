import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createMold } from '@/lib/molds/actions';

export default async function NewMoldPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <main className="p-6">Iniciá sesión para crear un molde.</main>;

  const { data: userActivities } = await supabase
    .from('user_activities')
    .select('activity_id, activities(id,name)')
    .eq('user_id', user.id)
    .eq('status', 'active');

  const activities = (userActivities ?? []).map((row: any) => row.activities).filter(Boolean);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 pb-24">
      <Link href="/molds" className="text-sm text-neutral-500">← Volver a moldes</Link>
      <h1 className="mt-4 text-2xl font-semibold">Nuevo molde</h1>
      <p className="mt-1 text-sm text-neutral-500">La medida de referencia es genérica: no asume qué material vas a usar.</p>

      <form action={createMold} className="mt-6 grid gap-4">
        <label className="grid gap-2 text-sm font-medium">Nombre<input name="name" required className="rounded-xl border p-3 font-normal" placeholder="Ej. Molde bandeja ovalada" /></label>
        <label className="grid gap-2 text-sm font-medium">Actividad<select name="activity_id" required className="rounded-xl border p-3 font-normal"><option value="">Elegí una actividad</option>{activities.map((activity: any) => <option key={activity.id} value={activity.id}>{activity.name}</option>)}</select></label>
        <label className="grid gap-2 text-sm font-medium">Foto (URL)<input name="photo_url" type="url" className="rounded-xl border p-3 font-normal" placeholder="https://..." /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-2 text-sm font-medium">Medida de referencia<input name="reference_measurement_value" inputMode="decimal" className="rounded-xl border p-3 font-normal" placeholder="300" /></label>
          <label className="grid gap-2 text-sm font-medium">Unidad<select name="reference_measurement_unit" className="rounded-xl border p-3 font-normal"><option value="g">g</option><option value="kg">kg</option><option value="ml">ml</option><option value="l">l</option><option value="unidad">unidad</option></select></label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-2 text-sm font-medium">Costo<input name="cost" inputMode="decimal" className="rounded-xl border p-3 font-normal" placeholder="0" /></label>
          <label className="grid gap-2 text-sm font-medium">Usos estimados<input name="estimated_uses" inputMode="numeric" className="rounded-xl border p-3 font-normal" placeholder="Ej. 50" /></label>
        </div>
        <label className="grid gap-2 text-sm font-medium">Notas<textarea name="notes" rows={4} className="rounded-xl border p-3 font-normal" placeholder="Detalles del molde..." /></label>
        <button type="submit" className="rounded-xl bg-neutral-900 px-4 py-3 font-medium text-white">Guardar molde</button>
      </form>
    </main>
  );
}
