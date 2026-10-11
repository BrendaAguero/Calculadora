'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cancelStalePreapprovals } from '@/lib/mercadopago';
import { createClient } from '@/lib/supabase/server';

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
  back('codigo', data as string);
}

// Sin sesión: queda el pedido con un código y la administración lo resuelve.
export async function submitCancellation(formData: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('submit_cancellation_request', {
    p_full_name: text(formData, 'full_name'),
    p_email: text(formData, 'email'),
    p_details: text(formData, 'details') || null,
  });
  if (error || !data) back('error', error?.message ?? 'No se pudo enviar el pedido. Probá de nuevo.');
  back('codigo', data as string);
}
