import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { issueKey, sendKeyEmail } from "@/lib/access-key";
import { PRODUCTION_ORIGIN, siteOrigin } from "@/lib/origin";

const API = "https://api.mercadopago.com";

export class MercadoPagoError extends Error {
  constructor(public status: number, public detail: string) {
    super(`Mercado Pago respondió ${status}${detail ? `: ${detail}` : ""}`);
  }
}

export const mercadoPagoReady = () => Boolean(process.env.MP_ACCESS_TOKEN && process.env.SUPABASE_SERVICE_ROLE_KEY);

async function mp<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`, "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (!response.ok) {
    // Mercado Pago explica el problema en «message» (por ejemplo, un email que no es de una cuenta de Mercado Pago).
    const detail = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new MercadoPagoError(response.status, detail?.message ?? "");
  }
  return response.json() as Promise<T>;
}

// Crea el pago en Mercado Pago (Checkout Pro). external_reference = id de la compra en nuestra base.
// No se envía el email de la persona: Mercado Pago lo pide en su página, y si no coincide con la cuenta con la que
// se paga (por ejemplo, un comprador de prueba) deja el botón de pagar deshabilitado.
export async function createPreference(input: { purchaseId: string; title: string; price: number; origin: string }) {
  const isLocal = input.origin.startsWith("http://");
  const preference = await mp<{ id: string; init_point: string }>("/checkout/preferences", {
    method: "POST",
    body: JSON.stringify({
      items: [{ id: input.purchaseId, title: input.title, quantity: 1, unit_price: Math.round(input.price * 100) / 100, currency_id: "ARS" }],
      external_reference: input.purchaseId,
      back_urls: {
        success: `${input.origin}/api/mercadopago/return`,
        pending: `${input.origin}/api/mercadopago/return`,
        failure: `${input.origin}/api/mercadopago/return`,
      },
      auto_return: isLocal ? undefined : "approved",
      notification_url: isLocal ? undefined : `${input.origin}/api/mercadopago/webhook`,
      statement_descriptor: "CALC EMPRENDER",
    }),
  });
  // Con las credenciales actuales (las de la pestaña «Prueba» pertenecen a un vendedor de prueba) se usa
  // el checkout normal; para probar hay que pagar con OTRA cuenta de prueba, la compradora.
  return { id: preference.id, url: preference.init_point };
}

type Payment = { id: number; status: string; status_detail: string; transaction_amount: number; currency_id: string; external_reference: string | null; order?: { id?: string } };

// Nunca se confía en lo que llega por la URL o el aviso: se consulta el pago a Mercado Pago y recién ahí se registra.
export async function processPayment(paymentId: string) {
  if (!/^\d+$/.test(paymentId)) return "invalid_payment_id";
  const admin = createAdminClient();
  if (!admin || !process.env.MP_ACCESS_TOKEN) return "not_configured";
  const payment = await mp<Payment>(`/v1/payments/${paymentId}`);

  // Un pago que ya conocemos (por ejemplo, el cobro de una renovación que después se devuelve) se asocia a su compra.
  const { data: known } = await admin.from("payment_transactions").select("purchase_id").eq("provider", "mercadopago").eq("external_payment_id", String(payment.id)).maybeSingle();
  let purchaseId = known?.purchase_id ?? payment.external_reference;
  if (!purchaseId || !/^[0-9a-f-]{36}$/i.test(purchaseId)) return "no_reference";

  // Cobro de la suscripción mensual: external_reference es el id de la suscripción, no de una compra.
  if (!known) {
    const { data: purchase } = await admin.from("purchases").select("id").eq("id", purchaseId).maybeSingle();
    if (!purchase) {
      const { data: sub } = await admin.from("subscriptions").select("id,external_preapproval_id").eq("id", purchaseId).eq("duration_months", 1).maybeSingle();
      if (sub) return recordSubscriptionPayment(sub.id, sub.external_preapproval_id, payment);
      // Pedido online de la Edición Personal (se compra sin cuenta, con el email).
      const { data: order } = await admin.from("personal_orders").select("id").eq("id", purchaseId).maybeSingle();
      if (!order) return "purchase_not_found";
      return recordPersonalOrder(order.id, payment);
    }
    purchaseId = purchase.id;
  }

  const { data, error } = await admin.rpc("mp_record_payment", {
    p: {
      purchase_id: purchaseId,
      payment_id: String(payment.id),
      preference_id: payment.order?.id ?? null,
      status: payment.status,
      status_detail: payment.status_detail,
      amount: payment.transaction_amount,
      currency: payment.currency_id,
    },
  });
  if (error) throw new Error(error.message);
  await cancelStalePreapprovals(purchaseId);
  return data as string;
}

async function recordPersonalOrder(orderId: string, payment: Payment) {
  const admin = createAdminClient();
  if (!admin) return "not_configured";
  const { data, error } = await admin.rpc("mp_record_personal_order", {
    p: { order_id: orderId, payment_id: String(payment.id), status: payment.status, amount: payment.transaction_amount, currency: payment.currency_id },
  });
  if (error) throw new Error(error.message);
  // Recién aprobado: se crea la clave de acceso y se manda por correo (una sola vez, porque solo un aviso lo activa).
  if (data === "activated") await sendPersonalKey(admin, orderId);
  return `personal_${data as string}`;
}

async function sendPersonalKey(admin: NonNullable<ReturnType<typeof createAdminClient>>, orderId: string) {
  try {
    const { data: order } = await admin.from("personal_orders").select("email").eq("id", orderId).maybeSingle();
    if (!order) return;
    const { data: rows } = await admin.rpc("approved_email_for", { p_email: order.email });
    const approved = (rows as { id: string; key_hash: string | null }[] | null)?.[0];
    if (!approved || approved.key_hash) return;
    const key = await issueKey(admin, approved.id);
    let origin = PRODUCTION_ORIGIN;
    try { origin = await siteOrigin(); } catch { /* fuera de una petición: se usa producción */ }
    await sendKeyEmail(order.email, key, origin);
  } catch (error) {
    // El pago ya quedó aprobado; si falla el correo, la administración puede reenviar la clave.
    console.error("No se pudo mandar la clave de acceso", error instanceof Error ? error.message : error);
  }
}

// ---------------------------------------------------------------------------------------------
// Suscripción mensual con renovación automática (Suscripciones de Mercado Pago, «preapproval»).
// La persona autoriza en Mercado Pago un cobro por mes; cada cobro aprobado suma un mes de Emprendedor.

type Preapproval = { id: string; status: string; external_reference: string | null; init_point?: string };
type AuthorizedPayment = { id: number; preapproval_id: string; payment?: { id?: number; status?: string } | null };

// Mercado Pago exige el email de la cuenta de Mercado Pago con la que se va a pagar.
export async function createPreapproval(input: { subscriptionId: string; price: number; payerEmail: string; origin: string }) {
  const isLocal = input.origin.startsWith("http://");
  const preapproval = await mp<Preapproval>("/preapproval", {
    method: "POST",
    body: JSON.stringify({
      reason: "Calculadora Emprender · Emprendedor mensual",
      external_reference: input.subscriptionId,
      payer_email: input.payerEmail,
      auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: Math.round(input.price * 100) / 100, currency_id: "ARS" },
      back_url: isLocal ? "https://calculadora-emprender.vercel.app/access" : `${input.origin}/api/mercadopago/suscripcion`,
      status: "pending",
    }),
  });
  const admin = createAdminClient();
  if (admin) await admin.rpc("mp_update_preapproval", { p_subscription_id: input.subscriptionId, p_preapproval_id: preapproval.id, p_status: preapproval.status });
  return { id: preapproval.id, url: preapproval.init_point! };
}

async function recordSubscriptionPayment(subscriptionId: string, preapprovalId: string | null, payment: Payment) {
  const admin = createAdminClient();
  if (!admin) return "not_configured";
  const { data, error } = await admin.rpc("mp_record_subscription_payment", {
    p: {
      subscription_id: subscriptionId,
      preapproval_id: preapprovalId,
      payment_id: String(payment.id),
      status: payment.status,
      status_detail: payment.status_detail,
      amount: payment.transaction_amount,
      currency: payment.currency_id,
    },
  });
  if (error) throw new Error(error.message);
  return data as string;
}

// Trae el estado de la suscripción en Mercado Pago y registra los cobros aprobados que todavía no estén.
export async function syncPreapproval(preapprovalId: string) {
  const admin = createAdminClient();
  if (!admin || !process.env.MP_ACCESS_TOKEN) return "not_configured";
  if (!/^[\w-]{6,64}$/.test(preapprovalId)) return "invalid_preapproval_id";
  const preapproval = await mp<Preapproval>(`/preapproval/${preapprovalId}`);
  const subscriptionId = preapproval.external_reference;
  if (!subscriptionId || !/^[0-9a-f-]{36}$/i.test(subscriptionId)) return "no_reference";
  const { data: updated } = await admin.rpc("mp_update_preapproval", { p_subscription_id: subscriptionId, p_preapproval_id: preapproval.id, p_status: preapproval.status });
  if (updated !== "updated") return String(updated);

  let result = `preapproval_${preapproval.status}`;
  const search = await mp<{ results?: AuthorizedPayment[] }>(`/authorized_payments/search?preapproval_id=${encodeURIComponent(preapproval.id)}`).catch(() => ({ results: [] }));
  for (const charge of search.results ?? []) {
    if (!charge.payment?.id) continue;
    const payment = await mp<Payment>(`/v1/payments/${charge.payment.id}`);
    const recorded = await recordSubscriptionPayment(subscriptionId, preapproval.id, payment);
    if (recorded === "activated" || recorded === "renewed") result = recorded;
  }
  return result;
}

// Aviso de un cobro de la suscripción («subscription_authorized_payment»).
export async function processAuthorizedPayment(authorizedPaymentId: string) {
  if (!/^\d+$/.test(authorizedPaymentId)) return "invalid_id";
  if (!process.env.MP_ACCESS_TOKEN) return "not_configured";
  const charge = await mp<AuthorizedPayment>(`/authorized_payments/${authorizedPaymentId}`);
  return syncPreapproval(charge.preapproval_id);
}

// Enlace para autorizar una suscripción ya creada (si la persona vuelve a «Pagar»).
export async function getPreapprovalUrl(preapprovalId: string) {
  const preapproval = await mp<Preapproval>(`/preapproval/${preapprovalId}`);
  if (!preapproval.init_point || preapproval.status !== "pending") throw new Error("La suscripción ya no está pendiente");
  return preapproval.init_point;
}

export async function cancelPreapproval(preapprovalId: string) {
  await mp<Preapproval>(`/preapproval/${preapprovalId}`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) });
}

// Cancela en Mercado Pago las suscripciones que acá ya no se renuevan (la persona canceló, compró 6 o 12 meses,
// se devolvió el pago o se canceló el pedido), para que no se le siga cobrando. Si falla, se reintenta la próxima vez.
export async function cancelStalePreapprovals(purchaseOrUserId: { purchaseId?: string; userId?: string } | string) {
  const admin = createAdminClient();
  if (!admin || !process.env.MP_ACCESS_TOKEN) return;
  let userId = typeof purchaseOrUserId === "string" ? undefined : purchaseOrUserId.userId;
  const purchaseId = typeof purchaseOrUserId === "string" ? purchaseOrUserId : purchaseOrUserId.purchaseId;
  if (!userId && purchaseId) userId = (await admin.from("purchases").select("user_id").eq("id", purchaseId).maybeSingle()).data?.user_id;
  if (!userId) return;
  const { data: subs } = await admin.from("subscriptions").select("id,status,auto_renew,external_preapproval_id,preapproval_status").eq("user_id", userId).not("external_preapproval_id", "is", null);
  for (const sub of subs ?? []) {
    const live = sub.auto_renew && ["pending", "active"].includes(sub.status);
    if (live || sub.preapproval_status === "cancelled") continue;
    try {
      await cancelPreapproval(sub.external_preapproval_id!);
      await admin.rpc("mp_update_preapproval", { p_subscription_id: sub.id, p_preapproval_id: sub.external_preapproval_id, p_status: "cancelled" });
    } catch (error) {
      console.error("No se pudo cancelar la suscripción en Mercado Pago", sub.id, error instanceof Error ? error.message : error);
    }
  }
}

// Al abrir «Mi acceso»: confirma cobros de la suscripción que no llegaron por aviso y cancela las que ya no van.
export async function syncUserPreapprovals(userId: string) {
  const admin = createAdminClient();
  if (!admin || !process.env.MP_ACCESS_TOKEN) return;
  const { data: subs } = await admin.from("subscriptions").select("id,status,auto_renew,expires_at,external_preapproval_id").eq("user_id", userId).eq("duration_months", 1).not("external_preapproval_id", "is", null);
  const soon = Date.now() + 3 * 24 * 60 * 60 * 1000;
  for (const sub of subs ?? []) {
    const due = sub.status === "pending" || (sub.status === "active" && sub.auto_renew && new Date(sub.expires_at).getTime() < soon);
    if (!due) continue;
    const result = await syncPreapproval(sub.external_preapproval_id!).catch((error) => `error: ${error instanceof Error ? error.message : error}`);
    console.info("Suscripción de Mercado Pago", sub.id, result);
  }
  await cancelStalePreapprovals({ userId });
}
