'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAccessSnapshot, hasFeature } from '@/lib/access/permissions';
import { recordSale } from './record';

const text = (formData: FormData, key: string) => String(formData.get(key) ?? '').trim();

async function auth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const snapshot = await getAccessSnapshot();
  if (!snapshot || !hasFeature(snapshot, 'VENTAS')) redirect('/ventas');
  return { supabase, userId: user.id };
}

// Venta desde el formulario. La lógica está en record.ts (la comparte la subida de ventas sin conexión).
export async function registerSale(formData: FormData) {
  const productId = text(formData, 'product_id');
  const fail = (message: string): never => redirect(`/ventas/nueva?producto=${productId}&cantidad=${text(formData, 'quantity')}&error=${encodeURIComponent(message.slice(0, 300))}`);
  const { supabase, userId } = await auth();
  const result = await recordSale(supabase, userId, {
    productId, quantity: text(formData, 'quantity'), unitPrice: text(formData, 'unit_price'), discount: text(formData, 'discount'),
    commissionPct: text(formData, 'commission_pct'), date: text(formData, 'date'), paymentMethod: text(formData, 'payment_method'),
    customerName: text(formData, 'customer_name'), deduct: formData.get('deduct') === 'on',
  });
  if (!result.ok) fail(result.error);
  revalidatePath('/ventas');
  revalidatePath('/stock');
  redirect(`/ventas?ok=${encodeURIComponent('Venta registrada.')}`);
}

// Anular no borra la venta: queda marcada y deja de contar; si había descontado stock, lo devuelve.
export async function voidSale(formData: FormData) {
  const id = text(formData, 'sale_id');
  const { supabase } = await auth();
  const { error } = await supabase.rpc('void_sale', { p_sale_id: id });
  if (error) redirect(`/ventas?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/ventas');
  revalidatePath('/stock');
  redirect(`/ventas?ok=${encodeURIComponent('Venta anulada. Si había descontado stock, se devolvió.')}`);
}
