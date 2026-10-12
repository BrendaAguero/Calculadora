import { createClient } from "@/lib/supabase/server";
import { loadStock } from "@/app/stock/data";

const one = <T,>(value: T | T[] | null | undefined) => (Array.isArray(value) ? value[0] : value);
// Excel en español: separador «;», decimales con coma y fechas día/mes/año.
const num = (value: unknown) => (value === null || value === undefined || value === "" ? "" : String(Number(value)).replace(".", ","));
const day = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }) : "");
const cell = (value: unknown) => {
  let text = String(value ?? "");
  // Evita que Excel interprete un texto como fórmula.
  if (/^[=+\-@]/.test(text) && !/^-?\d/.test(text)) text = `'${text}`;
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const csv = (header: string[], rows: unknown[][]) => "﻿" + [header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");

const TYPES = ["ventas", "materiales", "productos", "stock", "compras", "produccion"] as const;
type Type = (typeof TYPES)[number];

// Descarga de los datos de la cuenta (solo los propios: la base filtra por la sesión).
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Iniciá sesión.", { status: 401 });
  const type = new URL(request.url).searchParams.get("tipo") as Type;
  if (!TYPES.includes(type)) return new Response("Tipo inválido.", { status: 400 });

  let body: string;
  if (type === "ventas") {
    const { data, error } = await supabase.from("sales").select("sale_date,quantity,unit_price,discount,commission,total,total_cost_snapshot,net_income,customer_name,payment_method,voided_at,products(name)").eq("user_id", user.id).order("sale_date", { ascending: false }).limit(20000);
    if (error) return new Response(error.message, { status: 500 });
    body = csv(["Fecha", "Producto", "Cantidad", "Precio unitario", "Descuento", "Comisión", "Cobrado", "Costo", "Ganancia", "Cliente", "Medio de pago", "Anulada"],
      (data ?? []).map((s) => [day(s.sale_date), one(s.products as { name: string }[] | { name: string } | null)?.name, num(s.quantity), num(s.unit_price), num(s.discount), num(s.commission), num(s.total), num(s.total_cost_snapshot), num(s.net_income), s.customer_name, s.payment_method, s.voided_at ? "sí" : ""]));
  } else if (type === "materiales") {
    const { data, error } = await supabase.from("materials").select("name,default_unit,status,current_price_id").eq("user_id", user.id).order("name");
    if (error) return new Response(error.message, { status: 500 });
    const ids = (data ?? []).map((m) => m.current_price_id).filter(Boolean) as string[];
    const { data: prices } = ids.length ? await supabase.from("material_prices").select("id,unit_cost,purchase_price,purchase_quantity,purchase_unit,valid_from").in("id", ids) : { data: [] };
    const byId = new Map((prices ?? []).map((p) => [p.id, p]));
    body = csv(["Material", "Unidad", "Costo por unidad", "Último precio pagado", "Cantidad comprada", "Unidad comprada", "Precio desde", "Estado"],
      (data ?? []).map((m) => { const p = m.current_price_id ? byId.get(m.current_price_id) : undefined; return [m.name, m.default_unit, num(p?.unit_cost), num(p?.purchase_price), num(p?.purchase_quantity), p?.purchase_unit, day(p?.valid_from), m.status === "active" ? "activo" : "archivado"]; }));
  } else if (type === "productos") {
    const { data, error } = await supabase.from("products").select("name,status,activities(name),product_prices(price_type,quantity_min,price,valid_from,valid_until)").eq("user_id", user.id).order("name");
    if (error) return new Response(error.message, { status: 500 });
    const now = Date.now();
    const current = (prices: { price_type: string; price: number; valid_from: string; valid_until: string | null }[] | null, type: string) =>
      (prices ?? []).find((p) => p.price_type === type && new Date(p.valid_from).getTime() <= now && (!p.valid_until || new Date(p.valid_until).getTime() > now))?.price;
    body = csv(["Producto", "Actividad", "Precio minorista", "Precio mayorista", "Estado"],
      (data ?? []).map((p) => [p.name, one(p.activities as { name: string }[] | { name: string } | null)?.name, num(current(p.product_prices, "retail")), num(current(p.product_prices, "wholesale")), p.status]));
  } else if (type === "stock") {
    const { rows, error } = await loadStock(supabase, user.id);
    if (error) return new Response(error, { status: 500 });
    body = csv(["Nombre", "Tipo", "Cantidad", "Unidad", "Mínimo", "Valor por unidad", "Valor total"],
      rows.map((r) => [r.name, r.type === "finished_product" ? "producto terminado" : "material", num(r.quantity), r.unit, num(r.minimum), num(r.unitValue), r.unitValue == null ? "" : num(Math.max(r.quantity, 0) * r.unitValue)]));
  } else if (type === "compras") {
    const { data, error } = await supabase.from("supplier_purchases").select("purchase_date,total,notes,suppliers(name),supplier_purchase_items(quantity,unit,total,materials(name))").eq("user_id", user.id).order("purchase_date", { ascending: false }).limit(20000);
    if (error) return new Response(error.message, { status: 500 });
    body = csv(["Fecha", "Proveedor", "Material", "Cantidad", "Unidad", "Pagado", "Total de la compra", "Nota"],
      (data ?? []).flatMap((c) => ((c.supplier_purchase_items ?? []) as { quantity: number; unit: string; total: number; materials: { name: string } | { name: string }[] | null }[]).map((i) =>
        [day(c.purchase_date), one(c.suppliers as { name: string }[] | { name: string } | null)?.name, one(i.materials)?.name, num(i.quantity), i.unit, num(i.total), num(c.total), c.notes])));
  } else {
    const { data, error } = await supabase.from("productions").select("produced_at,quantity,total_cost,notes,products(name)").eq("user_id", user.id).order("produced_at", { ascending: false }).limit(20000);
    if (error) return new Response(error.message, { status: 500 });
    body = csv(["Fecha", "Producto", "Piezas", "Costo de materiales", "Nota"],
      (data ?? []).map((p) => [day(p.produced_at), one(p.products as { name: string }[] | { name: string } | null)?.name, num(p.quantity), num(p.total_cost), p.notes]));
  }

  const date = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="calculadora-${type}-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
