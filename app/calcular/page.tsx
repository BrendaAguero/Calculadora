'use client';

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AppShell } from "@/components/app-shell";

type Mode = "easy" | "standard" | "personalized";
type PriceMethod = "percentage" | "fixed" | "manual";

const WATER_REFERENCES = [70, 75, 80];

function money(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(value || 0);
}

function num(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function CalcularPage() {
  const [mode, setMode] = useState<Mode>("easy");
  const [quantity, setQuantity] = useState("1");
  const [moldWater, setMoldWater] = useState("");
  const [plasterPerPiece, setPlasterPerPiece] = useState("");
  const [waterPercentage, setWaterPercentage] = useState("75");
  const [plasterPriceKg, setPlasterPriceKg] = useState("");
  const [waste, setWaste] = useState("0");
  const [moldCost, setMoldCost] = useState("0");
  const [packaging, setPackaging] = useState("0");
  const [labor, setLabor] = useState("0");
  const [electricity, setElectricity] = useState("0");
  const [gas, setGas] = useState("0");
  const [commissions, setCommissions] = useState("0");
  const [other, setOther] = useState("0");
  const [priceMethod, setPriceMethod] = useState<PriceMethod>("percentage");
  const [profitPercentage, setProfitPercentage] = useState("30");
  const [fixedProfit, setFixedProfit] = useState("0");
  const [manualPrice, setManualPrice] = useState("0");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const result = useMemo(() => {
    const pieces = Math.max(1, Math.floor(num(quantity)) || 1);
    const plaster = num(plasterPerPiece) || num(moldWater);
    const plasterTotal = plaster * pieces;
    const waterTotal = plasterTotal * (num(waterPercentage) / 100);
    const wasteAmount = plasterTotal * (num(waste) / 100);
    const plasterWithWaste = plasterTotal + wasteAmount;
    const materialCost = (plasterWithWaste / 1000) * num(plasterPriceKg);
    const extras = [moldCost, packaging, labor, electricity, gas, commissions, other].reduce((sum, value) => sum + num(value), 0);
    const totalCost = materialCost + extras;
    const unitCost = totalCost / pieces;
    const price = priceMethod === "percentage"
      ? unitCost * (1 + num(profitPercentage) / 100)
      : priceMethod === "fixed"
        ? unitCost + num(fixedProfit)
        : num(manualPrice);
    const profit = price - unitCost;
    const margin = price > 0 ? (profit / price) * 100 : 0;
    return { pieces, plaster, plasterTotal, waterTotal, wasteAmount, plasterWithWaste, materialCost, extras, totalCost, unitCost, price, profit, margin };
  }, [quantity, plasterPerPiece, moldWater, waterPercentage, plasterPriceKg, waste, moldCost, packaging, labor, electricity, gas, commissions, other, priceMethod, profitPercentage, fixedProfit, manualPrice]);

  function applyReference(value: number) {
    setWaterPercentage(String(value));
  }

  async function saveCalculation() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("CALC-001: iniciá sesión para guardar el cálculo.");

      const { data: activity, error: activityError } = await supabase.from("activities").select("id").eq("code", "YESO").single();
      if (activityError || !activity) throw new Error("CALC-002: no se encontró la actividad Yeso.");

      const { data: calculation, error: calculationError } = await supabase.from("calculations").insert({
        user_id: user.id,
        activity_id: activity.id,
        calculation_mode: mode,
        quantity: result.pieces,
        total_cost: result.totalCost,
        unit_cost: result.unitCost,
        suggested_price: result.price,
        profit_per_unit: result.profit,
        margin_percentage: result.margin,
      }).select("id").single();
      if (calculationError || !calculation) throw new Error("CALC-003: no se pudo guardar el cálculo.");

      const snapshots = [
        { material_name_snapshot: "Yeso", quantity: result.plasterWithWaste, unit: "g", unit_cost_snapshot: num(plasterPriceKg) / 1000, total_cost: result.materialCost, metadata: { water_percentage: num(waterPercentage), water_total_g: result.waterTotal, waste_percentage: num(waste) } },
        { material_name_snapshot: "Molde", quantity: 1, unit: "unidad", unit_cost_snapshot: num(moldCost), total_cost: num(moldCost), metadata: { category: "mold" } },
        { material_name_snapshot: "Packaging", quantity: 1, unit: "unidad", unit_cost_snapshot: num(packaging), total_cost: num(packaging), metadata: { category: "packaging" } },
        { material_name_snapshot: "Mano de obra", quantity: 1, unit: "unidad", unit_cost_snapshot: num(labor), total_cost: num(labor), metadata: { category: "labor" } },
        { material_name_snapshot: "Electricidad", quantity: 1, unit: "unidad", unit_cost_snapshot: num(electricity), total_cost: num(electricity), metadata: { category: "electricity" } },
        { material_name_snapshot: "Gas", quantity: 1, unit: "unidad", unit_cost_snapshot: num(gas), total_cost: num(gas), metadata: { category: "gas" } },
        { material_name_snapshot: "Comisiones", quantity: 1, unit: "unidad", unit_cost_snapshot: num(commissions), total_cost: num(commissions), metadata: { category: "commissions" } },
        { material_name_snapshot: "Otros", quantity: 1, unit: "unidad", unit_cost_snapshot: num(other), total_cost: num(other), metadata: { category: "other" } },
      ].filter((item) => item.total_cost > 0 || item.material_name_snapshot === "Yeso");

      const { error: itemsError } = await supabase.from("calculation_items").insert(snapshots.map((item) => ({ ...item, calculation_id: calculation.id })));
      if (itemsError) throw new Error("CALC-004: el cálculo se guardó, pero no se pudieron guardar sus detalles.");
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "CALC-999: no se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <header>
        <p className="text-sm font-medium text-orange-700 dark:text-orange-300">Calculadora de Yeso</p>
        <h1 className="mt-1 text-3xl font-bold">Calcular</h1>
        <p className="mt-2 text-sm text-neutral-500">Elegí un modo y cambiá de modo sin perder los datos.</p>
      </header>

      <section className="mt-6 grid grid-cols-3 gap-2" aria-label="Modo de cálculo">
        {([['easy', 'Fácil'], ['standard', 'Estándar'], ['personalized', 'Personalizado']] as const).map(([value, label]) => (
          <button key={value} type="button" onClick={() => setMode(value)} className={`rounded-xl border px-2 py-3 text-sm font-semibold ${mode === value ? "border-orange-700 bg-orange-700 text-white" : "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"}`}>{label}</button>
        ))}
      </section>

      <section className="mt-5 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="font-semibold">1. Cantidad y yeso</h2>
        {mode === "easy" && <div className="mt-4 rounded-2xl bg-orange-50 p-4 text-sm dark:bg-orange-950/30"><strong>¿No sabés cuánto yeso lleva el molde?</strong><p className="mt-1">Llená el molde con agua y pesala. En Yeso, esos gramos se toman como gramos de yeso por pieza.</p></div>}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">Cantidad de piezas<input value={quantity} onChange={(e) => setQuantity(e.target.value)} type="number" min="1" step="1" className="mt-1 w-full rounded-xl border p-3 dark:border-neutral-700 dark:bg-neutral-950" /></label>
          <label className="text-sm font-medium">{mode === "easy" ? "Agua del molde (g)" : "Yeso por pieza (g)"}<input value={mode === "easy" ? moldWater : plasterPerPiece} onChange={(e) => mode === "easy" ? setMoldWater(e.target.value) : setPlasterPerPiece(e.target.value)} type="number" min="0" step="0.1" className="mt-1 w-full rounded-xl border p-3 dark:border-neutral-700 dark:bg-neutral-950" /></label>
          {mode === "easy" && <label className="text-sm font-medium">Yeso por pieza (g), si querés corregirlo<input value={plasterPerPiece} onChange={(e) => setPlasterPerPiece(e.target.value)} type="number" min="0" step="0.1" placeholder={result.plaster ? String(result.plaster) : "Opcional"} className="mt-1 w-full rounded-xl border p-3 dark:border-neutral-700 dark:bg-neutral-950" /></label>}
          <label className="text-sm font-medium">% de agua<input value={waterPercentage} onChange={(e) => setWaterPercentage(e.target.value)} type="number" min="0" step="1" className="mt-1 w-full rounded-xl border p-3 dark:border-neutral-700 dark:bg-neutral-950" /></label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">{WATER_REFERENCES.map((value) => <button type="button" key={value} onClick={() => applyReference(value)} className="rounded-full border px-3 py-1 text-xs">Usar {value}%</button>)}</div>
        <p className="mt-3 text-xs text-neutral-500">70%, 75% y 80% son referencias iniciales, no reglas universales. Si guardás una fórmula, su porcentaje propio tiene prioridad.</p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div className="rounded-2xl bg-neutral-50 p-3 dark:bg-neutral-950"><span className="text-neutral-500">Yeso total</span><strong className="mt-1 block">{result.plasterTotal.toFixed(1)} g</strong></div><div className="rounded-2xl bg-neutral-50 p-3 dark:bg-neutral-950"><span className="text-neutral-500">Agua total</span><strong className="mt-1 block">{result.waterTotal.toFixed(1)} g</strong></div></div>
      </section>

      <section className="mt-5 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="font-semibold">2. Costos</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">Precio del yeso por kg<input value={plasterPriceKg} onChange={(e) => setPlasterPriceKg(e.target.value)} type="number" min="0" step="0.01" className="mt-1 w-full rounded-xl border p-3 dark:border-neutral-700 dark:bg-neutral-950" /></label>
          <label className="text-sm font-medium">Merma (%)<input value={waste} onChange={(e) => setWaste(e.target.value)} type="number" min="0" step="0.1" className="mt-1 w-full rounded-xl border p-3 dark:border-neutral-700 dark:bg-neutral-950" /></label>
          {mode !== "easy" && <><label className="text-sm font-medium">Molde<input value={moldCost} onChange={(e) => setMoldCost(e.target.value)} type="number" min="0" step="0.01" className="mt-1 w-full rounded-xl border p-3 dark:border-neutral-700 dark:bg-neutral-950" /></label><label className="text-sm font-medium">Packaging<input value={packaging} onChange={(e) => setPackaging(e.target.value)} type="number" min="0" step="0.01" className="mt-1 w-full rounded-xl border p-3 dark:border-neutral-700 dark:bg-neutral-950" /></label></>}
          {mode === "personalized" && <><label className="text-sm font-medium">Mano de obra<input value={labor} onChange={(e) => setLabor(e.target.value)} type="number" min="0" step="0.01" className="mt-1 w-full rounded-xl border p-3 dark:border-neutral-700 dark:bg-neutral-950" /></label><label className="text-sm font-medium">Electricidad<input value={electricity} onChange={(e) => setElectricity(e.target.value)} type="number" min="0" step="0.01" className="mt-1 w-full rounded-xl border p-3 dark:border-neutral-700 dark:bg-neutral-950" /></label><label className="text-sm font-medium">Gas<input value={gas} onChange={(e) => setGas(e.target.value)} type="number" min="0" step="0.01" className="mt-1 w-full rounded-xl border p-3 dark:border-neutral-700 dark:bg-neutral-950" /></label><label className="text-sm font-medium">Comisiones<input value={commissions} onChange={(e) => setCommissions(e.target.value)} type="number" min="0" step="0.01" className="mt-1 w-full rounded-xl border p-3 dark:border-neutral-700 dark:bg-neutral-950" /></label><label className="text-sm font-medium">Otros<input value={other} onChange={(e) => setOther(e.target.value)} type="number" min="0" step="0.01" className="mt-1 w-full rounded-xl border p-3 dark:border-neutral-700 dark:bg-neutral-950" /></label></>}
        </div>
        <p className="mt-3 text-xs text-neutral-500">Los cálculos guardados deben conservar los precios y costos usados en ese momento.</p>
      </section>

      <section className="mt-5 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="font-semibold">3. Precio</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">{([['percentage','% de ganancia'],['fixed','Ganancia fija'],['manual','Precio manual']] as const).map(([value,label]) => <button type="button" key={value} onClick={() => setPriceMethod(value)} className={`rounded-xl border p-3 text-sm font-medium ${priceMethod === value ? "border-orange-700 bg-orange-50 dark:bg-orange-950/30" : "dark:border-neutral-700"}`}>{label}</button>)}</div>
        <div className="mt-4">{priceMethod === "percentage" && <label className="text-sm font-medium">Ganancia (%)<input value={profitPercentage} onChange={(e) => setProfitPercentage(e.target.value)} type="number" min="0" step="1" className="mt-1 w-full rounded-xl border p-3 dark:border-neutral-700 dark:bg-neutral-950" /></label>}{priceMethod === "fixed" && <label className="text-sm font-medium">Ganancia fija por pieza<input value={fixedProfit} onChange={(e) => setFixedProfit(e.target.value)} type="number" min="0" step="0.01" className="mt-1 w-full rounded-xl border p-3 dark:border-neutral-700 dark:bg-neutral-950" /></label>}{priceMethod === "manual" && <label className="text-sm font-medium">Precio por pieza<input value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} type="number" min="0" step="0.01" className="mt-1 w-full rounded-xl border p-3 dark:border-neutral-700 dark:bg-neutral-950" /></label>}</div>
      </section>

      <section className="mt-5 rounded-3xl bg-neutral-950 p-5 text-white dark:bg-white dark:text-neutral-950">
        <p className="text-sm opacity-70">Resultado</p>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><span className="opacity-60">Costo total</span><strong className="mt-1 block text-xl">{money(result.totalCost)}</strong></div><div><span className="opacity-60">Costo unitario</span><strong className="mt-1 block text-xl">{money(result.unitCost)}</strong></div><div><span className="opacity-60">Precio sugerido</span><strong className="mt-1 block text-xl">{money(result.price)}</strong></div><div><span className="opacity-60">Ganancia por unidad</span><strong className="mt-1 block text-xl">{money(result.profit)}</strong></div></div>
        <div className="mt-4 rounded-2xl bg-white/10 p-3 text-sm dark:bg-black/10">Margen: <strong>{result.margin.toFixed(1)}%</strong>. El precio sugerido es una referencia: vos decidís el precio final.</div>
        <button type="button" onClick={saveCalculation} disabled={saving} className="mt-4 min-h-11 w-full rounded-xl bg-orange-500 px-4 font-semibold text-white disabled:opacity-50">{saving ? "Guardando…" : saved ? "✓ Cálculo guardado" : "Guardar cálculo"}</button>
        {error && <p className="mt-3 rounded-xl bg-red-500/20 p-3 text-sm">{error}</p>}
      </section>
    </AppShell>
  );
}
