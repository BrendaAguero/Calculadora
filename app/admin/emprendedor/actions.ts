'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin';

const back = (key: 'ok' | 'error', message: string): never => redirect(`/admin/emprendedor?${key}=${encodeURIComponent(message.slice(0, 300))}`);

// La base comprueba que quien activa sea administradora; acá no se confía en la pantalla.
export async function activateSubscription(formData: FormData) {
  const subscriptionId = String(formData.get('subscription_id') ?? '');
  const { supabase } = await requireAdmin();

  const { data: expiresAt, error } = await supabase.rpc('admin_activate_subscription', { p_subscription_id: subscriptionId });
  if (error) back('error', error.message);
  revalidatePath('/admin/emprendedor');
  back('ok', `Personal Plus activado hasta el ${new Date(expiresAt as string).toLocaleDateString('es-AR', { dateStyle: 'long', timeZone: 'America/Argentina/Buenos_Aires' })}.`);
}
