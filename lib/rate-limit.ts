import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

// Límite de intentos por IP para formularios públicos. La IP no se guarda: solo una huella (hash) con sal.
async function ipFingerprint(extra = "") {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "sin-ip";
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "calculadora";
  return createHash("sha256").update(`rl:${salt}:${ip}:${extra.trim().toLowerCase()}`).digest("hex").slice(0, 32);
}

// true = se puede seguir. Si el control falla (sin conexión a la base), deja pasar para no bloquear a nadie.
// «extra» (por ejemplo, el email) separa el conteo: así varias personas detrás de la misma conexión
// (datos móviles, el wifi del taller) no se bloquean entre sí.
export async function allowAttempt(action: string, max: number, windowSeconds: number, extra?: string) {
  const admin = createAdminClient();
  if (!admin) return true;
  const { data, error } = await admin.rpc("hit_rate_limit", { p_key: `${action}:${await ipFingerprint(extra)}`, p_max: max, p_window_seconds: windowSeconds });
  if (error) {
    console.error("[limite] no se pudo controlar", error.message);
    return true;
  }
  return data !== false;
}

export const TOO_MANY = "Hiciste muchos intentos seguidos. Esperá unos minutos y probá de nuevo.";
