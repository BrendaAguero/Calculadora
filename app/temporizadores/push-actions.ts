'use server';

import { createClient } from '@/lib/supabase/server';

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
