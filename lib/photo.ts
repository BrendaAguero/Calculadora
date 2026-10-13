// Foto que llega de un formulario: solo imágenes en data URL, y livianas (la app ya las achica).
export function readPhoto(value: FormDataEntryValue | null): string | null {
  const photo = String(value ?? '');
  return /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo) && photo.length <= 300_000 ? photo : null;
}
