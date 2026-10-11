'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

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
  revalidatePath('/afiliados');
  back('ok', 'Solicitud enviada. Te avisamos cuando esté aprobada.');
}

export async function requestWithdrawal(formData: FormData) {
  const supabase = await auth();
  const { error } = await supabase.rpc('request_withdrawal', {
    p_method: String(formData.get('method') ?? ''),
    p_reference: String(formData.get('reference') ?? ''),
  });
  if (error) back('error', error.message);
  revalidatePath('/afiliados');
  back('ok', 'Pedido de retiro enviado. Lo revisamos y te avisamos cuando esté pagado.');
}
