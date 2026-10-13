'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendTestPush } from '@/lib/push';
import { allowAttempt } from '@/lib/rate-limit';

// Guarda este aparato para mandarle los avisos de los temporizadores.
export async function savePushSubscription(sub: { endpoint: string; p256dh: string; auth: string }) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('save_push_subscription', { p_endpoint: String(sub.endpoint), p_p256dh: String(sub.p256dh), p_auth: String(sub.auth) });
  return { ok: !error };
}

export async function removePushSubscription(endpoint: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', String(endpoint)).eq('user_id', user.id);
  return { ok: !error };
}

// «Probar aviso»: manda una notificación ya mismo a este aparato (solo si es de la persona que lo pide).
export async function sendTestNotification(endpoint: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401 };
  if (!(await allowAttempt('push-test', 6, 600))) return { ok: false, status: 429 };
  const { data: sub } = await supabase.from('push_subscriptions').select('endpoint,p256dh,auth').eq('endpoint', String(endpoint)).eq('user_id', user.id).maybeSingle();
  const admin = createAdminClient();
  if (!sub || !admin) return { ok: false, status: 404 };
  return sendTestPush(admin, sub);
}
