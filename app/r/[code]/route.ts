import { NextResponse } from "next/server";

// Enlace de afiliada: guarda el código 30 días en el navegador y lleva a crear la cuenta.
// El código se aplica recién en la compra, y la base comprueba que sea válido y no propio.
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const clean = decodeURIComponent(code).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
  const response = NextResponse.redirect(new URL("/login", request.url));
  if (clean) response.cookies.set("ref", clean, { maxAge: 60 * 60 * 24 * 30, httpOnly: true, sameSite: "lax", secure: true, path: "/" });
  return response;
}
