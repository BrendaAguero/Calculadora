'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MENU_SECTIONS } from '@/lib/nav';

// Guarda qué secciones quiere ver en el menú (las marcadas se ven; las otras se ocultan).
export async function saveMenuSections(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const choices = Object.fromEntries(MENU_SECTIONS.map((section) => [section, formData.get(section) === 'on']));
  const { error } = await supabase.from('user_preferences').upsert({ user_id: user.id, menu_sections: choices }, { onConflict: 'user_id' });
  if (error) redirect(`/mas?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/', 'layout');
  redirect('/mas?ok=1');
}
