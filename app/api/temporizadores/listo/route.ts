import { createClient } from "@/lib/supabase/server";

// «Listo, apagar» desde la notificación (o «Apagar alarma» en la app): marca los temporizadores como hechos
// y así dejan de repetirse los avisos. Solo los de la persona con sesión.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Iniciá sesión." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { ids?: unknown };
  const ids = (Array.isArray(body.ids) ? body.ids : []).map(String).filter((id) => /^[0-9a-f-]{36}$/.test(id)).slice(0, 20);
  if (!ids.length) return Response.json({ ok: true, done: 0 });
  const { data, error } = await supabase.from("cure_timers").update({ done_at: new Date().toISOString() }).in("id", ids).eq("user_id", user.id).is("done_at", null).select("id");
  if (error) return Response.json({ error: "No se pudo marcar." }, { status: 500 });
  return Response.json({ ok: true, done: data?.length ?? 0 });
}

// Los temporizadores en marcha de la persona: el aviso de la app se pone al día al abrirla
// (por ejemplo, si se apagó uno desde la notificación o se creó en otro aparato).
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ timers: null }, { status: 401 });
  const { data } = await supabase.from("cure_timers").select("id,label,ends_at").eq("user_id", user.id).is("done_at", null).order("ends_at").limit(100);
  return Response.json({ timers: data ?? [] });
}
