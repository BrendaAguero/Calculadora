'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { notifyAdmin, sendRequestReceipt } from '@/lib/notify';
import { allowAttempt, TOO_MANY } from '@/lib/rate-limit';

const text = (formData: FormData, key: string) => String(formData.get(key) ?? '').trim();

export async function submitRegret(formData: FormData) {
  if (!(await allowAttempt('arrepentimiento', 5, 3600))) redirect(`/arrepentimiento?error=${encodeURIComponent(TOO_MANY)}`);
  // El pedido se guarda solo desde el servidor (la base no acepta pedidos directos), así cuenta el límite de intentos.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();
  if (!admin) redirect(`/arrepentimiento?error=${encodeURIComponent('No se pudo enviar el pedido. Escribinos por correo.')}`);
  const date = text(formData, 'purchase_date');
  const { data, error } = await admin.rpc('submit_regret_request', {
    p_full_name: text(formData, 'full_name'),
    p_email: text(formData, 'email'),
    p_purchase_reference: text(formData, 'purchase_reference') || null,
    p_purchase_date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    p_details: text(formData, 'details') || null,
  });
  if (error || !data) redirect(`/arrepentimiento?error=${encodeURIComponent(error?.message ?? 'No se pudo enviar el pedido. Probá de nuevo.')}`);
  // Si la persona tenía sesión, el pedido queda unido a su cuenta.
  if (user) await admin.from('regret_requests').update({ user_id: user.id }).eq('code', String(data));
  const email = text(formData, 'email');
  await Promise.all([
    sendRequestReceipt(email, 'arrepentimiento', String(data)),
    notifyAdmin(`Arrepentimiento ${data}`, [`Nuevo pedido de arrepentimiento: ${data}`, `Nombre: ${text(formData, 'full_name')}`, `Email: ${email}`, `Compra: ${text(formData, 'purchase_reference') || '-'} (${text(formData, 'purchase_date') || 'sin fecha'})`, `Detalle: ${text(formData, 'details') || '-'}`, 'Revisalo en Administración.']),
  ]);
  redirect(`/arrepentimiento?codigo=${encodeURIComponent(data)}`);
}
