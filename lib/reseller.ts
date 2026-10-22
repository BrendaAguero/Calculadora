import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type ResellerResources = { whatsapp: string; groupLink: string | null; waitTime: string; clientMessage: string; tips: string; materials: string };

// Valores por defecto hasta que la administración cargue los suyos.
export const DEFAULT_RESOURCES: ResellerResources = {
  whatsapp: "",
  groupLink: null,
  waitTime: "Hasta 24 horas hábiles",
  clientMessage: "¡Gracias por tu compra! En las próximas 24 horas hábiles te llega un correo de calculadoraemprender.app@gmail.com con tu clave de acceso a Calculadora Emprender. Revisá también spam y promociones. Con esa clave entrás desde el celular o la computadora (2 aparatos).",
  tips: "Mostrá la calculadora en acción: un video corto calculando el costo de una pieza vende más que mil palabras.\nContá que es un pago único: sin cuotas ni mensualidades obligatorias.\nOfrecé ayudar a cargar los primeros materiales: tu clienta va a usarla y recomendarla.\nAvisá enseguida cada venta para que la aprobación sea rápida.",
  materials: "",
};

export async function getResellerResources(supabase: Supabase): Promise<ResellerResources> {
  const { data } = await supabase.from("content_entries").select("content").eq("content_type", "affiliate_material").eq("slug", "revendedoras").maybeSingle();
  if (!data?.content) return DEFAULT_RESOURCES;
  let c: Record<string, string | null> = {};
  try { c = JSON.parse(data.content); } catch { c = {}; }
  return {
    whatsapp: c.whatsapp ?? "",
    groupLink: c.group_link ?? null,
    waitTime: c.wait_time || DEFAULT_RESOURCES.waitTime,
    clientMessage: c.client_message || DEFAULT_RESOURCES.clientMessage,
    tips: c.tips || DEFAULT_RESOURCES.tips,
    materials: c.materials ?? "",
  };
}

// Materiales: una línea por recurso, «Título | https://…».
export function parseMaterials(text: string) {
  return text.split("\n").map((line) => {
    const [title, url] = line.split("|").map((part) => part.trim());
    return url && /^https:\/\//.test(url) ? { title: title || url, url } : null;
  }).filter((m): m is { title: string; url: string } => m !== null);
}

export const whatsappLink = (number: string, text: string) => `https://wa.me/${number.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(text)}`;

export { resellerSaleRange } from './reseller-range';
