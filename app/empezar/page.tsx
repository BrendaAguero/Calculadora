import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMenuState, isShown } from '@/lib/menu-server';
import { getSimpleMode } from '@/lib/simple-mode-server';
import { widgetSet } from '@/lib/home-widgets';
import { MENU_SECTIONS } from '@/lib/nav';
import { SetupForm } from './setup-form';
import { hasPackAccess } from '@/lib/access/permissions';

// Primer paso al entrar: elegir el modo y lo que se ve. También se abre desde «Más» para cambiarlo.
export default async function SetupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const [{ data: prefs }, menu, simple, pack] = await Promise.all([
    supabase.from('user_preferences').select('home_widgets').eq('user_id', user.id).maybeSingle(),
    getMenuState(),
    getSimpleMode(),
    hasPackAccess(),
  ]);
  const firstTime = !prefs?.home_widgets;
  const sections = Object.fromEntries(MENU_SECTIONS.map((s) => [s, menu ? isShown(menu, s) : false]));

  return (
    <main className="mx-auto min-h-screen max-w-xl px-4 py-8 text-neutral-900 dark:text-white">
      <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">{firstTime ? '¡Bienvenida!' : 'Personalizar'}</p>
      <h1 className="mt-1 text-3xl">{firstTime ? 'Armemos la app a tu medida' : 'Cómo querés ver la app'}</h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-300">Elegí cómo la querés usar. Lo podés cambiar cuando quieras desde «Más».</p>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">{error}</p>}
      <SetupForm initialMode={firstTime ? 'simple' : simple ? 'simple' : 'completo'} initialWidgets={firstTime ? null : [...widgetSet(prefs?.home_widgets)]} initialSections={sections} firstTime={firstTime} pack={pack} />
    </main>
  );
}
