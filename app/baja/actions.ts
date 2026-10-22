'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cancelStalePreapprovals } from '@/lib/mercadopago';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { notifyAdmin, sendRequestReceipt } from '@/lib/notify';
import { allowAttempt, TOO_MANY } from '@/lib/rate-limit';

const text = (formData: FormData, key: string) => String(formData.get(key) ?? '').trim();
const back = (key: 'codigo' | 'error', value: string): never => redirect(`/baja?${key}=${encodeURIComponent(value.slice(0, 300))}`);

// Con sesión: se cancela la renovación al instante (también en Mercado Pago) y se entrega el código de baja.
export async function cancelMySubscriptions() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data, error } = await supabase.rpc('cancel_my_subscriptions');
  if (error || !data) back('error', error?.message ?? 'No se pudo dar de baja. Probá de nuevo.');
  await cancelStalePreapprovals({ userId: user.id });
  revalidatePath('/access');
  if (user.email) await sendRequestReceipt(user.email, 'bajaHecha', String(data));
  await notifyAdmin(`Baja ${data}`, [`Una persona dio de baja su suscripción desde la app: ${data}`, `Email: ${user.email ?? '-'}`]);
  back('codigo', data as string);
}

// Sin sesión: queda el pedido con un código y la administración lo resuelve.
export async function submitCancellation(formData: FormData) {
  if (!(await allowAttempt('baja', 5, 3600))) back('error', TOO_MANY);
  // El pedido se guarda solo desde el servidor (la base no acepta pedidos directos), así cuenta el límite de intentos.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();
  if (!admin) back('error', 'No se pudo enviar el pedido. Escribinos por correo.');
  const { data, error } = await admin!.rpc('submit_cancellation_request', {
    p_full_name: text(formData, 'full_name'),
    p_email: text(formData, 'email'),
    p_details: text(formData, 'details') || null,
  });
  if (error || !data) back('error', error?.message ?? 'No se pudo enviar el pedido. Probá de nuevo.');
  // Si la persona tenía sesión, el pedido queda unido a su cuenta.
  if (user) await admin!.from('regret_requests').update({ user_id: user.id }).eq('code', String(data));
  const email = text(formData, 'email');
  await Promise.all([
    sendRequestReceipt(email, 'baja', String(data)),
    notifyAdmin(`Pedido de baja ${data}`, [`Nuevo pedido de baja (sin sesión): ${data}`, `Nombre: ${text(formData, 'full_name')}`, `Email: ${email}`, `Detalle: ${text(formData, 'details') || '-'}`, 'Revisalo en Administración.']),
  ]);
  back('codigo', data as string);
}
