import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendMail } from "@/lib/mail";
import { CONTACT_EMAIL } from "@/lib/legal";

// Clave de acceso de la Edición Personal: 12 caracteres sin los que se confunden (0/O, 1/I/L), en 3 grupos.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateKey() {
  const chars = Array.from({ length: 12 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8)}`;
}

// Acepta la clave con o sin guiones, en minúsculas o con espacios.
export function normalizeKey(input: string) {
  return input.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

export function hashKey(input: string) {
  return createHash("sha256").update(`calculadora-key:${normalizeKey(input)}`).digest("hex");
}

// La clave se guarda cifrada (AES-256-GCM) con un secreto del servidor, para que la administración pueda reenviarla.
function cipherKey() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Falta el secreto del servidor");
  return createHash("sha256").update(`calculadora-key-cipher:${secret}`).digest();
}

export function encryptKey(key: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", cipherKey(), iv);
  const data = Buffer.concat([cipher.update(key, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function decryptKey(value: string | null | undefined) {
  if (!value) return null;
  try {
    const [iv, tag, data] = value.split(".").map((part) => Buffer.from(part, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", cipherKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

// Crea una clave nueva para un email aprobado (reemplaza la anterior) y la devuelve.
export async function issueKey(client: SupabaseClient, approvedEmailId: string) {
  const key = generateKey();
  const { error } = await client.rpc("set_email_key", { p_id: approvedEmailId, p_hash: hashKey(key), p_hint: key.slice(-4), p_cipher: encryptKey(key) });
  if (error) throw new Error(error.message);
  return key;
}

// Manda la clave por correo. Devuelve false si el correo no está configurado o falló.
// «extra»: un párrafo más al final (por ejemplo, el aviso para clientas de revendedoras).
export async function sendKeyEmail(to: string, key: string, origin: string, extra?: string) {
  const extraText = extra ? `\n\n${extra}` : "";
  const extraHtml = extra ? `<p style="color:#555">${extra.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!)}</p>` : "";
  return sendMail({
    to,
    subject: "Tu clave de acceso · Calculadora Emprender",
    text: `¡Hola! Esta es tu clave para entrar a la Edición Personal de Calculadora Emprender:\n\n${key}\n\nEntrá a ${origin}/login y escribila. La primera vez en cada aparato te la pide; después la app queda abierta.\nGuardá este correo. Si necesitás ayuda: ${CONTACT_EMAIL}${extraText}`,
    html: `<p>¡Hola!</p><p>Esta es tu clave para entrar a la <strong>Edición Personal</strong> de Calculadora Emprender:</p><p style="font-size:24px;font-weight:bold;letter-spacing:3px;font-family:monospace">${key}</p><p><a href="${origin}/login">Entrá a la app</a> y escribila. La primera vez en cada aparato te la pide; después la app queda abierta.</p><p>Guardá este correo. Si necesitás ayuda: ${CONTACT_EMAIL}</p>${extraHtml}`,
  });
}
