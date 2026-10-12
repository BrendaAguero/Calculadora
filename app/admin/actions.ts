'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin';
import { decryptKey, issueKey, sendKeyEmail } from '@/lib/access-key';
import { siteOrigin } from '@/lib/origin';

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

export async function approveEmail(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const email = text(formData, 'email').toLowerCase();
  const { data: id, error } = await supabase.rpc('admin_approve_email', { p_email: email, p_source: text(formData, 'source'), p_note: text(formData, 'note') || null });
  if (error || !id) back('/admin/emails', 'error', error?.message ?? 'No se pudo aprobar.');
  // Clave de acceso: cada email tiene una sola. Si ya tenía, se reenvía la misma; si no, se crea.
  // Además queda visible acá para copiarla.
  let sent = false;
  let reused = false;
  try {
    const admin = createAdminClient();
    const { data: existing } = admin ? await admin.from('approved_emails').select('key_cipher').eq('id', id as string).maybeSingle() : { data: null };
    const current = decryptKey(existing?.key_cipher);
    reused = Boolean(current);
    const key = current ?? await issueKey(supabase, id as string);
    sent = await sendKeyEmail(email, key, await siteOrigin());
  } catch (e) {
    back('/admin/emails', 'error', `Email aprobado, pero no se pudo crear la clave: ${e instanceof Error ? e.message : e}`);
  }
  revalidatePath('/admin/emails');
  const which = reused ? 'su clave de siempre' : 'la clave';
  back('/admin/emails', 'ok', sent ? `Email aprobado. Le mandamos ${which} por correo (también la ves abajo).` : `Email aprobado. Copiá ${which} de abajo y mandásela (el correo automático no está configurado o falló).`);
}

// Solicitud de una revendedora: al aprobar, el email queda habilitado y se manda la clave (la de siempre si ya tenía).
export async function decideResellerClient(formData: FormData) {
  const supabase = await createClient();
  const approve = text(formData, 'approve') === '1';
  const { data: id, error } = await supabase.rpc('admin_decide_reseller_client', { p_id: text(formData, 'id'), p_approve: approve, p_note: text(formData, 'note') || null });
  if (error) back('/admin/emails', 'error', error.message);
  if (!approve) { revalidatePath('/admin/emails'); back('/admin/emails', 'ok', 'Solicitud rechazada. La licencia volvió al saldo de la revendedora.'); }
  let sent = false;
  try {
    const admin = createAdminClient();
    const { data: row } = admin ? await admin.from('approved_emails').select('email,key_cipher').eq('id', id as string).maybeSingle() : { data: null };
    const key = decryptKey(row?.key_cipher) ?? await issueKey(supabase, id as string);
    if (row?.email) sent = await sendKeyEmail(row.email, key, await siteOrigin());
  } catch (e) {
    back('/admin/emails', 'error', `Aprobada, pero no se pudo crear la clave: ${e instanceof Error ? e.message : e}`);
  }
  revalidatePath('/admin/emails');
  back('/admin/emails', 'ok', sent ? 'Clienta aprobada. Le mandamos la clave por correo.' : 'Clienta aprobada. Copiá la clave de abajo y mandásela (el correo automático falló).');
}

export async function setResellerPrices(formData: FormData) {
  const n = (key: string) => Number(text(formData, key).replace(/\./g, '').replace(',', '.'));
  await rpc('/admin/revendedoras', 'admin_set_reseller_prices', { p_unit: n('unit'), p_d5: n('d5'), p_d10: n('d10'), p_d20: n('d20') }, 'Precios de revendedoras guardados.');
}

export async function saveResellerResources(formData: FormData) {
  await rpc('/admin/revendedoras', 'admin_save_reseller_resources', { p: {
    whatsapp: text(formData, 'whatsapp'), group_link: text(formData, 'group_link'), wait_time: text(formData, 'wait_time'),
    client_message: text(formData, 'client_message'), tips: text(formData, 'tips'), materials: text(formData, 'materials'),
  } }, 'Recursos guardados.');
}

export async function newAccessKey(formData: FormData) {
  const supabase = await createClient();
  try {
    const key = await issueKey(supabase, text(formData, 'id'));
    const sent = text(formData, 'send') === '1' ? await sendKeyEmail(text(formData, 'email'), key, await siteOrigin()) : false;
    revalidatePath('/admin/emails');
    back('/admin/emails', 'ok', sent ? 'Clave nueva creada y enviada por correo. La anterior ya no sirve.' : 'Clave nueva creada. La anterior ya no sirve.');
  } catch (e) {
    if (e && typeof e === 'object' && 'digest' in e) throw e;
    back('/admin/emails', 'error', e instanceof Error ? e.message : 'No se pudo crear la clave.');
  }
}

export async function resendAccessKey(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();
  const { data } = admin ? await admin.from('approved_emails').select('email,key_cipher').eq('id', text(formData, 'id')).maybeSingle() : { data: null };
  const key = decryptKey(data?.key_cipher);
  if (!data || !key) back('/admin/emails', 'error', 'Esta persona no tiene clave guardada. Creá una nueva.');
  const sent = await sendKeyEmail(data!.email, key!, await siteOrigin());
  back('/admin/emails', sent ? 'ok' : 'error', sent ? 'Clave reenviada por correo.' : 'No se pudo mandar el correo. Copiá la clave y mandásela por mensaje.');
}

export async function revokeEmail(formData: FormData) {
  await rpc('/admin/emails', 'admin_revoke_email', { p_id: text(formData, 'id') }, 'Acceso revocado.');
}

export async function adminReleaseDevice(formData: FormData) {
  await rpc('/admin/emails', 'release_device', { p_id: text(formData, 'device_id') }, 'Aparato liberado.');
}

export async function setPrices(formData: FormData) {
  const n = (key: string) => Number(text(formData, key).replace(/\./g, '').replace(',', '.'));
  await rpc('/admin/precios', 'admin_set_prices', { p_online: n('online'), p_transfer: n('transfer'), p_mercadolibre: n('mercadolibre'), p_monthly: n('monthly'), p_extra_device: n('extra_device') }, 'Precios guardados.');
}

export async function setPackPrices(formData: FormData) {
  const n = (key: string) => Number(text(formData, key).replace(/\./g, '').replace(',', '.'));
  await rpc('/admin/precios', 'admin_set_pack_prices', { p_pack: n('pack'), p_with_personal: n('with_personal') }, 'Precios del pack guardados.');
}

export async function givePack(formData: FormData) {
  await rpc('/admin/emails', 'admin_give_pack', { p_id: text(formData, 'id') }, 'Pack Ventas y Stock sumado.');
}

export async function setActivityPrices(formData: FormData) {
  const n = (key: string) => Number(text(formData, key).replace(/\./g, '').replace(',', '.'));
  await rpc('/admin/precios', 'admin_set_activity_prices', { p_secondary: n('extra') / 2, p_extra: n('extra') }, 'Precios de las actividades guardados.');
}
