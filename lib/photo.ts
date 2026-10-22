// Foto que llega de un formulario: solo imágenes en data URL, y livianas (la app ya las achica).
export function readPhoto(value: FormDataEntryValue | null): string | null {
  const photo = String(value ?? '');
  return /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo) && photo.length <= 300_000 ? photo : null;
}

// Dirección para mostrar una foto pública (Comunidad, avisos). Sirve en el servidor y en el navegador.
// Las referencias «sb:publicas/…» apuntan al almacenamiento; las data: y https:// se usan tal cual.
export function publicPhotoUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^sb:publicas\/([A-Za-z0-9/_.-]{1,200})$/.exec(value);
  if (match) return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/publicas/${match[1]}`;
  return value.startsWith('data:image/') || value.startsWith('https://') ? value : null;
}
