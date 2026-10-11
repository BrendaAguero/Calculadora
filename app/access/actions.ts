'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createPreference, mercadoPagoReady } from '@/lib/mercadopago';
import { siteOrigin } from '@/lib/origin';

const back = (key: 'ok' | 'error', message: string): never => redirect(`/access?${key}=${encodeURIComponent(message.slice(0, 300))}#emprendedor`);
const MANUAL = 'Queda activo cuando la administradora confirme el pago.';

// Lleva a pagar un pedido pendiente con Mercado Pago. El precio sale de la compra guardada en la base, no del formulario.
async function checkout(subscriptionId: string): Promise<never> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id,duration_months,upgraded_from_subscription_id,purchase_id,purchases(id,total,payment_status)')
    .eq('id', subscriptionId)
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .maybeSingle();
  const purchase = Array.isArray(sub?.purchases) ? sub?.purchases[0] : sub?.purchases;
  if (!sub || !purchase || purchase.payment_status !== 'pending') back('error', 'No se encontró un pedido pendiente para pagar.');

  const plan = sub!.duration_months === 1 ? 'Emprendedor · suscripción mensual' : `Emprendedor · ${sub!.duration_months} meses`;
  let initPoint: string;
  try {
    const preference = await createPreference({
      purchaseId: purchase!.id,
      title: sub!.upgraded_from_subscription_id ? `Actualización a ${plan}` : plan,
      price: Number(purchase!.total),
      origin: await siteOrigin(),
    });
    initPoint = preference.url;
  } catch {
    back('error', 'No se pudo conectar con Mercado Pago. Probá de nuevo en un rato; tu pedido quedó guardado.');
  }
  redirect(initPoint!);
}

export async function payEntrepreneurRequest(formData: FormData) {
  if (!mercadoPagoReady()) back('error', `El pago en línea todavía no está disponible. ${MANUAL}`);
  await checkout(String(formData.get('subscription_id') ?? ''));
}

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

  const { data: subscriptionId, error } = await supabase.rpc('request_entrepreneur', { p_months: months });
  if (error) back('error', error.message);
  revalidatePath('/access');
  if (mercadoPagoReady()) await checkout(subscriptionId as string);
  back('ok', `Pedido enviado. ${MANUAL}`);
}

// Pasar a un plan más largo: se descuenta lo que queda sin usar del plan actual (lo calcula la base).
export async function requestEntrepreneurUpgrade(formData: FormData) {
  const months = Number(formData.get('months'));
  if (![6, 12].includes(months)) back('error', 'Elegí un plazo.');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: subscriptionId, error } = await supabase.rpc('request_entrepreneur_upgrade', { p_months: months });
  if (error) back('error', error.message);
  revalidatePath('/access');
  if (mercadoPagoReady()) await checkout(subscriptionId as string);
  back('ok', `Pedido de actualización enviado. ${MANUAL}`);
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
