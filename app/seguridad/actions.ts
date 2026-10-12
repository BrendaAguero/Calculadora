'use server';

import { redirect } from 'next/navigation';
import { issueKey, sendKeyEmail } from '@/lib/access-key';
import { siteOrigin } from '@/lib/origin';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const loginWith = (message: string) => redirect(`/login?ok=${encodeURIComponent(message)}`);

// Cierra la sesión en todos los aparatos de la persona. Si pide clave nueva, se cambia y se manda por correo.
async function closeEverywhere(newKey: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await supabase.rpc('release_all_my_devices');
  let sent = false;
  if (newKey && user.email) {
    const admin = createAdminClient();
    const { data: rows } = admin ? await admin.rpc('approved_email_for', { p_email: user.email }) : { data: null };
    const approved = (rows as { id: string }[] | null)?.[0];
    if (admin && approved) {
      try {
        const key = await issueKey(admin, approved.id);
        sent = await sendKeyEmail(user.email, key, await siteOrigin());
      } catch (error) {
        console.error('No se pudo cambiar la clave', error instanceof Error ? error.message : error);
      }
    }
  }
  await supabase.auth.signOut({ scope: 'global' });
  return sent;
}

export async function signOutEverywhere() {
  await closeEverywhere(false);
  loginWith('Cerramos la sesión en todos tus aparatos. Entrá de nuevo con tu clave.');
}

// Respuesta al aviso de uso en paralelo.
export async function answerSessionAlert(formData: FormData) {
  const id = String(formData.get('id') || '');
  const mine = formData.get('mine') === '1';
  const supabase = await createClient();
  // Solo si de verdad hay un aviso abierto (si no, no se cambia la clave ni se manda correo).
  const { data: alert } = await supabase.from('session_alerts').select('id').eq('id', id).eq('status', 'open').maybeSingle();
  if (!alert) redirect('/');
  await supabase.rpc('resolve_session_alert', { p_id: id, p_mine: mine });
  if (mine) redirect('/');
  const sent = await closeEverywhere(true);
  loginWith(sent
    ? 'Cerramos la sesión en todos tus aparatos y te mandamos una clave nueva por correo. La anterior ya no sirve.'
    : 'Cerramos la sesión en todos tus aparatos. Escribinos para recibir una clave nueva.');
}
