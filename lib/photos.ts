import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { readPhoto } from "@/lib/photo";

// Fotos en el almacenamiento de archivos (Supabase Storage). En la base queda solo «sb:<depósito>/<ruta>».
// - «publicas»: Comunidad y avisos (las ve cualquiera con la dirección).
// - «privadas»: Colores y Cuaderno (solo su dueña, con un enlace firmado que vence).
// Solo el servidor sube, borra y firma (clave de servicio). Las fotos viejas en formato data: se siguen mostrando.

export type PhotoBucket = "publicas" | "privadas";
const REF = /^sb:(publicas|privadas)\/([A-Za-z0-9/_.-]{1,200})$/;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const SIGNED_SECONDS = 60 * 60;

export function isPhotoRef(value: string | null | undefined): value is string {
  return Boolean(value && REF.test(value));
}

// Sube una foto nueva (data URL ya achicada en el aparato) y devuelve su referencia.
// Si el almacenamiento falla, se guarda como antes (dentro de la base) para no perder la foto.
async function upload(dataUrl: string, bucket: PhotoBucket, folder: string): Promise<string> {
  const admin = createAdminClient();
  const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl);
  if (!admin || !match) return dataUrl;
  const path = `${folder.replace(/[^A-Za-z0-9_-]/g, "") || "x"}/${randomUUID()}.${EXT[match[1]]}`;
  const { error } = await admin.storage.from(bucket).upload(path, Buffer.from(match[2], "base64"), { contentType: match[1], upsert: false });
  if (error) {
    console.error("[fotos] no se pudo subir", error.message);
    return dataUrl;
  }
  return `sb:${bucket}/${path}`;
}

// Borra del almacenamiento una foto que ya no se usa (si es una referencia; las data: no ocupan archivo).
export async function removePhoto(value: string | null | undefined) {
  const match = value ? REF.exec(value) : null;
  const admin = createAdminClient();
  if (!match || !admin) return;
  const { error } = await admin.storage.from(match[1]).remove([match[2]]);
  if (error) console.error("[fotos] no se pudo borrar", error.message);
}

// Decide qué guardar a partir de lo que llegó del formulario:
// - la misma referencia que ya tenía el registro → la conserva;
// - una foto nueva → la sube (y borra la anterior);
// - vacío o cualquier otra cosa → sin foto (y borra la anterior).
// «current» siempre viene de la base, nunca del formulario: así nadie puede apuntar a una foto ajena.
export async function savePhoto(input: FormDataEntryValue | null, options: { bucket: PhotoBucket; folder: string; current?: string | null }) {
  const raw = String(input ?? "");
  const current = options.current ?? null;
  if (current && raw === current) return current;
  const fresh = readPhoto(raw);
  const next = fresh ? await upload(fresh, options.bucket, options.folder) : null;
  if (current && current !== next) await removePhoto(current);
  return next;
}

// Sube una foto nueva sin mirar la anterior (para funciones de la base que ya manejan «conservar»).
export async function uploadPhoto(input: FormDataEntryValue | null, bucket: PhotoBucket, folder: string) {
  const fresh = readPhoto(input);
  return fresh ? upload(fresh, bucket, folder) : null;
}

// Direcciones para mostrar las fotos. Las públicas se arman directo; las privadas se firman (vencen en 1 hora).
// Solo se pasan referencias de registros que la persona ya puede leer (las reglas de la base lo controlan).
export async function photoUrls(values: (string | null | undefined)[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const privatePaths: string[] = [];
  for (const value of values) {
    if (!value || result.has(value)) continue;
    const match = REF.exec(value);
    if (!match) {
      if (value.startsWith("data:image/") || value.startsWith("https://")) result.set(value, value);
      continue;
    }
    if (match[1] === "publicas" && base) result.set(value, `${base}/storage/v1/object/public/publicas/${match[2]}`);
    if (match[1] === "privadas") privatePaths.push(match[2]);
  }
  const admin = createAdminClient();
  if (privatePaths.length && admin) {
    const { data, error } = await admin.storage.from("privadas").createSignedUrls(privatePaths, SIGNED_SECONDS);
    if (error) console.error("[fotos] no se pudieron firmar", error.message);
    for (const item of data ?? []) if (item.path && item.signedUrl) result.set(`sb:privadas/${item.path}`, item.signedUrl);
  }
  return result;
}

export async function photoUrl(value: string | null | undefined) {
  return value ? (await photoUrls([value])).get(value) ?? null : null;
}
