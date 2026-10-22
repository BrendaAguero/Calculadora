'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { cancelStalePreapprovals, createPreapproval, createPreference, getPreapprovalUrl, MercadoPagoError, mercadoPagoReady } from '@/lib/mercadopago';
import { siteOrigin } from '@/lib/origin';
import { PROMO_COOKIE, cleanCode } from '@/lib/promo';

const back = (key: 'ok' | 'error', message: string): never => redirect(`/access?${key}=${encodeURIComponent(message.slice(0, 300))}#emprendedor`);
const MANUAL = 'Queda activo cuando la administradora confirme el pago.';

type Supabase = Awaited<ReturnType<typeof createClient>>;
type DiscountScope = 'plus_annual' | 'plus_6' | 'extras';

// Código de descuento guardado por un enlace /codigo/XXXX o en la tienda: se usa solo si sirve para esta compra.
async function promoCode(supabase: Supabase, scope: DiscountScope) {
  const promo = (await cookies()).get(PROMO_COOKIE)?.value;
  if (!promo) return null;
  const { data: problem } = await supabase.rpc('check_discount_code', { p_code: promo, p_scope: scope });
  return problem ? null : promo;
}

// El código escrito puede ser de descuento o de afiliada. La afiliada sale del código escrito o, si no,
// del enlace con el que llegó (cookie «ref») o de quien la refirió al crear la cuenta (90 días).
// Si lo escribió y no sirve, se avisa antes de crear el pedido.
async function purchaseCodes(formData: FormData, supabase: Supabase, scope: DiscountScope | null, fail: (message: string) => never) {
  const typed = cleanCode(String(formData.get('affiliate_code') ?? ''));
  let discount: string | null = null;
  let affiliate: string | null = null;
  if (typed) {
    const { data: isDiscount } = await supabase.rpc('is_discount_code', { p_code: typed });
    if (isDiscount) {
      if (!scope) fail('Los códigos de descuento no se usan en esta compra. Sí en Personal Plus anual o de 6 meses (no en el mensual).');
      const { data: problem } = await supabase.rpc('check_discount_code', { p_code: typed, p_scope: scope });
      if (problem) fail(String(problem));
      discount = typed;
    } else {
      const { data } = await supabase.rpc('check_affiliate_code', { p_code: typed });
      if (data === 'self_referral') fail('No podés usar tu propio código de afiliada.');
      if (data !== 'ok') fail('Ese código no existe o no está activo. Revisalo o dejalo vacío.');
      affiliate = typed;
    }
  }
  if (!discount && scope) discount = await promoCode(supabase, scope);
  if (!affiliate) affiliate = (await cookies()).get('ref')?.value ?? null;
  if (!affiliate) affiliate = ((await supabase.rpc('my_referral_code')).data as string | null) ?? null;
  return { affiliate, discount };
}

// Asocia la compra a la afiliada (la base valida todo; si no corresponde, no hace nada).
async function attributeToPurchase(supabase: Supabase, purchaseId: string, code: string | null) {
  if (code) await supabase.rpc('attribute_purchase', { p_purchase_id: purchaseId, p_code: code });
}

// Aplica el código de descuento antes de pagar. Si la compra ya tiene un descuento igual o mayor, queda ese.
async function applyDiscount(supabase: Supabase, purchaseId: string, code: string | null) {
  if (!code) return;
  const { error } = await supabase.rpc('apply_discount_code', { p_purchase_id: purchaseId, p_code: code });
  if (error) console.info('[descuentos] no aplicado:', error.message);
}

async function subscriptionPurchase(supabase: Supabase, subscriptionId: string) {
  const { data: sub } = await supabase.from('subscriptions').select('purchase_id').eq('id', subscriptionId).maybeSingle();
  return (sub?.purchase_id as string | null) ?? null;
}

// Lleva a pagar un pedido pendiente con Mercado Pago. El precio sale de la compra guardada en la base, no del formulario.
async function checkout(subscriptionId: string, formData: FormData): Promise<never> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id,duration_months,auto_renew,external_preapproval_id,upgraded_from_subscription_id,purchase_id,purchases(id,total,payment_status)')
    .eq('id', subscriptionId)
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .maybeSingle();
  const purchase = Array.isArray(sub?.purchases) ? sub?.purchases[0] : sub?.purchases;
  if (!sub || !purchase || purchase.payment_status !== 'pending') back('error', 'No se encontró un pedido pendiente para pagar.');

  // Suscripción mensual: se autoriza en Mercado Pago un cobro automático por mes.
  if (sub!.duration_months === 1 && sub!.auto_renew) {
    const payerEmail = String(formData.get('mp_email') ?? '').trim().toLowerCase() || user.email || '';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payerEmail)) back('error', 'Escribí el email de tu cuenta de Mercado Pago.');
    let url: string;
    try {
      url = sub!.external_preapproval_id
        ? await getPreapprovalUrl(sub!.external_preapproval_id)
        : (await createPreapproval({ subscriptionId: sub!.id, price: Number(purchase!.total), payerEmail, origin: await siteOrigin() })).url;
    } catch (error) {
      console.error('Suscripción de Mercado Pago', error instanceof Error ? error.message : error);
      const detail = error instanceof MercadoPagoError && error.detail ? ` (Mercado Pago dice: «${error.detail.slice(0, 160)}»)` : '';
      back('error', `No se pudo abrir la suscripción en Mercado Pago. Revisá que el email sea el de tu cuenta de Mercado Pago y probá de nuevo.${detail}`);
    }
    redirect(url!);
  }

  const plan = sub!.duration_months === 1 ? 'Personal Plus' : `Personal Plus · ${sub!.duration_months} meses`;
  let initPoint: string;
  try {
    const preference = await createPreference({
      purchaseId: purchase!.id,
      title: sub!.upgraded_from_subscription_id ? `Actualización a ${plan}` : plan,
      price: Number(purchase!.total),
      origin: await siteOrigin(),
    });
    initPoint = preference.url;
  } catch (error) {
    console.error('Pago de Mercado Pago', error instanceof Error ? error.message : error);
    back('error', 'No se pudo conectar con Mercado Pago. Probá de nuevo en un rato; tu pedido quedó guardado.');
  }
  redirect(initPoint!);
}

export async function payEntrepreneurRequest(formData: FormData) {
  if (!mercadoPagoReady()) back('error', `El pago en línea todavía no está disponible. ${MANUAL}`);
  await checkout(String(formData.get('subscription_id') ?? ''), formData);
}

// El pedido lo valida la base (licencia base, precio, descuento y que no haya otro pendiente).
export async function requestEntrepreneur(formData: FormData) {
  const months = Number(formData.get('months'));
  if (![1, 6, 12].includes(months)) back('error', 'Elegí un plazo.');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Si ya tiene Personal Plus vigente, primero se pide confirmación (y se ofrece actualizar si conviene).
  if (formData.get('confirmed') !== '1') {
    const { count } = await supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'active').gt('expires_at', new Date().toISOString());
    if (count) redirect(`/access?confirmar=${months}#emprendedor`);
  }

  const scope = months === 12 ? 'plus_annual' : months === 6 ? 'plus_6' : null;
  const { affiliate, discount } = await purchaseCodes(formData, supabase, scope, (m) => back('error', months === 1 && m.startsWith('Los códigos') ? 'Personal Plus mensual no lleva códigos de descuento: Mercado Pago cobra el mismo monto todos los meses. Elegí el plan anual o el de 6 meses para usarlo.' : m));
  const { data: subscriptionId, error } = await supabase.rpc('request_entrepreneur', { p_months: months });
  if (error) back('error', error.message);
  const purchaseId = await subscriptionPurchase(supabase, subscriptionId as string);
  if (purchaseId) await attributeToPurchase(supabase, purchaseId, affiliate);
  // Anual con código de afiliada: descuento (la base comprueba que la compra quedó a nombre de una afiliada).
  if (months === 12 && affiliate) await supabase.rpc('apply_affiliate_annual_discount', { p_subscription_id: subscriptionId });
  // Después, el código de descuento: se queda el mejor de los dos.
  if (purchaseId) await applyDiscount(supabase, purchaseId, discount);
  revalidatePath('/access');
  if (mercadoPagoReady()) await checkout(subscriptionId as string, formData);
  back('ok', `Pedido enviado. ${MANUAL}`);
}

// Pasar a un plan más largo: se descuenta lo que queda sin usar del plan actual (lo calcula la base).
export async function requestEntrepreneurUpgrade(formData: FormData) {
  const months = Number(formData.get('months'));
  if (![6, 12].includes(months)) back('error', 'Elegí un plazo.');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { affiliate } = await purchaseCodes(formData, supabase, null, (m) => back('error', m.startsWith('Los códigos') ? 'Los códigos de descuento no se usan para pasar a un plan más largo.' : m));
  const { data: subscriptionId, error } = await supabase.rpc('request_entrepreneur_upgrade', { p_months: months });
  if (error) back('error', error.message);
  const purchaseId = await subscriptionPurchase(supabase, subscriptionId as string);
  if (purchaseId) await attributeToPurchase(supabase, purchaseId, affiliate);
  revalidatePath('/access');
  if (mercadoPagoReady()) await checkout(subscriptionId as string, formData);
  back('ok', `Pedido de actualización enviado. ${MANUAL}`);
}

export async function cancelEntrepreneurRequest(formData: FormData) {
  const subscriptionId = String(formData.get('subscription_id') ?? '');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase.rpc('cancel_entrepreneur_request', { p_subscription_id: subscriptionId });
  if (error) back('error', error.message);
  await cancelStalePreapprovals({ userId: user.id });
  revalidatePath('/access');
  back('ok', 'Pedido cancelado.');
}

// Cancela la renovación de la suscripción mensual; Personal Plus sigue activo hasta que vence.
export async function cancelEntrepreneurAutoRenew(formData: FormData) {
  const subscriptionId = String(formData.get('subscription_id') ?? '');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase.rpc('cancel_entrepreneur_auto_renew', { p_subscription_id: subscriptionId });
  if (error) back('error', error.message);
  // Se cancela también en Mercado Pago para que no se cobre el mes siguiente (si falla, se reintenta al volver a entrar).
  await cancelStalePreapprovals({ userId: user.id });
  revalidatePath('/access');
  back('ok', 'Renovación cancelada. Plus sigue activo hasta que vence.');
}

// ---------------------------------------------------------------------------------------------
// Compras de pago único: licencia Básico/Avanzado, pase Básico → Avanzado y módulos (Checkout Pro).

const PRODUCT_TITLES: Record<string, string> = { license: 'Licencia', license_upgrade: 'Pase a Avanzado', module: 'Módulo', activity: 'Actividad' };
const goStore = (key: 'ok' | 'error', message: string): never => redirect(`/access?${key}=${encodeURIComponent(message.slice(0, 300))}#planes`);

// Lleva a pagar una compra pendiente. El precio sale de la base, no del formulario.
async function checkoutPurchase(purchaseId: string, name: string): Promise<never> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: purchase } = await supabase.from('purchases').select('id,total,payment_status,product_type').eq('id', purchaseId).eq('user_id', user.id).maybeSingle();
  if (!purchase || purchase.payment_status !== 'pending') goStore('error', 'No se encontró un pedido pendiente para pagar.');
  if (!mercadoPagoReady()) goStore('ok', `Pedido guardado. ${MANUAL}`);
  let url: string;
  try {
    url = (await createPreference({ purchaseId: purchase!.id, title: `Calculadora Emprender · ${PRODUCT_TITLES[purchase!.product_type] ?? 'Compra'} ${name}`.trim(), price: Number(purchase!.total), origin: await siteOrigin() })).url;
  } catch (error) {
    console.error('Pago de Mercado Pago', error instanceof Error ? error.message : error);
    goStore('error', 'No se pudo conectar con Mercado Pago. Probá de nuevo en un rato; tu pedido quedó guardado.');
  }
  redirect(url!);
}

export async function buyLicense(formData: FormData) {
  const plan = String(formData.get('plan') ?? '');
  if (!['BASIC', 'ADVANCED'].includes(plan)) goStore('error', 'Elegí un plan.');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { affiliate } = await purchaseCodes(formData, supabase, null, (m) => goStore('error', m));
  const { data: purchaseId, error } = await supabase.rpc('request_license_purchase', { p_plan_code: plan });
  if (error || !purchaseId) goStore('error', error?.message ?? 'No se pudo crear el pedido.');
  await attributeToPurchase(supabase, purchaseId as string, affiliate);
  await checkoutPurchase(purchaseId as string, plan === 'ADVANCED' ? 'Avanzado' : 'Básico');
}

export async function upgradeLicense(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { affiliate } = await purchaseCodes(formData, supabase, null, (m) => goStore('error', m));
  const { data: purchaseId, error } = await supabase.rpc('request_license_upgrade');
  if (error || !purchaseId) goStore('error', error?.message ?? 'No se pudo crear el pedido.');
  await attributeToPurchase(supabase, purchaseId as string, affiliate);
  await checkoutPurchase(purchaseId as string, '');
}

export async function buyModule(formData: FormData) {
  const moduleCode = String(formData.get('module') ?? '');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: purchaseId, error } = await supabase.rpc('request_module_purchase', { p_module_code: moduleCode });
  if (error || !purchaseId) goStore('error', error?.message ?? 'No se pudo crear el pedido.');
  await applyDiscount(supabase, purchaseId as string, await promoCode(supabase, 'extras'));
  await checkoutPurchase(purchaseId as string, String(formData.get('name') ?? ''));
}

// Compra de una actividad (la segunda a mitad de precio; el precio lo pone la base).
export async function buyActivity(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: purchaseId, error } = await supabase.rpc('request_activity_purchase', { p_code: String(formData.get('activity') ?? '') });
  if (error || !purchaseId) goStore('error', error?.message ?? 'No se pudo crear el pedido.');
  await applyDiscount(supabase, purchaseId as string, await promoCode(supabase, 'extras'));
  await checkoutPurchase(purchaseId as string, String(formData.get('name') ?? ''));
}

export async function payPurchase(formData: FormData) {
  await checkoutPurchase(String(formData.get('purchase_id') ?? ''), String(formData.get('name') ?? ''));
}

export async function cancelPurchase(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('cancel_purchase_request', { p_purchase_id: String(formData.get('purchase_id') ?? '') });
  if (error) goStore('error', error.message);
  revalidatePath('/access');
  goStore('ok', 'Pedido cancelado.');
}

// Libera un aparato propio (por ejemplo, un celular que ya no usa) para poder entrar desde otro.
export async function releaseDevice(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('release_device', { p_id: String(formData.get('device_id') ?? '') });
  if (error) redirect(`/access?error=${encodeURIComponent(error.message)}#aparatos`);
  revalidatePath('/access');
  redirect(`/access?ok=${encodeURIComponent('Aparato liberado.')}#aparatos`);
}

// Prueba gratis de Personal Plus: una sola vez por cuenta (la base lo controla).
export async function startPlusTrial() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data, error } = await supabase.rpc('start_plus_trial');
  if (error || !data) back('error', error?.message ?? 'No se pudo empezar la prueba.');
  revalidatePath('/', 'layout');
  back('ok', `¡Listo! Tenés Personal Plus gratis hasta el ${new Date(data as string).toLocaleDateString('es-AR', { dateStyle: 'long', timeZone: 'America/Argentina/Buenos_Aires' })}. Ya podés usar todo.`);
}

// Guarda un código de descuento para las compras de la tienda (extras, actividades) y de Personal Plus.
export async function setPromoCode(formData: FormData) {
  const code = cleanCode(String(formData.get('promo') ?? ''));
  if (!code) goStore('error', 'Escribí el código.');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const scopes = ['extras', 'plus_annual', 'plus_6'] as const;
  const results = await Promise.all(scopes.map((scope) => supabase.rpc('check_discount_code', { p_code: code, p_scope: scope })));
  const valid = scopes.filter((_, i) => !results[i].error && !results[i].data);
  if (!valid.length) goStore('error', String(results[0].data ?? 'Ese código de descuento no existe o ya no está activo.'));
  (await cookies()).set(PROMO_COOKIE, code, { maxAge: 60 * 60 * 24 * 7, httpOnly: true, sameSite: 'lax', secure: true, path: '/' });
  revalidatePath('/access');
  const where = [valid.includes('extras') && 'los extras y actividades', (valid.includes('plus_annual') || valid.includes('plus_6')) && 'Personal Plus anual o de 6 meses'].filter(Boolean).join(' y ');
  goStore('ok', `Código ${code} listo: se aplica al pagar ${where}.`);
}

export async function clearPromoCode() {
  (await cookies()).delete(PROMO_COOKIE);
  revalidatePath('/access');
  goStore('ok', 'Código quitado.');
}
