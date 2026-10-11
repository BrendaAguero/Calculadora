import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getOwnedActivities } from '@/lib/access/activities';
import { NoActivities } from '@/components/no-activities';
import { createProduct } from '../actions';
import { ProductForm } from '../product-form';

export default async function NewProductPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ activities, error }, formulas, molds] = await Promise.all([
    getOwnedActivities(supabase, user.id),
    supabase.from('formulas').select('id,name,activity_id').eq('user_id', user.id).eq('status', 'active').order('name'),
    supabase.from('molds').select('id,name,activity_id').eq('user_id', user.id).eq('status', 'active').order('name'),
  ]);
  const loadError = error ?? formulas.error?.message ?? molds.error?.message;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-5 px-4 py-6 pb-10 text-neutral-900 dark:text-white lg:py-10">
      <header>
        <Link href="/gestion/productos" className="text-sm text-neutral-500 dark:text-neutral-400">← Volver a productos</Link>
        <h1 className="mt-3 text-2xl font-semibold">Nuevo producto</h1>
      </header>
      {loadError && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">No se pudieron cargar tus datos: {loadError}</div>}
      {!error && !activities.length
        ? <NoActivities />
        : <ProductForm action={createProduct} activities={activities.map(({ id, name }) => ({ id, name }))} formulas={formulas.data ?? []} molds={molds.data ?? []} />}
    </main>
  );
}
