'use server';

import { redirect } from 'next/navigation';
import { createPreference, mercadoPagoReady } from '@/lib/mercadopago';
import { siteOrigin } from '@/lib/origin';
import { createClient } from '@/lib/supabase/server';
import { allowAttempt, TOO_MANY } from '@/lib/rate-limit';

const back = (message: string): never => redirect(`/comprar?error=${encodeURIComponent(message.slice(0, 300))}`);

// Compra online de la Edición Personal: se crea el pedido con el email y se va a pagar a Mercado Pago.
// Al aprobarse el pago, el email queda aprobado y se le manda por correo su clave de acceso.
export async function buyPersonal(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const fullName = String(formData.get('full_name') ?? '').trim();
  if (formData.get('terms') !== 'on') back('Tenés que aceptar los términos y condiciones.');
  if (!(await allowAttempt('comprar', 10, 3600))) back(TOO_MANY);
  if (!mercadoPagoReady()) back('La compra online no está disponible en este momento. Escribinos y te ayudamos.');

  const supabase = await createClient();
  const { data: orderId, error } = await supabase.rpc('create_personal_order', { p_email: email, p_full_name: fullName });
  if (error || !orderId) back(error?.message ?? 'No se pudo crear el pedido.');
  const { data: price } = await supabase.from('pricing_config').select('value_numeric').eq('key', 'personal_price_online').maybeSingle();

  let url: string;
  try {
    url = (await createPreference({ purchaseId: orderId as string, title: 'Calculadora Emprender · Edición Personal', price: Number(price?.value_numeric ?? 44900), origin: await siteOrigin() })).url;
  } catch (e) {
    console.error('Pago de Mercado Pago', e instanceof Error ? e.message : e);
    back('No se pudo conectar con Mercado Pago. Probá de nuevo en un rato.');
  }
  redirect(url!);
}
