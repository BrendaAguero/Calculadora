import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { SubmitButton } from '@/components/submit-button';
import { getAccessSnapshot, hasFeature } from '@/lib/access/permissions';
import { cleanPigments } from '@/lib/colors';
import { createClient } from '@/lib/supabase/server';
import { cardClass, errorBox, okBox, pageClass } from '@/lib/ui';
import { deleteRecipe, updateRecipe } from '../actions';
import { RecipeForm } from '../recipe-form';
import { ColorScaler } from './scaler';

export default async function ColorRecipePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) {
  const [{ id }, { error, ok }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const [{ data: recipe }, snapshot] = await Promise.all([
    supabase.from('color_recipes').select('id,name,material,base_grams,pigments,notes,photo').eq('id', id).eq('user_id', user.id).maybeSingle(),
    getAccessSnapshot(),
  ]);
  if (!recipe) notFound();
  const allowed = Boolean(snapshot && hasFeature(snapshot, 'COLORES'));
  const pigments = cleanPigments(recipe.pigments);
  const baseGrams = Number(recipe.base_grams);

  return (
    <main className={pageClass}>
      <header>
        <Link href="/colores" className="text-sm text-neutral-500 dark:text-neutral-400">← Recetas de color</Link>
        <h1 className="text-2xl font-semibold">{recipe.name}</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{[recipe.material, `receta para ${baseGrams.toLocaleString('es-AR')} g de mezcla`].filter(Boolean).join(' · ')}</p>
      </header>
      {ok && <div role="status" className={okBox}>{ok}</div>}
      {error && <div role="alert" className={errorBox}>{error}</div>}

      <section className={`${cardClass} grid gap-4 sm:grid-cols-[auto_1fr]`}>
        {recipe.photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={recipe.photo} alt={`Foto del color ${recipe.name}`} className="h-40 w-40 rounded-2xl object-cover" />
        )}
        <ColorScaler pigments={pigments} baseGrams={baseGrams} />
        {recipe.notes && <p className="whitespace-pre-line text-sm text-neutral-600 dark:text-neutral-400 sm:col-span-2">{recipe.notes}</p>}
      </section>

      {allowed && (
        <details className={cardClass}>
          <summary className="cursor-pointer font-semibold">Editar la receta</summary>
          <div className="mt-3"><RecipeForm action={updateRecipe} initial={{ ...recipe, base_grams: baseGrams, pigments }} submitLabel="Guardar cambios" /></div>
        </details>
      )}
      <form action={deleteRecipe} className="flex flex-wrap items-center gap-3 text-sm">
        <input type="hidden" name="recipe_id" value={recipe.id} />
        <label className="flex items-center gap-2"><input type="checkbox" required /> Quiero borrar este color</label>
        <SubmitButton className="rounded-xl border border-red-300 px-3 py-1.5 text-red-700 dark:border-red-900 dark:text-red-300" pendingText="Borrando…">Borrar</SubmitButton>
      </form>
    </main>
  );
}
