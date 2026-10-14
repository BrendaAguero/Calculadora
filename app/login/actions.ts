"use server";

import { createClient } from "@/lib/supabase/server";
import { siteOrigin as authOrigin } from "@/lib/origin";
import { redirect } from "next/navigation";
import { isLeakedPassword, weakPasswordReason } from "@/lib/password";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEVICE_LIMIT_MESSAGE, registerCurrentDevice } from "@/lib/devices";
import { hashKey, normalizeKey } from "@/lib/access-key";
import { allowAttempt, TOO_MANY } from "@/lib/rate-limit";
import { closeStaffSession } from "@/lib/staff";

export type ActionState = { error?: string; success?: boolean; email?: string };

// Mensajes de Supabase traducidos para que la persona sepa qué hacer.
function friendlyEmailError(message: string) {
  // Límite por persona: Supabase pide esperar unos segundos entre un correo y otro a la misma dirección.
  if (/security purposes|after \d+ seconds/i.test(message)) return "Ya te enviamos un correo hace instantes. Esperá un minuto antes de pedir otro.";
  // Límite general de la aplicación: el servicio de correo gratuito permite muy pocos envíos por hora en total.
  if (/rate limit|too many/i.test(message)) return "El servicio de correo de la aplicación llegó a su límite por ahora (no es por algo que hayas hecho). Probá de nuevo en una hora.";
  if (/not authorized|not allowed/i.test(message)) return "Todavía no se pueden enviar correos a esta dirección: falta configurar el servicio de correo de la aplicación.";
  if (/invalid/i.test(message) && /email/i.test(message)) return "Revisá que el email esté bien escrito.";
  return `No se pudo enviar el correo: ${message}`;
}

// Ingreso con código: solo para emails aprobados (compra online, transferencia, MercadoLibre…) o cuentas existentes.
export async function requestLoginCode(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Revisá que el email esté bien escrito." };
  if (formData.get("terms_accepted") !== "on") return { error: "Tenés que aceptar los términos para continuar." };
  if (!(await allowAttempt("login-code", 5, 600, email)) || !(await allowAttempt("login-code-ip", 30, 600))) return { error: TOO_MANY };

  const admin = createAdminClient();
  if (admin) {

    const { data: allowed } = await admin.rpc("login_allowed", { p_email: email });
    if (!allowed) return { error: "Ese email todavía no tiene la Edición Personal. Podés comprarla o, si ya pagaste por transferencia o MercadoLibre, escribinos para que la aprobemos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: `${await authOrigin()}/auth/callback`, data: { terms_accepted: "true" } },
  });
  if (error) return { error: friendlyEmailError(error.message) };
  return { success: true, email };
}

export async function verifyLoginCode(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const token = String(formData.get("code") || "").replace(/\D/g, "");
  if (token.length < 6) return { error: "Escribí el código que te llegó por correo.", email };
  if (!(await allowAttempt("login-verify", 10, 600, email)) || !(await allowAttempt("login-verify-ip", 40, 600))) return { error: TOO_MANY, email };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { error: "El código no es correcto o venció. Pedí uno nuevo.", email };
  if (!(await registerCurrentDevice())) return { error: DEVICE_LIMIT_MESSAGE, email };
  redirect("/");
}

// Ingreso con clave de acceso (Edición Personal): la persona solo escribe la clave que le llegó por correo.
// El servidor busca el email de esa clave, crea la cuenta si hace falta y abre la sesión en este aparato.
export async function redeemAccessKey(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const raw = String(formData.get("key") || "");
  if (normalizeKey(raw).length !== 12) return { error: "La clave tiene 12 letras y números (por ejemplo, K7MP-Q2XD-9HTR). Revisala." };
  if (formData.get("terms_accepted") !== "on") return { error: "Tenés que aceptar los términos para continuar." };
  if (!(await allowAttempt("access-key", 10, 600))) return { error: TOO_MANY };

  const admin = createAdminClient();
  if (!admin) return { error: "El ingreso no está disponible en este momento. Escribinos." };
  const { data: rows } = await admin.rpc("key_lookup", { p_hash: hashKey(raw) });
  const row = (rows as { id: string; email: string; status: string }[] | null)?.[0];
  if (!row || row.status !== "approved") {
    await new Promise((resolve) => setTimeout(resolve, 800)); // freno para quien prueba claves al azar
    return { error: "Esa clave no es válida. Revisala o escribinos si no la encontrás." };
  }

  // Crea la cuenta la primera vez (si ya existe, sigue). Al crearse recibe la Edición Personal.
  const created = await admin.auth.admin.createUser({ email: row.email, email_confirm: true, user_metadata: { terms_accepted: "true" } });
  if (created.error && !/already|registered|exists/i.test(created.error.message)) return { error: `No se pudo crear la cuenta: ${created.error.message}` };

  // Abre la sesión sin mandar correos: enlace generado en el servidor y verificado en el momento.
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email: row.email });
  const tokenHash = link.data?.properties?.hashed_token;
  if (link.error || !tokenHash) return { error: "No se pudo abrir la sesión. Probá de nuevo." };
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  if (error) return { error: "No se pudo abrir la sesión. Probá de nuevo." };

  if (!(await registerCurrentDevice())) return { error: DEVICE_LIMIT_MESSAGE };
  redirect("/");
}

// «¿Olvidaste tu contraseña?»: manda un enlace que lleva a crear una contraseña nueva.
// Por seguridad responde lo mismo exista o no la cuenta.
export async function requestPasswordReset(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") || "").trim();
  if (!email) return { error: "Ingresá tu email." };
  if (!(await allowAttempt("password-reset", 5, 600, email)) || !(await allowAttempt("password-reset-ip", 30, 600))) return { error: TOO_MANY };

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
  if (!(await allowAttempt("password-login", 10, 600, email)) || !(await allowAttempt("password-login-ip", 40, 600))) return { error: TOO_MANY };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Email o contraseña incorrectos." };
  if (!(await registerCurrentDevice())) return { error: DEVICE_LIMIT_MESSAGE };
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

  const weak = weakPasswordReason(password, user.email);
  if (weak) return { error: weak };
  if (await isLeakedPassword(password)) {
    return { error: "Esa contraseña apareció en filtraciones de otros sitios, así que no es segura. Elegí otra que no uses en ningún otro lado." };
  }

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
  await closeStaffSession();
  redirect("/login");
}
