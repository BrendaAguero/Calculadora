import { syncPreapproval } from "@/lib/mercadopago";
import { siteOrigin } from "@/lib/origin";

// Vuelta desde Mercado Pago después de autorizar la suscripción mensual. Se consulta el estado allá
// (además del aviso por webhook), así la persona ve su plan activo apenas se acredita el primer cobro.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const preapprovalId = url.searchParams.get("preapproval_id") ?? "";
  const origin = await siteOrigin();
  const go = (key: "ok" | "error", message: string) => Response.redirect(`${origin}/access?${key}=${encodeURIComponent(message)}#emprendedor`, 303);

  if (!preapprovalId) return go("error", "No se completó la suscripción. Podés intentar de nuevo cuando quieras.");
  try {
    const result = await syncPreapproval(preapprovalId);
    console.info("Vuelta de suscripción", preapprovalId, result);
    if (result === "activated" || result === "renewed") return go("ok", "¡Suscripción activa! Mercado Pago te va a cobrar cada mes; podés cancelar la renovación cuando quieras.");
    if (result === "preapproval_authorized") return go("ok", "Autorizaste la suscripción. Personal Plus se activa sola apenas Mercado Pago acredite el primer cobro (suele tardar unos minutos).");
    if (result === "preapproval_cancelled") return go("error", "La suscripción quedó cancelada en Mercado Pago.");
    return go("error", "Todavía no se autorizó la suscripción. Si la completaste, se activa sola en unos minutos.");
  } catch (error) {
    console.error("Vuelta de suscripción", preapprovalId, error instanceof Error ? error.message : error);
    return go("error", "No pudimos confirmar la suscripción todavía. Si la autorizaste, se activa sola en unos minutos.");
  }
}
