import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { registerCurrentDevice } from "@/lib/devices";

const OTP_TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

// «amr» del token de sesión: lista de métodos con que se inició sesión (password, otp, recovery…).
function isRecovery(accessToken?: string) {
  try {
    const payload = JSON.parse(Buffer.from(accessToken!.split(".")[1], "base64url").toString());
    return Array.isArray(payload.amr) && payload.amr.some((entry: { method?: string }) => entry?.method === "recovery");
  } catch {
    return false;
  }
}

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
  let accessToken: string | undefined;
  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return fail("invalid_or_expired_link");
    accessToken = data.session?.access_token;
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    // Sin el «code verifier» (enlace abierto en otro navegador o dispositivo) el intercambio falla.
    if (error) return fail(/verifier/i.test(error.message) ? "other_browser" : "invalid_or_expired_link");
    accessToken = data.session?.access_token;
  } else {
    return fail("missing_code");
  }

  // Solo direcciones de esta misma app (se descartan «//otro.sitio», «/\\otro.sitio» y caracteres raros).
  const safeNext = (() => {
    if (!next.startsWith("/") || /[\\\s\u0000-\u001f]/.test(next)) return "/";
    try {
      const url = new URL(next, requestUrl.origin);
      return url.origin === requestUrl.origin ? url.pathname + url.search + url.hash : "/";
    } catch {
      return "/";
    }
  })();

  // Edición Personal: cada cuenta se usa en una cantidad limitada de aparatos.
  if (!(await registerCurrentDevice())) return fail("device_limit");

  // Recuperación de contraseña: hay que crear una nueva. Se reconoce por el método de ingreso de la sesión,
  // porque Supabase puede descartar ?next= si esa dirección no está permitida. (Con el ingreso por código ya no hace falta contraseña.)
  if (type === "recovery" || isRecovery(accessToken) || safeNext === "/set-password") {
    return NextResponse.redirect(new URL("/set-password", requestUrl.origin));
  }

  return NextResponse.redirect(new URL(safeNext, requestUrl.origin));
}
