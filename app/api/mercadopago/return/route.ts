import { processPayment } from "@/lib/mercadopago";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteOrigin } from "@/lib/origin";

// Vuelta desde Mercado Pago. Se confirma el pago en el momento (además del aviso por webhook),
// así la persona ve su plan activo enseguida.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const paymentId = url.searchParams.get("payment_id") ?? url.searchParams.get("collection_id") ?? "";
  const status = url.searchParams.get("status") ?? url.searchParams.get("collection_status") ?? "";
  const origin = await siteOrigin();
  const go = (key: "ok" | "error", message: string) => Response.redirect(`${origin}/access?${key}=${encodeURIComponent(message)}#emprendedor`, 303);

  if (!paymentId || paymentId === "null") {
    // Si era una compra de la Edición Personal sin cuenta, vuelve a la página de compra.
    const reference = url.searchParams.get("external_reference") ?? "";
    const admin = createAdminClient();
    if (admin && /^[0-9a-f-]{36}$/i.test(reference) && (await admin.from("personal_orders").select("id").eq("id", reference).maybeSingle()).data) {
      return Response.redirect(`${origin}/comprar?error=${encodeURIComponent("No se completó el pago. Podés intentar de nuevo cuando quieras.")}`, 303);
    }
    return go("error", "No se completó el pago. Podés intentar de nuevo cuando quieras.");
  }
  try {
    const result = await processPayment(paymentId);
    // Compra online de la Edición Personal (sin cuenta todavía): se manda a entrar con el email.
    if (result.startsWith("personal_")) {
      const login = (key: "ok" | "error", message: string) => Response.redirect(`${origin}/login?${key}=${encodeURIComponent(message)}`, 303);
      if (result === "personal_activated" || result === "personal_already_approved") return login("ok", "¡Gracias por tu compra! Ya podés entrar con tu email: te mandamos un código.");
      if (result === "personal_recorded_pending" || result === "personal_recorded_in_process") return login("ok", "Tu pago quedó pendiente en Mercado Pago. Cuando se acredite, vas a poder entrar con tu email.");
      return login("error", "No pudimos confirmar el pago todavía. Si se cobró, en unos minutos vas a poder entrar con tu email.");
    }
    if (result === "activated" || result === "already_approved") return go("ok", "¡Pago aprobado! Tu compra ya está activa.");
    if (result === "already_has_license") return go("error", "Ya tenías una licencia activa, así que este pago no se aplicó. Escribinos y te devolvemos el dinero.");
    if (result === "recorded_pending") return go("ok", "Tu pago quedó pendiente en Mercado Pago. Se activa solo cuando se acredite.");
    if (result === "recorded_rejected" || status === "rejected") return go("error", "Mercado Pago rechazó el pago. Podés probar con otro medio.");
    if (result === "amount_mismatch") return go("error", "El monto pagado no coincide con el pedido. Escribinos para revisarlo.");
    return go("error", "No pudimos confirmar el pago todavía. Si se cobró, se activa solo en unos minutos.");
  } catch {
    return go("error", "No pudimos confirmar el pago todavía. Si se cobró, se activa solo en unos minutos.");
  }
}
