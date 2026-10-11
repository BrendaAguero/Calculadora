import { getAccessSnapshot } from "@/lib/access/permissions";

// Diagnóstico interno (solo administradoras y cuentas de prueba): a qué cuenta de Mercado Pago pertenecen
// las credenciales configuradas. No muestra ninguna clave.
export async function GET() {
  const snapshot = await getAccessSnapshot();
  if (!snapshot || !(snapshot.isAdmin || snapshot.isTester)) return Response.json({ error: "No autorizado." }, { status: 403 });
  if (!process.env.MP_ACCESS_TOKEN) return Response.json({ configured: false });

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
