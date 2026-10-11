'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// Elige la actividad principal (incluida en la Edición Personal).
export async function choosePrimary(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { error } = await supabase.rpc('choose_primary_activity', { p_code: String(formData.get('activity') ?? '') });
  if (error) redirect(`/bienvenida?error=${encodeURIComponent(error.message.slice(0, 200))}`);
  redirect('/bienvenida');
}
