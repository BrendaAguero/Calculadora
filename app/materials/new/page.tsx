import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getOwnedActivities } from '@/lib/access/activities';
import { createMaterial } from '../actions';
import { MaterialTemplates } from './templates';

const units = ['g', 'kg', 'ml', 'l', 'unidad'];

export default async function NewMaterialPage({ searchParams }: { searchParams: Promise<{ returnTo?: string; error?: string }> }) {
  const params = await searchParams;
  const returnTo = params.returnTo || '/materials';
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { activities } = await getOwnedActivities(supabase, user.id);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-6">
      <header>
        <Link href={returnTo} className="text-sm text-neutral-500">← Volver</Link>
        <h1 className="mt-4 text-2xl font-semibold">Nuevo material</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Cargá lo que pagaste y cuánto vino. Con eso calculamos cuánto te cuesta cada gramo o unidad.</p>
      </header>

      {params.error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{params.error}</div>}
      <MaterialTemplates formId="nuevo-material" />
      <form id="nuevo-material" action={createMaterial} className="grid gap-4 rounded-3xl bg-white p-5 dark:bg-neutral-900">
        <label className="grid gap-1 text-sm font-medium">Nombre<input name="name" required placeholder="Ej.: Yeso" className="rounded-xl border p-3 font-normal" /></label>
        <label className="grid gap-1 text-sm font-medium">Unidad de referencia<select name="default_unit" defaultValue="g" className="rounded-xl border p-3 font-normal">{units.map(unit => <option key={unit}>{unit}</option>)}</select></label>
        <label className="grid gap-1 text-sm font-medium">Precio de compra<input name="purchase_price" inputMode="decimal" required placeholder="0" className="rounded-xl border p-3 font-normal" /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-sm font-medium">Cantidad comprada<input name="purchase_quantity" inputMode="decimal" required placeholder="1" className="rounded-xl border p-3 font-normal" /></label>
          <label className="grid gap-1 text-sm font-medium">Unidad comprada<select name="purchase_unit" defaultValue="g" className="rounded-xl border p-3 font-normal">{units.map(unit => <option key={unit}>{unit}</option>)}</select></label>
        </div>
        <label className="grid gap-1 text-sm font-medium">Actividad<select name="activity_id" defaultValue="" className="rounded-xl border p-3 font-normal"><option value="">Compartido (todas mis actividades)</option>{activities.map(activity => <option key={activity.id} value={activity.id}>{activity.name}</option>)}</select><span className="text-xs font-normal text-neutral-500">Elegí «Compartido» si lo usás en más de una actividad, por ejemplo un pigmento.</span></label>
        <p className="text-xs text-neutral-500">El precio queda registrado como historial. Si comprás nuevamente el mismo material, agregá un nuevo precio en su ficha.</p>
        <button className="rounded-xl bg-neutral-900 px-4 py-3 font-medium text-white">Guardar material</button>
      </form>
    </main>
  );
}
