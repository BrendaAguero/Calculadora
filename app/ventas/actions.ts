'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAccessSnapshot, hasFeature } from '@/lib/access/permissions';
import { PAYMENT_METHODS, productUnitCost, saleTotals } from './compute';

const text = (formData: FormData, key: string) => String(formData.get(key) ?? '').trim();
const number = (value: string) => Number((value || '0').replace(',', '.'));

async function auth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const snapshot = await getAccessSnapshot();
  if (!snapshot || !hasFeature(snapshot, 'VENTAS')) redirect('/ventas');
  return { supabase, userId: user.id };
}

// El costo se vuelve a leer en el servidor; precio, descuento y comisión son los que escribió la persona.
export async function registerSale(formData: FormData) {
  const productId = text(formData, 'product_id');
  const quantity = number(text(formData, 'quantity'));
  const unitPrice = number(text(formData, 'unit_price'));
  const discount = number(text(formData, 'discount'));
  const commissionPct = number(text(formData, 'commission_pct'));
  const date = text(formData, 'date');
  const payment = text(formData, 'payment_method');
  const fail = (message: string): never => redirect(`/ventas/nueva?producto=${productId}&cantidad=${text(formData, 'quantity')}&error=${encodeURIComponent(message.slice(0, 300))}`);

  if (!Number.isFinite(quantity) || quantity <= 0) fail('La cantidad tiene que ser mayor que cero.');
  if (!Number.isFinite(unitPrice) || unitPrice < 0) fail('Escribí el precio por unidad.');
  if (!Number.isFinite(discount) || discount < 0 || discount > quantity * unitPrice) fail('El descuento no puede ser negativo ni mayor que el subtotal.');
  if (!Number.isFinite(commissionPct) || commissionPct < 0 || commissionPct > 100) fail('La comisión va de 0 a 100 %.');
  if (payment && !PAYMENT_METHODS.includes(payment)) fail('Elegí un medio de pago de la lista.');

  const { supabase, userId } = await auth();
  const { data: product } = await supabase.from('products').select('id').eq('id', productId).eq('user_id', userId).maybeSingle();
  if (!product) fail('El producto no existe o no es tuyo.');

  const cost = await productUnitCost(supabase, userId, productId);
  const totals = saleTotals(quantity, unitPrice, cost?.cost ?? 0, discount, commissionPct);
  const saleDate = date ? new Date(`${date}T12:00:00-03:00`).toISOString() : new Date().toISOString();

  const { error } = await supabase.rpc('register_sale', {
    p: {
      product_id: productId, calculation_id: cost?.calculationId ?? null, quantity, unit_price: unitPrice, unit_cost: cost?.cost ?? 0,
      total_cost: totals.totalCost, subtotal: totals.subtotal, discount, commission: totals.commission, total: totals.total,
      net_income: totals.netIncome, sale_date: saleDate, customer_name: text(formData, 'customer_name'), payment_method: payment,
      deduct: formData.get('deduct') === 'on',
    },
  });
  if (error) fail(`No se pudo registrar: ${error.message}`);

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
