'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { HOME_WIDGETS, WIDGET_PRESETS } from '@/lib/home-widgets';
import { MENU_SECTIONS } from '@/lib/nav';
import { SIMPLE_COOKIE } from '@/lib/simple-mode';

// Guarda la personalización: modo, qué se ve en Inicio y qué secciones aparecen en el menú.
export async function saveSetup(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const mode = formData.get('mode') === 'completo' ? 'completo' : 'simple';
  // «Usar lo recomendado» no manda casillas: se usa el preset del modo.
  const custom = formData.get('custom') === '1';
  const widgets = Object.fromEntries(HOME_WIDGETS.map((w) => [w.key, custom ? formData.get(`w_${w.key}`) === 'on' : WIDGET_PRESETS[mode].includes(w.key)]));
  const row: Record<string, unknown> = { user_id: user.id, home_widgets: widgets };
  if (custom) row.menu_sections = Object.fromEntries(MENU_SECTIONS.map((s) => [s, formData.get(`s_${s}`) === 'on']));
  const { error } = await supabase.from('user_preferences').upsert(row, { onConflict: 'user_id' });
  if (error) redirect(`/empezar?error=${encodeURIComponent(error.message)}`);
  (await cookies()).set(SIMPLE_COOKIE, mode === 'simple' ? '1' : '0', { path: '/', maxAge: 60 * 60 * 24 * 365 * 2, sameSite: 'lax' });
  revalidatePath('/', 'layout');
  redirect('/');
}
