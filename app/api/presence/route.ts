import { headers } from "next/headers";
import { currentDeviceId, registerCurrentDevice } from "@/lib/devices";
import { getAccessSnapshot } from "@/lib/access/permissions";
import { sendMail } from "@/lib/mail";
import { CONTACT_EMAIL } from "@/lib/legal";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// «Estoy en uso»: la app lo manda cada pocos minutos. La ubicación aproximada (ciudad) la da Vercel según la
// conexión; el aparato no la puede elegir. Devuelve si hay un aviso de uso en paralelo sin responder.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ state: "signed_out" }, { status: 401 });
  const admin = createAdminClient();
  const deviceId = await currentDeviceId();

  // Aparato sin registrar (por ejemplo, una sesión abierta antes del control): se registra ahora.
  // Si la persona ya usa todos sus aparatos, se cierra la sesión solo en este.
  if (admin && !deviceId && !(await registerCurrentDevice())) return Response.json({ state: "device_limit" });

  if (admin && deviceId) {
    const h = await headers();
    const decode = (value: string | null) => { try { return value ? decodeURIComponent(value) : null; } catch { return null; } };
    const number = (value: string | null) => (value && Number.isFinite(Number(value)) ? Number(value) : null);
    const { data, error } = await admin.rpc("record_presence", {
      p_user_id: user.id,
      p_device_id: deviceId,
      p_city: decode(h.get("x-vercel-ip-city")),
      p_country: h.get("x-vercel-ip-country"),
      p_lat: number(h.get("x-vercel-ip-latitude")),
      p_lon: number(h.get("x-vercel-ip-longitude")),
    });
    if (error) console.error("No se pudo registrar el uso", error.message);
    const result = data as { state?: string; alert?: string } | null;

    // Este aparato fue liberado (por la persona o la administración): se cierra la sesión acá.
    if (result?.state === "released") {
      await supabase.auth.signOut({ scope: "local" });
      return Response.json({ state: "released" });
    }
    if (result?.state === "unknown" && !(await registerCurrentDevice())) return Response.json({ state: "device_limit" });
    // Aviso nuevo: también por correo, por si la persona no está mirando la app.
    if (result?.alert && user.email) {
      const { data: alert } = await admin.from("session_alerts").select("place_a,place_b").eq("id", result.alert).maybeSingle();
      const places = [alert?.place_a, alert?.place_b].filter(Boolean).join(" y ") || "dos lugares distintos";
      await sendMail({
        to: user.email,
        subject: "Aviso: tu cuenta se está usando en dos lugares a la vez",
        text: `Hola. Tu cuenta de Calculadora Emprender se está usando al mismo tiempo en ${places}.\n\nSi fuiste vos (por ejemplo, con datos del celular la ubicación puede variar), no tenés que hacer nada.\nSi no fuiste vos, abrí la app y tocá «No fui yo»: cerramos todos los aparatos y te mandamos una clave nueva.\n\nAyuda: ${CONTACT_EMAIL}`,
        html: `<p>Hola. Tu cuenta de Calculadora Emprender se está usando al mismo tiempo en <strong>${places}</strong>.</p><p>Si fuiste vos (por ejemplo, con datos del celular la ubicación puede variar), no tenés que hacer nada.</p><p>Si no fuiste vos, abrí la app y tocá <strong>«No fui yo»</strong>: cerramos todos los aparatos y te mandamos una clave nueva.</p><p>Ayuda: ${CONTACT_EMAIL}</p>`,
      });
    }
  }

  // El modo sin conexión es de Mensualidad Plus (también la administración y la cuenta de prueba).
  const snapshot = await getAccessSnapshot();
  const plus = Boolean(snapshot && (snapshot.entrepreneurActive || snapshot.isAdmin || snapshot.isTester));
  const { data: open } = await supabase.from("session_alerts").select("id,place_a,place_b,created_at").eq("user_id", user.id).eq("status", "open").order("created_at", { ascending: false }).limit(1).maybeSingle();
  return Response.json({ state: "ok", alert: open ?? null, plus, userId: user.id });
}
