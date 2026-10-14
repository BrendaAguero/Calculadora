import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { CONTACT_EMAIL } from "@/lib/legal";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

// Claves de los avisos (VAPID). Se crean solas la primera vez y quedan en la base, fuera del alcance de las personas.
export async function vapidKeys(admin: Admin) {
  const read = async () => {
    const { data } = await admin.from("app_secrets").select("key,value").in("key", ["vapid_public", "vapid_private"]);
    const pub = data?.find((r) => r.key === "vapid_public")?.value;
    const priv = data?.find((r) => r.key === "vapid_private")?.value;
    return pub && priv ? { publicKey: pub, privateKey: priv } : null;
  };
  const existing = await read();
  if (existing) return existing;
  const fresh = webpush.generateVAPIDKeys();
  // Si dos pedidos llegan a la vez, gana el primero (ignoreDuplicates) y los dos leen lo mismo.
  await admin.from("app_secrets").upsert([{ key: "vapid_public", value: fresh.publicKey }, { key: "vapid_private", value: fresh.privateKey }], { onConflict: "key", ignoreDuplicates: true });
  return read();
}

// Aviso de prueba a un aparato puntual (botón «Probar aviso»). Devuelve el código del servicio de avisos si falla.
export async function sendTestPush(admin: Admin, sub: { endpoint: string; p256dh: string; auth: string }) {
  const keys = await vapidKeys(admin);
  if (!keys) return { ok: false, status: 0 };
  webpush.setVapidDetails(`mailto:${CONTACT_EMAIL}`, keys.publicKey, keys.privateKey);
  try {
    const res = await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify({ title: "Aviso de prueba", body: "¡Los avisos funcionan en este aparato!", tag: "prueba", url: "/temporizadores" }),
      { TTL: 600, urgency: "high" },
    );
    return { ok: true, status: res.statusCode };
  } catch (error) {
    return { ok: false, status: (error as { statusCode?: number }).statusCode ?? 0 };
  }
}

// Manda los avisos de los temporizadores vencidos. Si nadie toca «Listo», se repite cada minuto (hasta 5 veces).
// Cada uno se «reserva» en la base antes de enviarlo, para no mandarlo dos veces en el mismo minuto.
export async function sendDueTimerPushes(admin: Admin) {
  const keys = await vapidKeys(admin);
  if (!keys) return { sent: 0 };
  webpush.setVapidDetails(`mailto:${CONTACT_EMAIL}`, keys.publicKey, keys.privateKey);

  const { data: due, error: claimError } = await admin.rpc("claim_due_timer_pushes");
  if (claimError) console.error("[avisos] no se pudieron reservar los temporizadores", claimError.message);
  if (!due?.length) return { sent: 0 };

  const timers = due as { id: string; user_id: string; label: string; notify_count: number }[];
  const userIds = [...new Set(timers.map((t) => t.user_id))];
  const { data: subs } = await admin.from("push_subscriptions").select("id,user_id,endpoint,p256dh,auth").in("user_id", userIds);
  let sent = 0;
  const gone: string[] = [];
  await Promise.all(timers.flatMap((timer) => (subs ?? []).filter((s) => s.user_id === timer.user_id).map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({
          title: timer.notify_count > 1 ? `¡Tiempo cumplido! (aviso ${timer.notify_count} de 5)` : "¡Tiempo cumplido!",
          body: timer.label, tag: timer.id, timerId: timer.id, url: "/temporizadores",
        }),
        { TTL: 3600, urgency: "high" },
      );
      sent += 1;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) gone.push(s.id); // el aparato ya no acepta avisos
      else console.error("[avisos] no se pudo enviar", status ?? (error instanceof Error ? error.message : error));
    }
  })));
  if (gone.length) await admin.from("push_subscriptions").delete().in("id", gone);
  return { sent };
}
