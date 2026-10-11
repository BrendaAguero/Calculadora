'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const back = (key: 'ok' | 'error', message: string): never => redirect(`/access?${key}=${encodeURIComponent(message.slice(0, 300))}#emprendedor`);

// El pedido lo valida la base (licencia base, precio, descuento y que no haya otro pendiente).
export async function requestEntrepreneur(formData: FormData) {
  const months = Number(formData.get('months'));
  if (![1, 6, 12].includes(months)) back('error', 'Elegí un plazo.');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Si ya tiene Emprendedor vigente, primero se pide confirmación (y se ofrece actualizar si conviene).
  if (formData.get('confirmed') !== '1') {
    const { count } = await supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'active').gt('expires_at', new Date().toISOString());
    if (count) redirect(`/access?confirmar=${months}#emprendedor`);
  }

  const { error } = await supabase.rpc('request_entrepreneur', { p_months: months });
  if (error) back('error', error.message);
  revalidatePath('/access');
  back('ok', 'Pedido enviado. Queda activo cuando la administradora confirme el pago.');
}

// Pasar a un plan más largo: se descuenta lo que queda sin usar del plan actual (lo calcula la base).
export async function requestEntrepreneurUpgrade(formData: FormData) {
  const months = Number(formData.get('months'));
  if (![6, 12].includes(months)) back('error', 'Elegí un plazo.');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase.rpc('request_entrepreneur_upgrade', { p_months: months });
  if (error) back('error', error.message);
  revalidatePath('/access');
  back('ok', 'Pedido de actualización enviado. Queda activo cuando la administradora confirme el pago.');
}

export async function cancelEntrepreneurRequest(formData: FormData) {
  const subscriptionId = String(formData.get('subscription_id') ?? '');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase.rpc('cancel_entrepreneur_request', { p_subscription_id: subscriptionId });
  if (error) back('error', error.message);
  revalidatePath('/access');
  back('ok', 'Pedido cancelado.');
}

// Cancela la renovación de la suscripción mensual; Emprendedor sigue activo hasta que vence.
export async function cancelEntrepreneurAutoRenew(formData: FormData) {
  const subscriptionId = String(formData.get('subscription_id') ?? '');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase.rpc('cancel_entrepreneur_auto_renew', { p_subscription_id: subscriptionId });
  if (error) back('error', error.message);
  revalidatePath('/access');
  back('ok', 'Renovación cancelada. Emprendedor sigue activo hasta que vence.');
}
