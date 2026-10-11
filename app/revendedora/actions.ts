'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createPreference, mercadoPagoReady } from '@/lib/mercadopago';
import { siteOrigin } from '@/lib/origin';

const back = (key: 'ok' | 'error', message: string): never => redirect(`/revendedora?${key}=${encodeURIComponent(message.slice(0, 300))}`);

async function session() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return supabase;
}

export async function becomeReseller() {
  const supabase = await session();
  const { error } = await supabase.rpc('become_reseller');
  if (error) back('error', error.message);
  revalidatePath('/revendedora');
  back('ok', '¡Listo! Ya sos revendedora. Comprá tu primer paquete de licencias.');
}

// Compra de un paquete: el precio sale de la base; se paga en Mercado Pago.
export async function buyPack(formData: FormData) {
  const supabase = await session();
  const quantity = Number(formData.get('quantity'));
  const { data: orderId, error } = await supabase.rpc('request_reseller_order', { p_quantity: quantity });
  if (error || !orderId) back('error', error?.message ?? 'No se pudo crear el pedido.');
  const { data: order } = await supabase.from('reseller_orders').select('id,total,quantity').eq('id', orderId as string).maybeSingle();
  if (!order) back('error', 'No se encontró el pedido.');
  if (!mercadoPagoReady()) back('ok', 'Pedido guardado. Queda activo cuando la administradora confirme el pago.');
  let url: string;
  try {
    url = (await createPreference({ purchaseId: order!.id, title: `Calculadora Emprender · ${order!.quantity} licencias (revendedora)`, price: Number(order!.total), origin: await siteOrigin() })).url;
  } catch (e) {
    console.error('Pago de Mercado Pago', e instanceof Error ? e.message : e);
    back('error', 'No se pudo conectar con Mercado Pago. Probá de nuevo en un rato; tu pedido quedó guardado.');
  }
  redirect(url!);
}

export async function addClient(formData: FormData) {
  const supabase = await session();
  const { error } = await supabase.rpc('reseller_add_client', { p_email: String(formData.get('email') ?? ''), p_full_name: String(formData.get('full_name') ?? '') });
  if (error) back('error', error.message);
  revalidatePath('/revendedora');
  back('ok', 'Clienta cargada. Cuando la administradora la apruebe, le llega su clave de acceso por correo.');
}

export async function cancelClient(formData: FormData) {
  const supabase = await session();
  const { error } = await supabase.rpc('reseller_cancel_client', { p_id: String(formData.get('id') ?? '') });
  if (error) back('error', error.message);
  revalidatePath('/revendedora');
  back('ok', 'Carga cancelada. La licencia volvió a tu saldo.');
}
