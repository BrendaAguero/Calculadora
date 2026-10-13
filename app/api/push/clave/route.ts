import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { vapidKeys } from "@/lib/push";

// Clave pública para que el navegador se anote a los avisos (solo con sesión).
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Iniciá sesión." }, { status: 401 });
  const admin = createAdminClient();
  const keys = admin ? await vapidKeys(admin) : null;
  if (!keys) return Response.json({ error: "Los avisos no están disponibles por ahora." }, { status: 503 });
  return Response.json({ key: keys.publicKey });
}
