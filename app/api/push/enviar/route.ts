import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendDueTimerPushes } from "@/lib/push";

// Lo llama la base de datos cada minuto (pg_cron) con su clave. Manda los avisos de temporizadores vencidos.
export async function POST(request: Request) {
  const admin = createAdminClient();
  if (!admin) return Response.json({ error: "no disponible" }, { status: 503 });
  const given = request.headers.get("x-cron-secret") ?? "";
  const { data } = await admin.from("app_secrets").select("value").eq("key", "cron_push").maybeSingle();
  const expected = data?.value ?? "";
  const ok = expected.length > 0 && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return Response.json({ error: "no autorizado" }, { status: 401 });
  return Response.json(await sendDueTimerPushes(admin));
}
