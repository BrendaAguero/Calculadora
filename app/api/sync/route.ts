import { createClient } from "@/lib/supabase/server";
import { getAccessSnapshot } from "@/lib/access/permissions";
import { recordSale, type SaleInput } from "@/app/ventas/record";
import { saveCalculation, type SaveInput } from "@/app/calcular/actions";
import { saveMixCalculation } from "@/app/calcular/mix-actions";
import type { MixInput, MixSettings } from "@/lib/mixes";
import { FORM_TYPES, type OutboxType } from "@/lib/outbox";
import { createMaterial } from "@/app/materials/actions";
import { addStockItem, registerMovement } from "@/app/stock/actions";
import { registerProduction } from "@/app/produccion/actions";
import { registerPurchase } from "@/app/compras/actions";

// Formularios guardados sin conexión: se manda lo mismo que habría mandado el formulario.
// Esas acciones terminan llevando a otra pantalla; por la dirección se sabe si salió bien.
const FORM_ACTIONS: Record<(typeof FORM_TYPES)[number], { run: (data: FormData) => Promise<unknown>; ok: (url: URL) => boolean }> = {
  material: { run: createMaterial, ok: (url) => url.pathname === "/materials" },
  stock_item: { run: addStockItem, ok: (url) => url.searchParams.has("ok") },
  stock_move: { run: registerMovement, ok: (url) => url.searchParams.has("ok") },
  production: { run: registerProduction, ok: (url) => url.searchParams.has("ok") },
  purchase: { run: registerPurchase, ok: (url) => url.searchParams.has("ok") },
};
const TYPES: OutboxType[] = ["sale", "yeso_calc", "mix_calc", ...FORM_TYPES];

async function runForm(type: (typeof FORM_TYPES)[number], payload: unknown): Promise<{ ok: boolean; error?: string }> {
  const fields = (payload as { fields?: unknown })?.fields;
  if (!Array.isArray(fields)) return { ok: false, error: "Carga incompleta." };
  const data = new FormData();
  for (const pair of fields.slice(0, 200)) if (Array.isArray(pair) && typeof pair[0] === "string" && typeof pair[1] === "string") data.append(pair[0], pair[1].slice(0, 2000));
  const action = FORM_ACTIONS[type];
  try {
    await action.run(data);
  } catch (error) {
    // redirect() avisa con un error cuyo «digest» es NEXT_REDIRECT;tipo;dirección;código;
    const digest = (error as { digest?: unknown })?.digest;
    if (typeof digest !== "string" || !digest.startsWith("NEXT_REDIRECT;")) throw error;
    const url = new URL(digest.split(";").slice(2, -2).join(";"), "http://local");
    const message = url.searchParams.get("error");
    if (message) return { ok: false, error: message };
    return action.ok(url) ? { ok: true } : { ok: false, error: "Tu plan no incluye esta función o la sesión se cerró." };
  }
  return { ok: true };
}

type Item = { id: string; userId?: string; type: OutboxType; payload: unknown };
type Result = { id: string; status: "done" | "duplicate" | "error" | "other_user"; message?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Sube lo que se cargó sin conexión (solo Mensualidad Plus). Cada carga tiene un id propio:
// si ya se había subido, no se repite.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Iniciá sesión." }, { status: 401 });
  const snapshot = await getAccessSnapshot();
  if (!snapshot || !(snapshot.entrepreneurActive || snapshot.isAdmin || snapshot.isTester)) return Response.json({ error: "El modo sin conexión es parte de la Mensualidad Plus." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { items?: Item[] } | null;
  const items = Array.isArray(body?.items) ? body!.items.slice(0, 50) : [];
  const results: Result[] = [];

  for (const item of items) {
    if (!item || typeof item.id !== "string" || !UUID.test(item.id) || !TYPES.includes(item.type)) continue;
    // Una carga hecha con otra cuenta en este aparato no se sube a esta.
    if (item.userId && item.userId !== user.id) { results.push({ id: item.id, status: "other_user" }); continue; }

    const { error: logError } = await supabase.from("offline_sync_log").insert({ user_id: user.id, client_id: item.id, kind: item.type });
    if (logError) {
      results.push(logError.code === "23505" ? { id: item.id, status: "duplicate" } : { id: item.id, status: "error", message: logError.message });
      continue;
    }

    let outcome: { ok: boolean; error?: string };
    try {
      if (item.type === "sale") outcome = await recordSale(supabase, user.id, item.payload as SaleInput);
      else if ((FORM_TYPES as readonly string[]).includes(item.type)) outcome = await runForm(item.type as (typeof FORM_TYPES)[number], item.payload);
      else if (item.type === "yeso_calc") outcome = await saveCalculation(item.payload as SaveInput);
      else {
        const p = item.payload as { code: string; settings: MixSettings; input: MixInput };
        outcome = await saveMixCalculation(p.code, p.settings, p.input);
      }
    } catch (error) {
      outcome = { ok: false, error: error instanceof Error ? error.message : "Error inesperado." };
    }

    if (outcome.ok) results.push({ id: item.id, status: "done" });
    else {
      // No se pudo: se borra la marca para poder reintentar después de corregir.
      await supabase.from("offline_sync_log").delete().eq("user_id", user.id).eq("client_id", item.id);
      results.push({ id: item.id, status: "error", message: outcome.error });
    }
  }
  return Response.json({ results });
}
