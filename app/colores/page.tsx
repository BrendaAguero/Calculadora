import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FeatureLocked } from '@/components/feature-locked';
import { getAccessSnapshot, hasFeature } from '@/lib/access/permissions';
import { cleanPigments, PIGMENT_UNITS } from '@/lib/colors';
import { createClient } from '@/lib/supabase/server';
import { cardClass, errorBox, okBox, pageClass } from '@/lib/ui';
import { createRecipe } from './actions';
import { RecipeForm } from './recipe-form';

export const metadata = { title: 'Recetas de color · Calculadora Emprender' };

const unitLabel = (unit: string) => PIGMENT_UNITS.find((u) => u.value === unit)?.label ?? unit;

export default async function ColorsPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { error, ok } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const snapshot = await getAccessSnapshot();
  const allowed = Boolean(snapshot && hasFeature(snapshot, 'COLORES'));
  const { data: recipes, error: loadError } = await supabase.from('color_recipes').select('id,name,material,base_grams,pigments,photo').eq('user_id', user.id).order('created_at', { ascending: false }).limit(300);

  return (
    <main className={pageClass}>
      <header>
        <Link href="/" className="text-sm text-neutral-500 dark:text-neutral-400">← Inicio</Link>
        <h1 className="text-2xl font-semibold">Recetas de color</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Guardá cuánto pigmento lleva cada color y repetilo igual en cualquier cantidad.</p>
      </header>
      {ok && <div role="status" className={okBox}>{ok}</div>}
      {(error || loadError) && <div role="alert" className={errorBox}>{error ?? 'No se pudieron cargar tus recetas.'}</div>}

      {!allowed && <FeatureLocked title="Recetas de color es un módulo extra." note="También viene con la Mensualidad Plus." linkLabel="Ver el módulo">Guardá cada color con su pigmento y su foto, y la app te dice cuánto poner para cualquier cantidad de mezcla.</FeatureLocked>}

      {Boolean(recipes?.length) && (
        <section className="grid gap-3 sm:grid-cols-2">
          {recipes!.map((r) => (
            <Link key={r.id} href={`/colores/${r.id}`} className="flex gap-3 rounded-2xl border border-neutral-200 bg-white p-3 transition hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900">
              {r.photo
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={r.photo} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                : <span className="h-16 w-16 shrink-0 rounded-xl bg-gradient-to-br from-orange-100 to-rose-200 dark:from-orange-950 dark:to-rose-900" aria-hidden="true" />}
              <span className="min-w-0">
                <span className="block truncate font-semibold">{r.name}</span>
                <span className="block text-xs text-neutral-500">{[r.material, `${Number(r.base_grams).toLocaleString('es-AR')} g de mezcla`].filter(Boolean).join(' · ')}</span>
                <span className="mt-1 block truncate text-sm text-neutral-600 dark:text-neutral-400">{cleanPigments(r.pigments).map((p) => `${p.name} ${p.amount.toLocaleString('es-AR')} ${unitLabel(p.unit)}`).join(' + ')}</span>
              </span>
            </Link>
          ))}
        </section>
      )}
      {allowed && !recipes?.length && <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">Todavía no guardaste colores. Cargá el primero acá abajo.</div>}

      {allowed && (
        <section className={cardClass}>
          <h2 className="mb-3 font-semibold">Nuevo color</h2>
          <RecipeForm action={createRecipe} submitLabel="Guardar color" />
        </section>
      )}
    </main>
  );
}
