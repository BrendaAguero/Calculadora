import { NextResponse } from "next/server";
import { PROMO_COOKIE, cleanCode } from "@/lib/promo";

// Enlace de un código de descuento (por ejemplo, para redes): guarda el código 7 días en el navegador
// y lleva a la compra. El código se valida recién al comprar. Con ?a=plus lleva a Personal Plus.
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const clean = cleanCode(decodeURIComponent(code));
  const target = new URL(request.url).searchParams.get("a") === "plus" ? "/access#emprendedor" : "/comprar";
  const response = NextResponse.redirect(new URL(target, request.url));
  if (clean) response.cookies.set(PROMO_COOKIE, clean, { maxAge: 60 * 60 * 24 * 7, httpOnly: true, sameSite: "lax", secure: true, path: "/" });
  return response;
}
