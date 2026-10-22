'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { notifyAdmin } from '@/lib/notify';

const back = (key: 'ok' | 'error', message: string): never => redirect(`/afiliados?${key}=${encodeURIComponent(message.slice(0, 300))}`);

async function auth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return supabase;
}

export async function applyAffiliate(formData: FormData) {
  if (formData.get('accept') !== 'on') back('error', 'Para enviar la solicitud tenés que aceptar las condiciones.');
  const supabase = await auth();
  const { error } = await supabase.rpc('apply_affiliate', { p_note: String(formData.get('note') ?? '') });
  if (error) back('error', error.message);
  const { data: { user } } = await supabase.auth.getUser();
  await notifyAdmin('Nueva solicitud de afiliada', [`${user?.email ?? 'Una persona'} pidió sumarse al programa de afiliadas.`, `Cómo piensa recomendarla: ${String(formData.get('note') ?? '').trim() || '-'}`, 'Revisala en Administración → Afiliadas.']).catch(() => false);
  revalidatePath('/afiliados');
  back('ok', 'Solicitud enviada. Te avisamos por correo cuando esté aprobada.');
}

export async function requestWithdrawal(formData: FormData) {
  const supabase = await auth();
  const { error } = await supabase.rpc('request_withdrawal', {
    p_method: String(formData.get('method') ?? ''),
    p_reference: String(formData.get('reference') ?? ''),
  });
  if (error) back('error', error.message);
  const { data: { user } } = await supabase.auth.getUser();
  await notifyAdmin('Pedido de retiro de afiliada', [`${user?.email ?? 'Una afiliada'} pidió retirar sus comisiones disponibles.`, 'Hacé la transferencia y marcalo como pagado en Administración → Afiliadas.']).catch(() => false);
  revalidatePath('/afiliados');
  back('ok', 'Pedido de retiro enviado. Te avisamos por correo cuando esté pagado.');
}
