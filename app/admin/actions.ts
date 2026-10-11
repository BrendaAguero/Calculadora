'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const text = (formData: FormData, key: string) => String(formData.get(key) ?? '').trim();
const back = (path: string, key: 'ok' | 'error', message: string): never => redirect(`${path}${path.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(message.slice(0, 300))}`);

// Todas las acciones pasan por funciones de la base que comprueban que sea administradora y dejan registro.
async function rpc(path: string, fn: string, args: Record<string, unknown>, ok: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { error } = await supabase.rpc(fn, args);
  if (error) back(path, 'error', error.message);
  revalidatePath(path.split('?')[0]);
  back(path, 'ok', ok);
}

export async function setAccountStatus(formData: FormData) {
  const status = text(formData, 'status');
  await rpc('/admin/usuarios', 'admin_set_account_status', { p_user_id: text(formData, 'user_id'), p_status: status }, status === 'active' ? 'Cuenta reactivada.' : 'Cuenta suspendida.');
}

export async function grantLicense(formData: FormData) {
  await rpc('/admin/usuarios', 'admin_grant_license', { p_user_id: text(formData, 'user_id'), p_plan_code: text(formData, 'plan'), p_reason: text(formData, 'reason') }, 'Licencia de cortesía otorgada.');
}

export async function reviewAffiliate(formData: FormData) {
  const approve = text(formData, 'decision') === 'approve';
  await rpc('/admin/afiliados', 'admin_review_affiliate', { p_affiliate_id: text(formData, 'affiliate_id'), p_approve: approve, p_percentage: Number(text(formData, 'percentage') || 15) }, approve ? 'Afiliada aprobada: ya tiene su código.' : 'Solicitud rechazada.');
}

export async function setAffiliateStatus(formData: FormData) {
  const status = text(formData, 'status');
  await rpc('/admin/afiliados', 'admin_set_affiliate_status', { p_affiliate_id: text(formData, 'affiliate_id'), p_status: status }, status === 'approved' ? 'Afiliada reactivada.' : 'Afiliada suspendida.');
}

export async function updateWithdrawal(formData: FormData) {
  const status = text(formData, 'status');
  await rpc('/admin/afiliados', 'admin_update_withdrawal', { p_withdrawal_id: text(formData, 'withdrawal_id'), p_status: status, p_notes: text(formData, 'notes') }, status === 'paid' ? 'Retiro marcado como pagado.' : 'Retiro actualizado.');
}

export async function resolveRegret(formData: FormData) {
  const status = text(formData, 'status');
  await rpc('/admin/arrepentimiento', 'admin_resolve_regret_request', { p_id: text(formData, 'id'), p_status: status, p_note: text(formData, 'note') || null }, status === 'refunded' ? 'Marcado como resuelto.' : 'Marcado como rechazado.');
}

export async function saveBanner(formData: FormData) {
  await rpc('/admin/banner', 'admin_save_banner', {
    p_title: text(formData, 'title'), p_text: text(formData, 'text'), p_link: text(formData, 'link'),
    p_button: text(formData, 'button'), p_image: text(formData, 'image'), p_active: formData.get('active') === 'on',
  }, 'Banner guardado.');
}
