'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const text = (formData: FormData, key: string) => String(formData.get(key) ?? '').trim();

export async function submitRegret(formData: FormData) {
  const supabase = await createClient();
  const date = text(formData, 'purchase_date');
  const { data, error } = await supabase.rpc('submit_regret_request', {
    p_full_name: text(formData, 'full_name'),
    p_email: text(formData, 'email'),
    p_purchase_reference: text(formData, 'purchase_reference') || null,
    p_purchase_date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    p_details: text(formData, 'details') || null,
  });
  if (error || !data) redirect(`/arrepentimiento?error=${encodeURIComponent(error?.message ?? 'No se pudo enviar el pedido. Probá de nuevo.')}`);
  redirect(`/arrepentimiento?codigo=${encodeURIComponent(data)}`);
}
