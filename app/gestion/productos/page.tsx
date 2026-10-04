'use client';

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AppShell } from "@/components/app-shell";

type Formula = { id: string; name: string; status: string };
type Mold = { id: string; name: string; status: string };
type Product = { id: string; name: string; photo_url: string | null; status: string; notes: string | null; created_at: string };
type Price = { id: string; price_type: string; quantity_min: number; quantity_max: number | null; price: number; currency: string; valid_from: string; valid_until: string | null };

const money = (value: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(value || 0);

export default function ProductosPage() {
  const supabase = useMemo(() => createClient(), []);
  const [products, setProducts] = useState<Product[]>([]);
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [molds, setMolds] = useState<Mold[]>([]);
  const [prices, setPrices] = useState<Record<string, Price[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [formulaId, setFormulaId] = useState("");
  const [moldId, setMoldId] = useState("");
  const [priceType, setPriceType] = useState("retail");
  const [quantityMin, setQuantityMin] = useState("1");
  const [quantityMax, setQuantityMax] = useState("");
  const [price, setPrice] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("PROD-001: iniciá sesión para gestionar productos."); setLoading(false); return; }
    const { data: activity } = await supabase.from("activities").select("id").eq("code", "YESO").single();
    if (!activity) { setError("PROD-002: no se encontró la actividad Yeso."); setLoading(false); return; }

    const [productsRes, formulasRes, moldsRes] = await Promise.all([
      supabase.from("products").select("id,name,photo_url,status,notes,created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("formulas").select("id,name,status").eq("user_id", user.id).eq("activity_id", activity.id).eq("status", "active").order("name"),
      supabase.from("molds").select("id,name,status").eq("user_id", user.id).eq("activity_id", activity.id).eq("status", "active").order("name"),
    ]);
    if (productsRes.error) setError("PROD-003: no se pudieron cargar los productos.");
    setProducts(productsRes.data || []);
    setFormulas(formulasRes.data || []);
    setMolds(moldsRes.data || []);

    const ids = (productsRes.data || []).map(p => p.id);
    if (ids.length) {
      const { data: priceRows } = await supabase.from("product_prices").select("id,product_id,price_type,quantity_min,quantity_max,price,currency,valid_from,valid_until").in("product_id", ids).order("valid_from", { ascending: false });
      const grouped: Record<string, Price[]> = {};
      for (const row of (priceRows || []) as (Price & { product_id: string })[]) (grouped[row.product_id] ||= []).push(row);
      setPrices(grouped);
    } else setPrices({});
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function createProduct() {
    setSaving(true); setError(""); setMessage("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("PROD-001: iniciá sesión.");
      if (!name.trim()) throw new Error("PROD-004: escribí un nombre para el producto.");
      const { data: activity } = await supabase.from("activities").select("id").eq("code", "YESO").single();
      if (!activity) throw new Error("PROD-002: no se encontró la actividad Yeso.");
      const { data: product, error: productError } = await supabase.from("products").insert({ user_id: user.id, activity_id: activity.id, name: name.trim(), photo_url: photoUrl.trim() || null, status: "active", notes: notes.trim() || null }).select("id").single();
      if (productError || !product) throw new Error("PROD-005: no se pudo crear el producto.");

      if (formulaId) {
        const { error } = await supabase.from("product_formulas").insert({ product_id: product.id, formula_id: formulaId, is_default: true });
        if (error) throw new Error("PROD-006: no se pudo vincular la fórmula.");
      }
      if (moldId) {
        const { error } = await supabase.from("product_molds").insert({ product_id: product.id, mold_id: moldId, is_default: true });
        if (error) throw new Error("PROD-007: no se pudo vincular el molde.");
      }
      if (price && Number(price) > 0) {
        const { error } = await supabase.from("product_prices").insert({ product_id: product.id, price_type: priceType, quantity_min: Math.max(1, Number(quantityMin) || 1), quantity_max: quantityMax ? Math.max(1, Number(quantityMax)) : null, price: Number(price), currency: "ARS", valid_from: new Date().toISOString() });
        if (error) throw new Error("PROD-008: el producto se creó, pero no se pudo guardar el precio.");
      }
      setName(""); setPhotoUrl(""); setNotes(""); setFormulaId(""); setMoldId(""); setPrice(""); setQuantityMax("");
      setMessage("Producto creado correctamente.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "PROD-999: no se pudo crear."); }
    finally { setSaving(false); }
  }

  async function archiveProduct(id: string) {
    setError(""); setMessage("");
    const { error } = await supabase.from("products").update({ status: "archived" }).eq("id", id);
    if (error) setError("PROD-009: no se pudo archivar el producto.");
    else { setMessage("Producto archivado."); await load(); }
  }

  return <AppShell>
    <header>
      <p className="text-sm font-medium text-orange-700 dark:text-orange-300">Gestión</p>
      <h1 className="mt-1 text-3xl font-bold">Productos</h1>
      <p className="mt-2 text-sm text-neutral-500">Organizá tus productos, fórmulas, moldes y precios.</p>
    </header>

    <section className="mt-6 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="text-lg font-semibold">Nuevo producto</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">Nombre<input value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Vela Luna" className="mt-1 w-full rounded-xl border p-3 dark:border-neutral-700 dark:bg-neutral-950" /></label>
        <label className="text-sm font-medium">Foto (URL)<input value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} placeholder="https://..." className="mt-1 w-full rounded-xl border p-3 dark:border-neutral-700 dark:bg-neutral-950" /></label>
        <label className="text-sm font-medium">Fórmula predeterminada<select value={formulaId} onChange={e => setFormulaId(e.target.value)} className="mt-1 w-full rounded-xl border p-3 dark:border-neutral-700 dark:bg-neutral-950"><option value="">Sin fórmula</option>{formulas.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
        <label className="text-sm font-medium">Molde predeterminado<select value={moldId} onChange={e => setMoldId(e.target.value)} className="mt-1 w-full rounded-xl border p-3 dark:border-neutral-700 dark:bg-neutral-950"><option value="">Sin molde</option>{molds.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
        <label className="text-sm font-medium sm:col-span-2">Notas<textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="mt-1 w-full rounded-xl border p-3 dark:border-neutral-700 dark:bg-neutral-950" /></label>
      </div>

      <div className="mt-5 rounded-2xl bg-neutral-50 p-4 dark:bg-neutral-950">
        <h3 className="font-semibold">Precio inicial (opcional)</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <select value={priceType} onChange={e => setPriceType(e.target.value)} className="rounded-xl border p-3 dark:border-neutral-700 dark:bg-neutral-900"><option value="retail">Retail</option><option value="wholesale">Mayorista</option><option value="promotional">Promocional</option><option value="manual">Manual</option></select>
          <input value={quantityMin} onChange={e => setQuantityMin(e.target.value)} type="number" min="1" placeholder="Desde" className="rounded-xl border p-3 dark:border-neutral-700 dark:bg-neutral-900" />
          <input value={quantityMax} onChange={e => setQuantityMax(e.target.value)} type="number" min="1" placeholder="Hasta (opcional)" className="rounded-xl border p-3 dark:border-neutral-700 dark:bg-neutral-900" />
          <input value={price} onChange={e => setPrice(e.target.value)} type="number" min="0" step="0.01" placeholder="Precio ARS" className="rounded-xl border p-3 dark:border-neutral-700 dark:bg-neutral-900" />
        </div>
      </div>
      <button disabled={saving} onClick={() => void createProduct()} className="mt-5 w-full rounded-2xl bg-orange-700 px-5 py-4 font-semibold text-white disabled:opacity-50">{saving ? "Guardando..." : "Crear producto"}</button>
    </section>

    {message && <p className="mt-4 rounded-2xl bg-green-50 p-4 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-200">{message}</p>}
    {error && <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-200">{error}</p>}

    <section className="mt-6">
      <div className="flex items-end justify-between"><div><h2 className="text-xl font-semibold">Mis productos</h2><p className="text-sm text-neutral-500">Precios históricos quedan separados por vigencia.</p></div><span className="text-sm text-neutral-500">{products.filter(p => p.status === "active").length} activos</span></div>
      {loading ? <div className="mt-4 rounded-2xl border p-5">Cargando...</div> : products.length === 0 ? <div className="mt-4 rounded-2xl border p-5 text-sm text-neutral-500">Todavía no tenés productos.</div> : <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {products.map(product => <article key={product.id} className={`rounded-3xl border p-5 ${product.status === "archived" ? "opacity-60" : ""}`}>
          {product.photo_url && <img src={product.photo_url} alt="" className="mb-4 h-40 w-full rounded-2xl object-cover" />}
          <div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">{product.name}</h3><p className="mt-1 text-xs uppercase tracking-wide text-neutral-500">{product.status === "active" ? "Activo" : "Archivado"}</p></div>{product.status === "active" && <button onClick={() => void archiveProduct(product.id)} className="rounded-xl border px-3 py-2 text-xs">Archivar</button>}</div>
          {product.notes && <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">{product.notes}</p>}
          <div className="mt-4 space-y-2">{(prices[product.id] || []).slice(0, 5).map(p => <div key={p.id} className="flex items-center justify-between rounded-xl bg-neutral-50 p-3 text-sm dark:bg-neutral-950"><span>{p.price_type} · {p.quantity_min}{p.quantity_max ? `–${p.quantity_max}` : "+"}</span><strong>{money(p.price)}</strong></div>)}{!(prices[product.id] || []).length && <p className="text-sm text-neutral-500">Sin precios registrados.</p>}</div>
          <p className="mt-4 text-xs text-neutral-500">La rentabilidad se calculará con costos congelados cuando el producto quede vinculado a producción/ventas.</p>
        </article>)}
      </div>}
    </section>
  </AppShell>;
}
