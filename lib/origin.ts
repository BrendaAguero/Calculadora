import { headers } from "next/headers";

export const PRODUCTION_ORIGIN = "https://calculadora-emprender.vercel.app";

// Dirección pública del sitio donde se hizo el pedido (producción o una vista previa de este proyecto).
// Solo se aceptan sitios de este proyecto, para que nadie pueda desviar enlaces con un encabezado falso.
export async function siteOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "";
  if (/^calculadora-emprender(-[a-z0-9-]+)?\.vercel\.app$/.test(host)) return `https://${host}`;
  if (/^localhost(:\d+)?$/.test(host)) return `http://${host}`;
  return PRODUCTION_ORIGIN;
}
