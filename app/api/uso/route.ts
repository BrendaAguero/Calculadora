import { createClient } from "@/lib/supabase/server";

// Suma una vista a la pantalla del día (sin guardar quién). Solo con sesión iniciada.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(null, { status: 204 });
  const body = (await request.json().catch(() => null)) as { path?: unknown; simple?: unknown } | null;
  if (typeof body?.path !== "string") return new Response(null, { status: 204 });
  await supabase.rpc("track_view", { p_path: body.path, p_simple: body.simple !== false });
  return new Response(null, { status: 204 });
}
