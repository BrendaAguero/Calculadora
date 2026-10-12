'use server';

import { parseAR } from '@/lib/num';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAccessSnapshot, hasFeature } from '@/lib/access/permissions';
import { convert } from '@/app/stock/constants';
import { MAX_ROWS } from './constants';

const text = (formData: FormData, key: string) => String(formData.get(key) ?? '').trim();
const number = (value: string) => parseAR(value);

// Compra a un proveedor: guarda la compra, opcionalmente actualiza el precio de cada material y suma al stock.
// Las conversiones a la unidad del material se hacen acá; la base guarda todo en una sola transacción.
export async function registerPurchase(formData: FormData) {
  const supplierId = text(formData, 'supplier_id') || null;
  const date = text(formData, 'date');
  const updateStock = formData.get('update_stock') === 'on';
  const updatePrice = formData.get('update_price') === 'on';
  const fail = (message: string): never => redirect(`/compras/nueva?${supplierId ? `proveedor=${supplierId}&` : ''}error=${encodeURIComponent(message.slice(0, 300))}`);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const snapshot = await getAccessSnapshot();
  if (!snapshot || !hasFeature(snapshot, 'PROVEEDORES_BASICO')) redirect('/proveedores');

  if (supplierId) {
    const { data } = await supabase.from('suppliers').select('id').eq('id', supplierId).eq('user_id', user.id).maybeSingle();
    if (!data) fail('El proveedor no existe o no es tuyo.');
  }

  const rows: { materialId: string; quantity: number; unit: string; total: number; row: number }[] = [];
  for (let i = 0; i < MAX_ROWS; i++) {
    const materialId = text(formData, `material_${i}`);
    const quantityText = text(formData, `quantity_${i}`);
    const totalText = text(formData, `total_${i}`);
    if (!materialId && !quantityText && !totalText) continue;
    const quantity = number(quantityText);
    const total = number(totalText);
    if (!materialId) fail(`Fila ${i + 1}: elegí el material.`);
    if (!Number.isFinite(quantity) || quantity <= 0) fail(`Fila ${i + 1}: la cantidad tiene que ser mayor que cero.`);
    if (!Number.isFinite(total) || total < 0) fail(`Fila ${i + 1}: escribí cuánto pagaste.`);
    rows.push({ materialId, quantity, unit: text(formData, `unit_${i}`), total, row: i + 1 });
  }
  if (!rows.length) fail('Agregá al menos un material.');

  const { data: materials } = await supabase.from('materials').select('id,name,default_unit').eq('user_id', user.id).in('id', rows.map((r) => r.materialId));
  const byId = new Map((materials ?? []).map((m) => [m.id, m]));
  const items = rows.map((r) => {
    const material = byId.get(r.materialId);
    if (!material) fail(`Fila ${r.row}: el material no existe o no es tuyo.`);
    const inMaterialUnit = convert(r.quantity, r.unit, material!.default_unit);
    if (inMaterialUnit === null || inMaterialUnit <= 0) fail(`Fila ${r.row}: ${material!.name} se mide en ${material!.default_unit}; no se puede cargar en ${r.unit}.`);
    return {
      material_id: r.materialId,
      quantity: r.quantity,
      unit: r.unit,
      unit_price: r.total / r.quantity,
      total: r.total,
      update_price: updatePrice,
      stock_quantity: inMaterialUnit,
      stock_unit: material!.default_unit,
      unit_cost: r.total / inMaterialUnit!,
    };
  });

  const purchaseDate = date ? new Date(`${date}T12:00:00-03:00`).toISOString() : new Date().toISOString();
  const { data: id, error } = await supabase.rpc('register_supplier_purchase', {
    p: { supplier_id: supplierId, purchase_date: purchaseDate, notes: text(formData, 'notes'), update_stock: updateStock, items },
  });
  if (error) fail(`No se pudo registrar: ${error.message}`);

  revalidatePath('/compras');
  revalidatePath('/stock');
  revalidatePath('/materials');
  redirect(`/compras/${id}?ok=1`);
}
