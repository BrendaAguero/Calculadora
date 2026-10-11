import { createHmac, timingSafeEqual } from "node:crypto";
import { processPayment } from "@/lib/mercadopago";

// Aviso de Mercado Pago. Si está configurada la clave secreta del webhook, se verifica la firma.
// Igual se consulta el pago a Mercado Pago antes de activar nada, así que un aviso falso no logra nada.
function validSignature(request: Request, dataId: string) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true;
  const header = request.headers.get("x-signature") ?? "";
  const requestId = request.headers.get("x-request-id") ?? "";
  const parts = Object.fromEntries(header.split(",").map((part) => part.trim().split("=") as [string, string]));
  if (!parts.ts || !parts.v1) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  return expected.length === parts.v1.length && timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const body = (await request.json().catch(() => ({}))) as { type?: string; topic?: string; data?: { id?: string | number } };
  const type = body.type ?? body.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
  const dataId = String(body.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");

  if (type !== "payment" || !dataId) return Response.json({ ignored: true });
  if (!validSignature(request, dataId)) return Response.json({ error: "firma inválida" }, { status: 401 });

  try {
    const result = await processPayment(dataId);
    return Response.json({ result });
  } catch (error) {
    // 500 hace que Mercado Pago reintente más tarde.
    console.error("Webhook de Mercado Pago", error instanceof Error ? error.message : error);
    return Response.json({ error: "no se pudo procesar" }, { status: 500 });
  }
}
