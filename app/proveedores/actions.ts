'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAccessSnapshot, hasFeature } from '@/lib/access/permissions';

const text = (formData: FormData, key: string) => String(formData.get(key) ?? '').trim();

// Proveedores y compras: módulo «Proveedores básico» o Personal Plus. Se comprueba en cada acción.
async function auth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const snapshot = await getAccessSnapshot();
  if (!snapshot || !hasFeature(snapshot, 'PROVEEDORES_BASICO')) redirect('/proveedores');
  return { supabase, userId: user.id };
}

function readSupplier(formData: FormData) {
  const email = text(formData, 'email');
  return {
    values: { name: text(formData, 'name'), phone: text(formData, 'phone') || null, email: email || null, notes: text(formData, 'notes') || null },
    error: !text(formData, 'name') ? 'Escribí el nombre del proveedor.' : email && !/^\S+@\S+\.\S+$/.test(email) ? 'El email no parece válido.' : null,
  };
}

export async function createSupplier(formData: FormData) {
  const { values, error } = readSupplier(formData);
  if (error) redirect(`/proveedores?error=${encodeURIComponent(error)}`);
  const { supabase, userId } = await auth();
  const { data, error: saveError } = await supabase.from('suppliers').insert({ ...values, user_id: userId, status: 'active' }).select('id').single();
  if (saveError || !data) redirect(`/proveedores?error=${encodeURIComponent(`No se pudo guardar: ${saveError?.message}`)}`);
  revalidatePath('/proveedores');
  redirect(`/proveedores/${data!.id}?ok=${encodeURIComponent('Proveedor guardado.')}`);
}

export async function updateSupplier(formData: FormData) {
  const id = text(formData, 'supplier_id');
  const { values, error } = readSupplier(formData);
  const back = (key: 'ok' | 'error', message: string): never => redirect(`/proveedores/${id}?${key}=${encodeURIComponent(message.slice(0, 300))}`);
  if (error) back('error', error);
  const { supabase, userId } = await auth();
  const { data, error: saveError } = await supabase.from('suppliers').update(values).eq('id', id).eq('user_id', userId).select('id');
  if (saveError) back('error', `No se pudo guardar: ${saveError.message}`);
  if (!data?.length) back('error', 'No se encontró el proveedor.');
  revalidatePath('/proveedores');
  back('ok', 'Cambios guardados.');
}

// Archivar no borra al proveedor ni sus compras.
export async function setSupplierStatus(formData: FormData) {
  const id = text(formData, 'supplier_id');
  const status = text(formData, 'status') === 'archived' ? 'archived' : 'active';
  const { supabase, userId } = await auth();
  const { error } = await supabase.from('suppliers').update({ status }).eq('id', id).eq('user_id', userId);
  if (error) redirect(`/proveedores/${id}?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/proveedores');
  redirect(status === 'archived' ? '/proveedores' : `/proveedores/${id}`);
}
