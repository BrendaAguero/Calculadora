"use server";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export type ActionState = { error?: string; success?: boolean };

const PRODUCTION_ORIGIN = "https://calculadora-emprender.vercel.app";

// El enlace del correo tiene que volver al mismo sitio donde se pidió (producción o una vista previa),
// porque el código solo se puede canjear en el navegador que lo pidió. Solo se aceptan sitios de este
// proyecto, para que nadie pueda desviar el enlace con un encabezado falso.
async function authOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "";
  if (/^calculadora-emprender(-[a-z0-9-]+)?\.vercel\.app$/.test(host)) return `https://${host}`;
  if (/^localhost(:\d+)?$/.test(host)) return `http://${host}`;
  return PRODUCTION_ORIGIN;
}

// Mensajes de Supabase traducidos para que la persona sepa qué hacer.
function friendlyEmailError(message: string) {
  if (/rate limit|too many|security purposes/i.test(message)) return "Se pidieron demasiados correos seguidos. Esperá unos minutos y volvé a intentar.";
  if (/not authorized|not allowed/i.test(message)) return "Todavía no se pueden enviar correos a esta dirección: falta configurar el servicio de correo de la aplicación.";
  if (/invalid/i.test(message) && /email/i.test(message)) return "Revisá que el email esté bien escrito.";
  return `No se pudo enviar el correo: ${message}`;
}

export async function requestCode(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") || "").trim();
  const fullName = String(formData.get("full_name") || "").trim();
  const termsAccepted = formData.get("terms_accepted") === "on";

  if (!email) return { error: "Ingresá tu email." };
  if (!termsAccepted) return { error: "Tenés que aceptar los términos para continuar." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${await authOrigin()}/auth/callback`,
      data: { full_name: fullName || null, terms_accepted: "true" },
    },
  });

  if (error) return { error: friendlyEmailError(error.message) };
  return { success: true };
}

// «¿Olvidaste tu contraseña?»: manda un enlace que lleva a crear una contraseña nueva.
// Por seguridad responde lo mismo exista o no la cuenta.
export async function requestPasswordReset(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") || "").trim();
  if (!email) return { error: "Ingresá tu email." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await authOrigin()}/auth/callback?next=/set-password`,
  });
  if (error) return { error: friendlyEmailError(error.message) };
  return { success: true };
}

export async function signInWithPassword(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!email || !password) return { error: "Ingresá tu email y contraseña." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Email o contraseña incorrectos." };
  redirect("/");
}

export async function setPassword(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const password = String(formData.get("password") || "");
  const confirmation = String(formData.get("password_confirmation") || "");
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };
  if (password !== confirmation) return { error: "Las contraseñas no coinciden." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.auth.updateUser({
    password,
    data: { ...user.user_metadata, password_set: true },
  });
  if (error) {
    if (/different from the old/i.test(error.message)) return { error: "La contraseña nueva tiene que ser distinta de la anterior." };
    if (/weak|pwned|leaked/i.test(error.message)) return { error: "Esa contraseña es muy fácil de adivinar o apareció en filtraciones. Elegí otra." };
    return { error: `No se pudo guardar la contraseña: ${error.message}` };
  }
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
