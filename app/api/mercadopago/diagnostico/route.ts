import { getAccessSnapshot } from "@/lib/access/permissions";
import { isLeakedPassword } from "@/lib/password";

// Diagnóstico interno (solo administradoras y cuentas de prueba): a qué cuenta de Mercado Pago pertenecen
// las credenciales configuradas. No muestra ninguna clave.
export async function GET(request: Request) {
  const snapshot = await getAccessSnapshot();
  if (!snapshot || !(snapshot.isAdmin || snapshot.isTester)) return Response.json({ error: "No autorizado." }, { status: 403 });
  // ?claves=1: prueba el control de contraseñas filtradas con una contraseña conocida («password123»).
  if (new URL(request.url).searchParams.get("claves")) {
    const res = await fetch("https://api.pwnedpasswords.com/range/CBFDA", { headers: { "Add-Padding": "true", "User-Agent": "calculadora-emprender" }, cache: "no-store" }).catch((error) => error as Error);
    if (res instanceof Error) return Response.json({ pwned: "error", message: res.message });
    return Response.json({ pwned: res.status, leakedPassword123: await isLeakedPassword("password123") });
  }
  if (!process.env.MP_ACCESS_TOKEN) return Response.json({ configured: false });

  // ?pago=ID: quién pagó ese pago (sirve para saber el email del comprador de prueba).
  const paymentId = new URL(request.url).searchParams.get("pago") ?? "";
  if (/^\d+$/.test(paymentId)) {
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` }, cache: "no-store" });
    const payment = (await res.json().catch(() => ({}))) as { status?: string; payer?: { id?: string | number; email?: string } };
    return Response.json({ httpStatus: res.status, status: payment.status ?? null, payerId: payment.payer?.id ?? null, payerEmail: payment.payer?.email ?? null });
  }

  const response = await fetch("https://api.mercadopago.com/users/me", {
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    cache: "no-store",
  });
  const user = (await response.json().catch(() => ({}))) as { id?: number; nickname?: string; site_id?: string; country_id?: string; tags?: string[] };
  return Response.json({
    configured: true,
    httpStatus: response.status,
    accountId: user.id ?? null,
    nickname: user.nickname ?? null,
    site: user.site_id ?? null,
    country: user.country_id ?? null,
    isTestUser: (user.tags ?? []).includes("test_user"),
    tags: user.tags ?? [],
    vercelEnv: process.env.VERCEL_ENV ?? null,
  });
}
