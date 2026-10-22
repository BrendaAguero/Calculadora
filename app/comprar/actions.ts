'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createPreference, mercadoPagoReady } from '@/lib/mercadopago';
import { siteOrigin } from '@/lib/origin';
import { createAdminClient } from '@/lib/supabase/admin';
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

  // El pedido se crea solo desde el servidor (la base no acepta pedidos directos), así cuenta el límite de intentos.
  const admin = createAdminClient();
  if (!admin) back('La compra online no está disponible en este momento. Escribinos y te ayudamos.');
  const { data: order, error } = await admin!.rpc('create_personal_order_v2', { p_email: email, p_full_name: fullName, p_with_pack: false }); // el Pack Ventas y Stock se compra después, en la tienda de la app
  const { id: orderId, total } = (order ?? {}) as { id?: string; total?: number };
  if (error || !orderId || !total) back(error?.message ?? 'No se pudo crear el pedido.');

  // Si la persona llegó con el enlace de una afiliada, el pedido queda a su nombre (la base valida el código).
  const ref = (await cookies()).get('ref')?.value;
  if (ref) await admin!.rpc('attach_affiliate_to_order', { p_order_id: orderId, p_code: ref });

  let url: string;
  try {
    url = (await createPreference({ purchaseId: orderId!, title: 'Calculadora Emprender · Edición Personal', price: Number(total), origin: await siteOrigin() })).url;
  } catch (e) {
    console.error('Pago de Mercado Pago', e instanceof Error ? e.message : e);
    back('No se pudo conectar con Mercado Pago. Probá de nuevo en un rato.');
  }
  redirect(url!);
}
