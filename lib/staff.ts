import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// Ingreso del equipo (administración y moderación): una dirección que no figura en ningún menú ni enlace.
// Entrar por ahí deja un sello firmado en este navegador por 12 horas; sin ese sello, el panel y las
// herramientas de moderación no se abren aunque la cuenta sea del equipo (por ejemplo, si alguien
// toma un celular con la sesión normal abierta). La base vuelve a comprobar el rol en cada acción.
export const STAFF_LOGIN_PATH = "/equipo-ingreso";
const COOKIE = "ce_equipo";
const HOURS = 12;

function sign(value: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return null;
  return createHmac("sha256", `equipo:${secret}`).update(value).digest("base64url");
}

export async function openStaffSession(userId: string) {
  const expires = Date.now() + HOURS * 3600_000;
  const signature = sign(`${userId}.${expires}`);
  if (!signature) return;
  (await cookies()).set(COOKIE, `${expires}.${signature}`, {
    httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: HOURS * 3600,
  });
}

export async function hasStaffSession(userId: string) {
  const value = (await cookies()).get(COOKIE)?.value ?? "";
  const [expires, signature] = value.split(".");
  if (!expires || !signature || !(Number(expires) > Date.now())) return false;
  const expected = sign(`${userId}.${expires}`);
  if (!expected || expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function closeStaffSession() {
  (await cookies()).delete(COOKIE);
}
