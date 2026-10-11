import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const API = "https://api.mercadopago.com";

export const mercadoPagoReady = () => Boolean(process.env.MP_ACCESS_TOKEN && process.env.SUPABASE_SERVICE_ROLE_KEY);

async function mp<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`, "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Mercado Pago respondió ${response.status}`);
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
  return preference;
}

type Payment = { id: number; status: string; status_detail: string; transaction_amount: number; currency_id: string; external_reference: string | null; order?: { id?: string } };

// Nunca se confía en lo que llega por la URL o el aviso: se consulta el pago a Mercado Pago y recién ahí se registra.
export async function processPayment(paymentId: string) {
  if (!/^\d+$/.test(paymentId)) return "invalid_payment_id";
  const admin = createAdminClient();
  if (!admin || !process.env.MP_ACCESS_TOKEN) return "not_configured";
  const payment = await mp<Payment>(`/v1/payments/${paymentId}`);
  if (!payment.external_reference || !/^[0-9a-f-]{36}$/i.test(payment.external_reference)) return "no_reference";
  const { data, error } = await admin.rpc("mp_record_payment", {
    p: {
      purchase_id: payment.external_reference,
      payment_id: String(payment.id),
      preference_id: payment.order?.id ?? null,
      status: payment.status,
      status_detail: payment.status_detail,
      amount: payment.transaction_amount,
      currency: payment.currency_id,
    },
  });
  if (error) throw new Error(error.message);
  return data as string;
}
