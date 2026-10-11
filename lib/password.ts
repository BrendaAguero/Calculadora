import "server-only";
import { createHash } from "node:crypto";

// Revisa si una contraseña apareció en filtraciones conocidas (servicio «Pwned Passwords» de Have I Been Pwned).
// Nunca se envía la contraseña: solo los primeros 5 caracteres de su huella SHA-1 (k-anonimato), y la
// comparación del resto se hace acá. Si el servicio no responde, no se bloquea a la persona.
export async function isLeakedPassword(password: string) {
  const hash = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  try {
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true", "User-Agent": "calculadora-emprender" },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return false;
    const body = await response.text();
    return body.split("\n").some((line) => {
      const [candidate, count] = line.trim().split(":");
      return candidate === suffix && Number(count) > 0;
    });
  } catch (error) {
    console.warn("No se pudo consultar Pwned Passwords", error instanceof Error ? error.message : error);
    return false;
  }
}

// Reglas básicas además de la longitud: que no sea el email ni una repetición obvia.
export function weakPasswordReason(password: string, email?: string | null) {
  const lower = password.toLowerCase();
  if (email && (lower === email.toLowerCase() || lower === email.split("@")[0].toLowerCase())) return "La contraseña no puede ser tu email.";
  if (/^(.)\1+$/.test(password)) return "La contraseña no puede ser un mismo carácter repetido.";
  if (/^(0123456789|1234567890|12345678|123456789|abcdefgh|qwertyui)/i.test(password)) return "Esa contraseña es muy fácil de adivinar. Elegí otra.";
  return null;
}
