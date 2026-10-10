import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

// Recibe los enlaces del correo (alta, ingreso con enlace y recuperación de contraseña).
// Acepta dos formatos:
// - ?code=…: el habitual de Supabase. Solo funciona en el mismo navegador donde se pidió el enlace.
// - ?token_hash=…&type=…: funciona en cualquier dispositivo; requiere que la plantilla del correo lo use.
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const next = requestUrl.searchParams.get("next") || "/";
  const fail = (reason: string) => NextResponse.redirect(new URL(`/login?error=${reason}`, requestUrl.origin));

  const supabase = await createClient();
  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return fail("invalid_or_expired_link");
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    // Sin el «code verifier» (enlace abierto en otro navegador o dispositivo) el intercambio falla.
    if (error) return fail(/verifier/i.test(error.message) ? "other_browser" : "invalid_or_expired_link");
  } else {
    return fail("missing_code");
  }

  const { data: { user } } = await supabase.auth.getUser();
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  // Primer ingreso o recuperación: hay que crear la contraseña.
  if (!user?.user_metadata?.password_set || type === "recovery" || safeNext === "/set-password") {
    return NextResponse.redirect(new URL("/set-password", requestUrl.origin));
  }

  return NextResponse.redirect(new URL(safeNext, requestUrl.origin));
}
