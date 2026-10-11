import "server-only";
import { createClient } from "@supabase/supabase-js";

// Cliente con la clave de servicio: SOLO en el servidor (el import "server-only" impide usarlo en el navegador).
// Se usa únicamente para registrar pagos confirmados por Mercado Pago, que llegan sin sesión de usuario.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
