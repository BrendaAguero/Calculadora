import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdmin } from "@/lib/notify";

type Request = { path: string; method: string };
type Context = { routePath: string; routeType: string };

export async function reportServerError(err: unknown, request: Request, context: Context) {
  const admin = createAdminClient();
  if (!admin) return;
  const message = (err instanceof Error ? err.message : String(err)).slice(0, 500);
  const digest = typeof err === "object" && err !== null && "digest" in err ? String(err.digest) : null;
  const path = request.path.split("?")[0].slice(0, 200); // sin la consulta: puede traer códigos de ingreso

  // Freno ante una lluvia de errores: como mucho 300 registros por hora.
  const { data: canLog } = await admin.rpc("hit_rate_limit", { p_key: "server-error:log", p_max: 300, p_window_seconds: 3600 });
  if (canLog === false) return;
  await admin.from("error_logs").insert({
    error_code: digest ?? "server",
    category: context.routeType,
    severity: "error",
    message,
    path,
    technical_details: JSON.stringify({ method: request.method, route: context.routePath, digest }),
  });

  const { data: canMail } = await admin.rpc("hit_rate_limit", { p_key: "server-error:mail", p_max: 1, p_window_seconds: 3600 });
  if (canMail === false) return;
  await notifyAdmin("Hubo un error en la app", [
    "La app registró un error en el servidor. Este aviso llega como mucho una vez por hora; si hubo más, están guardados en la base (tabla error_logs).",
    `Dónde: ${request.method} ${path} (${context.routeType})`,
    `Mensaje: ${message}`,
    digest ? `Código: ${digest}` : "",
  ].filter(Boolean));
}
