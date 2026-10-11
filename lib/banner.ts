import { createClient } from "@/lib/supabase/server";

export type Banner = { title: string; text: string; link: string | null; button: string; image: string | null; active: boolean };

// Banner por defecto (si la administración todavía no cargó uno): promociona los planes pagos.
export const DEFAULT_BANNER: Banner = {
  title: "Sin publicidad, sin límites y sin conexión",
  text: "Con Mensualidad Plus también tenés todas las actividades y módulos.",
  link: "/access#emprendedor",
  button: "Ver Plus",
  image: null,
  active: true,
};

export async function getBanner(): Promise<Banner> {
  const supabase = await createClient();
  const { data } = await supabase.from("content_entries").select("title,content,status").eq("content_type", "banner").eq("slug", "free").maybeSingle();
  if (!data) return DEFAULT_BANNER;
  let content: Partial<Banner> = {};
  try { content = JSON.parse(data.content ?? "{}"); } catch { content = {}; }
  return { title: data.title ?? "", text: content.text ?? "", link: content.link ?? null, button: content.button ?? "", image: content.image ?? null, active: data.status === "published" };
}
