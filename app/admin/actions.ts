'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin';
import { STAFF_LOGIN_PATH, hasStaffSession } from '@/lib/staff';
import { decryptKey, issueKey, sendKeyEmail } from '@/lib/access-key';
import { siteOrigin } from '@/lib/origin';
import { notifyAffiliate } from '@/lib/notify';
import { resellerSaleRange } from '@/lib/reseller';
import { CONTACT_EMAIL } from '@/lib/legal';
import { fromLocalAR } from '@/lib/announcements';
import { removePhoto, uploadPhoto } from '@/lib/photos';

const text = (formData: FormData, key: string) => String(formData.get(key) ?? '').trim();
const back = (path: string, key: 'ok' | 'error', message: string): never => redirect(`${path}${path.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(message.slice(0, 300))}`);

// Todas las acciones pasan por funciones de la base que comprueban que sea administradora y dejan registro.
async function rpc(path: string, fn: string, args: Record<string, unknown>, ok: string, after?: () => Promise<unknown>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  if (!(await hasStaffSession(user.id))) redirect(`${STAFF_LOGIN_PATH}?next=/admin`);
  const { error } = await supabase.rpc(fn, args);
  if (error) back(path, 'error', error.message);
  // Lo que se hace después de guardar (por ejemplo, avisar por correo) no debe deshacer lo guardado.
  if (after) await after().catch((e) => console.error('[admin] aviso posterior', e instanceof Error ? e.message : e));
  revalidatePath(path.split('?')[0]);
  back(path, 'ok', ok);
}

export async function setAccountStatus(formData: FormData) {
  const status = text(formData, 'status');
  await rpc('/admin/usuarios', 'admin_set_account_status', { p_user_id: text(formData, 'user_id'), p_status: status }, status === 'active' ? 'Cuenta reactivada.' : 'Cuenta suspendida.');
}

export async function grantLicense(formData: FormData) {
  const months = text(formData, 'months');
  await rpc('/admin/usuarios', 'admin_grant_license_for', {
    p_user_id: text(formData, 'user_id'), p_plan_code: text(formData, 'plan') || 'ADVANCED', p_reason: text(formData, 'reason'),
    p_months: months === '1' || months === '2' ? Number(months) : null,
  }, months === '1' ? 'Licencia de cortesía otorgada por 1 mes.' : months === '2' ? 'Licencia de cortesía otorgada por 2 meses.' : 'Licencia de cortesía otorgada sin vencimiento.');
}

// Email de la afiliada (para avisarle). Solo la administración llega acá.
async function affiliateEmail(affiliateId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('affiliates').select('profiles(email)').eq('id', affiliateId).maybeSingle();
  const profile = data?.profiles as { email?: string } | { email?: string }[] | null | undefined;
  return (Array.isArray(profile) ? profile[0]?.email : profile?.email) ?? null;
}

export async function reviewAffiliate(formData: FormData) {
  const approve = text(formData, 'decision') === 'approve';
  const affiliateId = text(formData, 'affiliate_id');
  const pct = Number(text(formData, 'percentage') || 15);
  await rpc('/admin/afiliados', 'admin_review_affiliate', { p_affiliate_id: affiliateId, p_approve: approve, p_percentage: pct }, approve ? 'Afiliada aprobada: ya tiene su código y le avisamos por correo.' : 'Solicitud rechazada.', async () => {
    const to = await affiliateEmail(affiliateId);
    await notifyAffiliate(to, approve ? 'Ya sos afiliada' : 'Tu solicitud de afiliada', approve
      ? [`Aprobamos tu solicitud: ya tenés tu código y tu enlace para compartir, con una comisión del ${pct} % por cada compra.`, 'En tu panel encontrás textos listos para redes y WhatsApp.']
      : ['Por ahora no pudimos aprobar tu solicitud para el programa de afiliadas. Si querés contarnos más, respondé este correo.']);
  });
}

export async function setAffiliatePercentage(formData: FormData) {
  await rpc('/admin/afiliados', 'admin_set_affiliate_percentage', { p_affiliate_id: text(formData, 'affiliate_id'), p_pct: Number(text(formData, 'pct').replace(',', '.')) }, 'Comisión actualizada: rige para las ventas nuevas.');
}

export async function cancelAffiliateCommissions(formData: FormData) {
  if (formData.get('confirm') !== 'on') back('/admin/afiliados', 'error', 'Marcá la casilla para confirmar que querés anular sus comisiones pendientes.');
  await rpc('/admin/afiliados', 'admin_cancel_affiliate_commissions', { p_affiliate_id: text(formData, 'affiliate_id'), p_reason: text(formData, 'reason') }, 'Comisiones pendientes anuladas. Las ya pagadas no cambian.');
}

export async function setAffiliateWithdrawalMin(formData: FormData) {
  const n = (k: string) => Number(text(formData, k).replace(/\./g, '').replace(',', '.'));
  await rpc('/admin/afiliados', 'admin_set_affiliate_withdrawal_min', { p_min: n('min'), p_min_pro: n('min_pro') }, 'Mínimos de retiro guardados.');
}

export async function setAffiliateAnnualDiscount(formData: FormData) {
  await rpc('/admin/afiliados', 'admin_set_affiliate_annual_discount', { p_pct: Number(text(formData, 'pct').replace(',', '.')) }, 'Descuento del plan anual con código guardado.');
}

export async function setAffiliateStatus(formData: FormData) {
  const status = text(formData, 'status');
  await rpc('/admin/afiliados', 'admin_set_affiliate_status', { p_affiliate_id: text(formData, 'affiliate_id'), p_status: status }, status === 'approved' ? 'Afiliada reactivada.' : 'Afiliada suspendida.');
}

export async function updateWithdrawal(formData: FormData) {
  const status = text(formData, 'status');
  const withdrawalId = text(formData, 'withdrawal_id');
  await rpc('/admin/afiliados', 'admin_update_withdrawal', { p_withdrawal_id: withdrawalId, p_status: status, p_notes: text(formData, 'notes') }, status === 'paid' ? 'Retiro marcado como pagado. Le avisamos por correo.' : 'Retiro actualizado.', async () => {
    if (status !== 'paid' && status !== 'rejected') return;
    const supabase = await createClient();
    const { data: w } = await supabase.from('withdrawals').select('amount,affiliate_id,notes').eq('id', withdrawalId).maybeSingle();
    if (!w) return;
    const amount = Number(w.amount).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
    await notifyAffiliate(await affiliateEmail(w.affiliate_id), status === 'paid' ? `Te pagamos ${amount}` : 'Tu pedido de retiro', status === 'paid'
      ? [`Te transferimos ${amount} de tus comisiones de afiliada.${w.notes ? ` Referencia: ${w.notes}.` : ''}`, 'Si en unos días no lo ves en tu cuenta, avisanos.']
      : ['No pudimos hacer tu retiro con los datos que nos pasaste. Tus comisiones volvieron a estar disponibles: revisá tus datos de cobro y pedilo de nuevo.', ...(w.notes ? [`Detalle: ${w.notes}`] : [])]);
  });
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
  const { supabase } = await requireAdmin();
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
  const { supabase } = await requireAdmin();
  const approve = text(formData, 'approve') === '1';
  const { data: id, error } = await supabase.rpc('admin_decide_reseller_client', { p_id: text(formData, 'id'), p_approve: approve, p_note: text(formData, 'note') || null });
  if (error) back('/admin/emails', 'error', error.message);
  if (!approve) { revalidatePath('/admin/emails'); back('/admin/emails', 'ok', 'Solicitud rechazada. La licencia volvió al saldo de la revendedora.'); }
  let sent = false;
  try {
    const admin = createAdminClient();
    const { data: row } = admin ? await admin.from('approved_emails').select('email,key_cipher').eq('id', id as string).maybeSingle() : { data: null };
    const key = decryptKey(row?.key_cipher) ?? await issueKey(supabase, id as string);
    // Aviso para la clienta: compró a una revendedora autorizada y hasta cuánto le podían cobrar.
    const { data: cfg } = admin ? await admin.from('pricing_config').select('key,value_numeric').in('key', ['personal_price_online', 'reseller_max_markup_pct']) : { data: null };
    const num = (k: string) => Number(cfg?.find((c) => c.key === k)?.value_numeric ?? 0);
    const range = resellerSaleRange(num('personal_price_online'), num('reseller_max_markup_pct'));
    const peso = (n: number) => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
    const note = range.min > 0 ? `Compraste a través de una revendedora autorizada. El precio oficial es ${peso(range.min)}${range.pct > 0 ? ` y las revendedoras pueden cobrar hasta ${peso(range.max)} por su atención (por ejemplo, ayudarte a empezar o aceptar otros medios de pago)` : ''}. Si te cobraron más, escribinos a ${CONTACT_EMAIL}.` : undefined;
    if (row?.email) sent = await sendKeyEmail(row.email, key, await siteOrigin(), note);
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
  const { supabase } = await requireAdmin();
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

// Ajuste por inflación: sube todos los precios el % indicado (redondeados a $100). La base controla el margen de revendedoras.
export async function adjustPrices(formData: FormData) {
  const pct = Number(text(formData, 'pct').replace(',', '.'));
  if (formData.get('confirm') !== 'on') back('/admin/precios', 'error', 'Tildá la confirmación para ajustar todos los precios.');
  await rpc('/admin/precios', 'admin_adjust_prices', { p_pct: pct }, `Listo: todos los precios subieron ${pct.toLocaleString('es-AR')} %. Las Personal Plus mensuales ya contratadas siguen con su monto.`);
}

export async function setLoyaltyDiscounts(formData: FormData) {
  const n = (key: string) => Math.round(Number(text(formData, key).replace(',', '.')));
  await rpc('/admin/precios', 'admin_set_loyalty_discounts', {
    p_d1: n('d1'), p_p1: n('p1'), p_d2: n('d2'), p_p2: n('p2'), p_d3: n('d3'), p_p3: n('p3'),
  }, 'Descuentos por antigüedad guardados.');
}

export async function setResellerMarkup(formData: FormData) {
  await rpc('/admin/revendedoras', 'admin_set_reseller_markup', { p_pct: Number(text(formData, 'markup').replace(',', '.')) }, 'Tope de precio de venta guardado.');
}

export async function setResellerMargin(formData: FormData) {
  await rpc('/admin/revendedoras', 'admin_set_reseller_margin', { p_pct: Number(text(formData, 'margin').replace(',', '.')) }, 'Margen mínimo guardado.');
}

export async function setMaxFreeAccounts(formData: FormData) {
  const raw = text(formData, 'max').replace(/\./g, '');
  await rpc('/admin/usuarios', 'admin_set_max_free_accounts', { p_max: raw === '' ? null : Number(raw) }, raw === '' ? 'Listo: la versión gratis queda sin tope.' : 'Tope de cuentas gratis guardado.');
}

export async function setPlusTrialDays(formData: FormData) {
  await rpc('/admin/precios', 'admin_set_plus_trial_days', { p_days: Number(text(formData, 'days')) }, 'Días de prueba guardados.');
}

export async function setPlusAnnualPrice(formData: FormData) {
  const n = Number(text(formData, 'annual').replace(/\./g, '').replace(',', '.'));
  await rpc('/admin/precios', 'admin_set_plus_annual_price', { p_price: n }, 'Precio anual de Personal Plus guardado.');
}

export async function setPackPrices(formData: FormData) {
  const n = (key: string) => Number(text(formData, key).replace(/\./g, '').replace(',', '.'));
  await rpc('/admin/precios', 'admin_set_pack_prices', { p_pack: n('pack'), p_with_personal: n('with_personal') }, 'Precios del pack guardados.');
}

export async function setModulePrices(formData: FormData) {
  const { supabase } = await requireAdmin();
  for (const code of ['COLORES', 'CUADERNO']) {
    const price = Number(text(formData, code).replace(/\./g, '').replace(',', '.'));
    const { error } = await supabase.rpc('admin_set_module_price', { p_code: code, p_price: price });
    if (error) back('/admin/precios', 'error', error.message);
  }
  revalidatePath('/admin/precios');
  back('/admin/precios', 'ok', 'Precios de los módulos del taller guardados.');
}

export async function givePack(formData: FormData) {
  await rpc('/admin/emails', 'admin_give_pack', { p_id: text(formData, 'id') }, 'Pack Ventas y Stock sumado.');
}

export async function setRegularPrice(formData: FormData) {
  const n = Number(text(formData, 'regular').replace(/\./g, '').replace(',', '.') || 0);
  const lastDay = text(formData, 'last_day');
  const day = /^\d{4}-\d{2}-\d{2}$/.test(lastDay) && n > 0 ? lastDay : null;
  await rpc('/admin/precios', 'admin_set_launch', { p_regular: n, p_last_day: day },
    n > 0 ? (day ? 'Listo: el lanzamiento termina solo en la fecha elegida y el precio pasa al normal.' : 'Precio normal guardado: se muestra tachado en la compra.') : 'Precio tachado quitado.');
}

export async function setActivityPrices(formData: FormData) {
  const n = (key: string) => Number(text(formData, key).replace(/\./g, '').replace(',', '.'));
  await rpc('/admin/precios', 'admin_set_activity_prices', { p_secondary: n('extra') / 2, p_extra: n('extra') }, 'Precios de las actividades guardados.');
}

// Equipo: nombrar o sacar moderadoras (solo administración).
export async function setModerator(formData: FormData) {
  const add = text(formData, 'moderator') === '1';
  await rpc('/admin/equipo', 'admin_set_moderator', { p_email: text(formData, 'email'), p_moderator: add }, add ? 'Listo: ya es moderadora. Que entre por el ingreso del equipo.' : 'Ya no es moderadora.');
}

// Avisos emergentes (novedades, cambios, promociones). Con «Cuentas específicas», solo los ven esos emails.
export async function saveAnnouncement(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = text(formData, 'id');
  const link = text(formData, 'button_link');
  if (link && !/^\/[^/]/.test(link) && !/^https:\/\//.test(link)) back('/admin/avisos', 'error', 'El enlace del botón tiene que ser una pantalla de la app (por ejemplo /access) o empezar con https://');
  if (link && !text(formData, 'button_label')) back('/admin/avisos', 'error', 'Si ponés un enlace, escribí también el texto del botón.');
  const announcementId = /^[0-9a-f-]{36}$/i.test(id) ? id : null;
  const keepImage = text(formData, 'image_action') === 'keep';
  const { data: before } = announcementId ? await supabase.from('announcements').select('image').eq('id', announcementId).maybeSingle() : { data: null };
  const image = keepImage ? null : await uploadPhoto(formData.get('image'), 'publicas', 'avisos');
  const { data, error } = await supabase.rpc('admin_save_announcement_v2', {
    p_id: announcementId,
    p_kind: text(formData, 'kind'), p_title: text(formData, 'title').slice(0, 100), p_body: text(formData, 'body').slice(0, 1500),
    p_image: image, p_keep_image: keepImage,
    p_button_label: text(formData, 'button_label').slice(0, 40) || null, p_button_link: link || null,
    p_audience: text(formData, 'audience'), p_starts_at: fromLocalAR(text(formData, 'starts_at')), p_ends_at: fromLocalAR(text(formData, 'ends_at')),
    p_active: formData.get('active') === 'on', p_target_emails: text(formData, 'target_emails').slice(0, 30000),
  });
  if (error) {
    await removePhoto(image);
    back('/admin/avisos', 'error', error.message);
  }
  if (!keepImage) await removePhoto(before?.image);
  const result = data as { targets: number; missing: string[] } | null;
  revalidatePath('/admin/avisos');
  const targeted = text(formData, 'audience') === 'users';
  const missing = result?.missing?.length ? ` Sin cuenta en la app (no lo van a ver): ${result.missing.slice(0, 10).join(', ')}${result.missing.length > 10 ? '…' : ''}.` : '';
  back('/admin/avisos', 'ok', `${id ? 'Aviso actualizado.' : 'Aviso creado.'}${targeted ? ` Lo van a ver ${result?.targets ?? 0} cuenta(s).` : ''}${missing}`);
}

// Avisos automáticos: la app los muestra sola cuando alguien cumple la condición.
export async function saveAutoNotice(formData: FormData) {
  const int = (key: string, min: number, max: number, fallback: number) => {
    const n = Math.round(Number(text(formData, key).replace(',', '.')));
    return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
  };
  const link = text(formData, 'button_link');
  if (link && !/^\/[^/]/.test(link) && !/^https:\/\//.test(link)) back('/admin/avisos', 'error', 'El enlace del botón tiene que ser una pantalla de la app (por ejemplo /comprar) o empezar con https://');
  await rpc('/admin/avisos', 'admin_save_auto_notice', {
    p_code: text(formData, 'code'), p_active: formData.get('active') === 'on', p_kind: text(formData, 'kind'),
    p_title: text(formData, 'title').slice(0, 100), p_body: text(formData, 'body').slice(0, 1500),
    p_button_label: text(formData, 'button_label').slice(0, 40) || null, p_button_link: link || null,
    p_days: int('days', 0, 3650, 14), p_discount_pct: int('discount_pct', 0, 90, 0), p_offer_days: int('offer_days', 1, 90, 7), p_repeat_days: int('repeat_days', 0, 3650, 0),
  }, 'Aviso automático guardado.');
}

export async function setAnnouncementActive(formData: FormData) {
  const active = text(formData, 'active') === '1';
  await rpc('/admin/avisos', 'admin_set_announcement_active', { p_id: text(formData, 'id'), p_active: active }, active ? 'Aviso activado.' : 'Aviso pausado: ya no aparece.');
}

// ---------------------------------------------------------------------------------------------
// Códigos de descuento.

const DISCOUNT_PATH = '/admin/descuentos';

export async function createDiscountCodes(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  if (!(await hasStaffSession(user.id))) redirect(`${STAFF_LOGIN_PATH}?next=/admin`);
  const num = (k: string) => { const v = text(formData, k).replace(/\./g, '').replace(',', '.'); return v ? Number(v) : null; };
  const count = text(formData, 'mode') === 'batch' ? num('count') ?? 0 : 1;
  const appliesTo = formData.getAll('applies_to').map(String);
  const startDay = text(formData, 'starts_on');
  const endDay = text(formData, 'expires_on');
  const { data, error } = await supabase.rpc('admin_create_discount_codes', {
    p_code: text(formData, 'code'),
    p_count: count,
    p_kind: text(formData, 'kind'),
    p_value: num('value'),
    p_applies_to: appliesTo,
    p_starts_at: startDay ? fromLocalAR(`${startDay}T00:00`) : null,
    p_expires_at: endDay ? fromLocalAR(`${endDay}T23:59`) : null,
    p_max_uses: count > 1 ? 1 : num('max_uses'),
    p_once_per_person: formData.get('once_per_person') === 'on',
    p_first_purchase_only: formData.get('first_purchase_only') === 'on',
    p_only_email: text(formData, 'only_email') || null,
    p_note: text(formData, 'note') || null,
  });
  if (error) back(DISCOUNT_PATH, 'error', error.message);
  const codes = (data ?? []) as string[];
  revalidatePath(DISCOUNT_PATH);
  if (codes.length > 1) redirect(`${DISCOUNT_PATH}?nuevos=${encodeURIComponent(codes.join(','))}#nuevos`);
  back(DISCOUNT_PATH, 'ok', `Código ${codes[0]} creado.`);
}

export async function setDiscountCodeActive(formData: FormData) {
  const active = text(formData, 'active') === '1';
  await rpc(DISCOUNT_PATH, 'admin_set_discount_code_active', { p_id: text(formData, 'id') || null, p_batch: text(formData, 'batch') || null, p_active: active }, active ? 'Código activado.' : 'Código pausado: ya no se puede usar.');
}
