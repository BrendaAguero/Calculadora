import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Enlace de afiliada: guarda el código 30 días en el navegador, suma una visita (solo un número por día,
// sin datos de quien entra) y lleva a la presentación. Con ?a=comprar lleva directo a la compra.
// El código se aplica recién en la compra, y la base comprueba que sea válido y no propio.
const DESTINATIONS: Record<string, string> = { comprar: "/comprar", registro: "/registro", plus: "/registro?plan=plus" };

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const clean = decodeURIComponent(code).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
  const target = DESTINATIONS[new URL(request.url).searchParams.get("a") ?? ""] ?? "/conocer";
  const response = NextResponse.redirect(new URL(target, request.url));
  if (clean) {
    response.cookies.set("ref", clean, { maxAge: 60 * 60 * 24 * 30, httpOnly: true, sameSite: "lax", secure: true, path: "/" });
    const admin = createAdminClient();
    if (admin) await admin.rpc("track_affiliate_visit", { p_code: clean }).then(({ error }) => { if (error) console.error("[afiliadas] visita", error.message); });
  }
  return response;
}
