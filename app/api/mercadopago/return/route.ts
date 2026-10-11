import { processPayment } from "@/lib/mercadopago";
import { siteOrigin } from "@/lib/origin";

// Vuelta desde Mercado Pago. Se confirma el pago en el momento (además del aviso por webhook),
// así la persona ve su plan activo enseguida.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const paymentId = url.searchParams.get("payment_id") ?? url.searchParams.get("collection_id") ?? "";
  const status = url.searchParams.get("status") ?? url.searchParams.get("collection_status") ?? "";
  const origin = await siteOrigin();
  const go = (key: "ok" | "error", message: string) => Response.redirect(`${origin}/access?${key}=${encodeURIComponent(message)}#emprendedor`, 303);

  if (!paymentId || paymentId === "null") return go("error", "No se completó el pago. Podés intentar de nuevo cuando quieras.");
  try {
    const result = await processPayment(paymentId);
    if (result === "activated" || result === "already_approved") return go("ok", "¡Pago aprobado! Emprendedor ya está activo.");
    if (result === "recorded_pending") return go("ok", "Tu pago quedó pendiente en Mercado Pago. Se activa solo cuando se acredite.");
    if (result === "recorded_rejected" || status === "rejected") return go("error", "Mercado Pago rechazó el pago. Podés probar con otro medio.");
    if (result === "amount_mismatch") return go("error", "El monto pagado no coincide con el pedido. Escribinos para revisarlo.");
    return go("error", "No pudimos confirmar el pago todavía. Si se cobró, se activa solo en unos minutos.");
  } catch {
    return go("error", "No pudimos confirmar el pago todavía. Si se cobró, se activa solo en unos minutos.");
  }
}
