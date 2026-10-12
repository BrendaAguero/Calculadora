import Link from "next/link";
import { cookies } from "next/headers";
import { ChevronRight, Factory, Receipt, ShoppingCart, TriangleAlert } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccessSnapshot } from "@/lib/access/permissions";
import { getOwnedActivities } from "@/lib/access/activities";
import { AppShell } from "@/components/app-shell";
import { LegalLinks } from "@/components/legal-links";
import { InstallApp } from "@/components/install-app";
import { resolvePeriod } from "@/lib/period";
import { isLow, loadStock } from "@/app/stock/data";
import { amount } from "@/app/stock/constants";
import { getSimpleMode } from "@/lib/simple-mode-server";
import { getHiddenSections } from "@/lib/menu-server";
import { SimpleModeToggle } from "@/components/simple-mode-toggle";
import { ProfitToggle } from "@/components/profit-toggle";
import { PROFIT_COOKIE } from "@/lib/profit";
import { OLD_PRICE_DAYS } from "@/lib/price-age";
import { MIXES } from "@/lib/mixes";

const one = <T,>(value: T | T[] | null) => (Array.isArray(value) ? value[0] : value);
const pesos = (value: number) => value.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", timeZone: "America/Argentina/Buenos_Aires" });
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const greeting = () => {
  const hour = new Date(Date.now() - 3 * 3_600_000).getUTCHours();
  return hour < 12 ? "Buen día" : hour < 20 ? "Buenas tardes" : "Buenas noches";
};

// Qué se puede calcular: Yeso y las mezclas, según las actividades de la persona (con Plus, todas).
const CALCULATORS = [{ code: "YESO", name: "Yeso", href: "/calcular" }, ...MIXES.map((m) => ({ code: m.code, name: m.name, href: `/calcular/${m.slug}` }))];

type Calc = { id: string; created_at: string; quantity: number; unit_cost: number; suggested_price: number; products: { name: string } | { name: string }[] | null; formulas: { name: string } | { name: string }[] | null; molds: { name: string } | { name: string }[] | null; activities: { name: string } | { name: string }[] | null };

// Inicio: la calculadora primero. Las ganancias aparecen cuando hay ventas, y se pueden ocultar.
export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const snapshot = user ? await getAccessSnapshot() : null;
  // Edición Personal recién activada: primero elige su actividad principal.
  if (user && snapshot?.baseLicenseActive && !snapshot.entrepreneurActive && !snapshot.isAdmin && !snapshot.isTester) {
    const { count } = await supabase.from("user_activities").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "active");
    if (count === 0) redirect("/bienvenida");
  }
  const month = resolvePeriod({ periodo: "mes" });
  const monthName = MONTHS[new Date(month.from!.getTime() + 12 * 3_600_000).getUTCMonth()];
  const plus = Boolean(snapshot && (snapshot.entrepreneurActive || snapshot.isAdmin || snapshot.isTester));

  const count = async (table: string) => user ? (await supabase.from(table).select("id", { count: "exact", head: true }).eq("user_id", user.id)).count ?? 0 : 0;
  const [[materials, formulas, molds, calculations], profileRes, salesRes, anySaleRes, calcsRes, stock, owned, simple, hidden, cookieStore] = await Promise.all([
    Promise.all(["materials", "formulas", "molds", "calculations"].map(count)),
    user ? supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    user ? supabase.from("sales").select("total,net_income,quantity").eq("user_id", user.id).is("voided_at", null).gte("sale_date", month.from!.toISOString()).limit(5000) : Promise.resolve({ data: [] }),
    user ? supabase.from("sales").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("voided_at", null) : Promise.resolve({ count: 0 }),
    user ? supabase.from("calculations").select("id,created_at,quantity,unit_cost,suggested_price,products(name),formulas(name),molds(name),activities(name)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(4) : Promise.resolve({ data: [] }),
    user ? loadStock(supabase, user.id) : Promise.resolve({ rows: [], error: null }),
    user ? getOwnedActivities(supabase, user.id) : Promise.resolve({ activities: [], error: null }),
    getSimpleMode(),
    getHiddenSections(),
    cookies(),
  ]);

  // Precios de materiales viejos (con la inflación conviene revisarlos).
  const oldPrices = user ? await (async () => {
    const { data: mats } = await supabase.from("materials").select("current_price_id").eq("user_id", user.id).eq("status", "active").not("current_price_id", "is", null);
    const ids = (mats ?? []).map((m) => m.current_price_id as string);
    if (!ids.length) return 0;
    const { count } = await supabase.from("material_prices").select("id", { count: "exact", head: true }).in("id", ids).lt("valid_from", daysAgo(OLD_PRICE_DAYS));
    return count ?? 0;
  })() : 0;

  const steps: [boolean, string, string][] = [
    [materials > 0, "/materials/new", "Cargá tu primer material con su precio"],
    [formulas > 0, "/formulas/new", "Guardá tu fórmula (por ejemplo, yeso con 75 % de agua)"],
    [molds > 0, "/gestion/moldes/new", "Registrá un molde con sus gramos"],
    [calculations > 0, "/calcular", "Hacé y guardá tu primer cálculo"],
  ];
  const done = steps.filter(([ok]) => ok).length;
  const nextStep = steps.find(([ok]) => !ok);

  const ownedCodes = owned.activities.map((a) => a.code);
  const calculators = CALCULATORS.filter((c) => plus || ownedCodes.includes(c.code));
  const recentCalcs = (calcsRes.data ?? []) as unknown as Calc[];
  const sales = (salesRes.data ?? []) as { total: number; net_income: number; quantity: number }[];
  const sold = sales.reduce((acc, s) => acc + Number(s.total), 0);
  const profit = sales.reduce((acc, s) => acc + Number(s.net_income), 0);
  const pieces = sales.reduce((acc, s) => acc + Number(s.quantity), 0);
  const hasSales = (anySaleRes.count ?? 0) > 0;
  const profitHidden = cookieStore.get(PROFIT_COOKIE)?.value === "0";
  const low = stock.rows.filter((r) => !r.archived && isLow(r)).slice(0, 4);
  const firstName = (profileRes.data?.full_name ?? "").trim().split(/\s+/)[0];
  const quick = [
    { href: "/ventas/nueva", label: "Registrar una venta", icon: Receipt, show: true },
    { href: "/produccion/nueva", label: "Registrar producción", icon: Factory, show: !simple && !hidden.includes("produccion") },
    { href: "/compras/nueva", label: "Registrar una compra", icon: ShoppingCart, show: !simple && !hidden.includes("compras") },
  ].filter((q) => q.show);

  const title = (calc: Calc) => one(calc.products)?.name ?? one(calc.formulas)?.name ?? one(calc.molds)?.name ?? `Cálculo de ${one(calc.activities)?.name ?? "yeso"}`;
  const big = simple ? "text-xl" : "text-lg";

  return (
    <AppShell>
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-base text-neutral-500 dark:text-neutral-400">{greeting()}{firstName ? `, ${firstName}` : ""}</p>
          <h1 className="text-[30px] leading-tight lg:text-4xl">¿Qué querés calcular hoy?</h1>
        </div>
      </header>

      {/* La calculadora, lo primero. */}
      <section aria-label="Calcular un precio" className="terrazo mt-5 rounded-4xl bg-orange-800 p-5 text-white dark:bg-orange-900 lg:p-6">
        <p className="text-base text-white/85">Calculá cuánto cobrar una pieza</p>
        <div className={`mt-3 grid gap-2.5 ${calculators.length > 1 ? "grid-cols-2" : ""}`}>
          {calculators.map((c, i) => (
            <Link key={c.code} href={c.href} className={`flex items-center justify-between gap-2 rounded-2xl px-4 py-4 font-bold ${big} ${i === 0 ? "bg-resina text-resina-dark" : "bg-white/15 hover:bg-white/25"}`}>
              {c.name}<ChevronRight size={20} aria-hidden="true" />
            </Link>
          ))}
          {!calculators.length && <Link href="/calcular" className={`flex items-center justify-between rounded-2xl bg-resina px-4 py-4 font-bold text-resina-dark ${big}`}>Calcular<ChevronRight size={20} aria-hidden="true" /></Link>}
        </div>
      </section>

      {nextStep && (
        <Link href={nextStep[1]} className="mt-4 flex items-center gap-4 rounded-3xl border-2 border-resina bg-amber-50 p-4 dark:bg-amber-950/30">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-resina font-display text-lg font-bold text-resina-dark">{done + 1}</span>
          <span className="min-w-0">
            <span className="block text-sm text-neutral-600 dark:text-neutral-300">Paso {done + 1} de {steps.length} para empezar</span>
            <span className="block font-semibold">{nextStep[2]}</span>
          </span>
          <ChevronRight size={22} aria-hidden="true" className="ml-auto shrink-0 text-neutral-500" />
        </Link>
      )}

      {recentCalcs.length > 0 && (
        <section aria-labelledby="ultimos-calculos" className="mt-5">
          <div className="mb-2 flex items-baseline justify-between px-1">
            <h2 id="ultimos-calculos" className="text-lg">Tus últimos cálculos</h2>
            <Link href="/historial" className="text-sm font-semibold text-orange-800 dark:text-orange-300">Ver todos</Link>
          </div>
          <div className="divide-y divide-neutral-100 rounded-3xl bg-white px-5 dark:divide-neutral-800 dark:bg-neutral-900">
            {recentCalcs.map((c) => (
              <Link key={c.id} href={`/historial/${c.id}`} className="flex items-center justify-between gap-3 py-3.5">
                <div className="min-w-0">
                  <p className="truncate font-medium">{title(c)}</p>
                  <p className="text-[13px] text-neutral-500 dark:text-neutral-400">{shortDate(c.created_at)} · costo {pesos(Number(c.unit_cost))} por pieza</p>
                </div>
                <p className="shrink-0 text-right font-display text-base font-bold">{pesos(Number(c.suggested_price))}<span className="block text-xs font-normal text-neutral-500">precio</span></p>
              </Link>
            ))}
          </div>
          <p className="mt-2 px-1 text-sm text-neutral-500 dark:text-neutral-400">Tocá uno para verlo o repetirlo con otra cantidad.</p>
        </section>
      )}

      {oldPrices > 0 && (
        <Link href="/materials" className="mt-4 flex items-center gap-3 rounded-3xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <TriangleAlert size={22} aria-hidden="true" className="shrink-0 text-amber-700" />
          <span>{oldPrices === 1 ? "1 material tiene" : `${oldPrices} materiales tienen`} el precio de hace más de 2 meses. <strong>Actualizalos</strong> para que tus cálculos no queden cortos.</span>
        </Link>
      )}

      <nav aria-label="Otras acciones" className={`mt-4 grid gap-2.5 ${quick.length > 1 ? "sm:grid-cols-3" : ""}`}>
        {quick.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex items-center gap-3 rounded-3xl bg-white px-4 py-3.5 font-semibold hover:ring-2 hover:ring-orange-200 dark:bg-neutral-900 dark:hover:ring-orange-900">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300"><Icon size={20} aria-hidden="true" /></span>
            {label}
          </Link>
        ))}
      </nav>

      {low.length > 0 && (
        <Link href="/stock" className="mt-4 flex items-center gap-3 rounded-3xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <TriangleAlert size={20} aria-hidden="true" className="shrink-0 text-amber-700" />
          <span><strong>{low[0].name}</strong> se está terminando: quedan {amount(low[0].quantity, low[0].unit)}.{low.length > 1 ? ` Y ${low.length - 1} más.` : ""}</span>
        </Link>
      )}

      {/* Ganancias: solo si ya hay ventas, y se pueden ocultar. */}
      {hasSales && !profitHidden && (
        <section aria-label={`Ganancia de ${monthName}`} className="mt-5 rounded-3xl bg-white p-5 dark:bg-neutral-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Lo que ganaste en {monthName}</p>
              <p className="mt-1 font-display text-3xl font-bold">{pesos(profit)}</p>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Vendiste {pesos(sold)} en {pieces.toLocaleString("es-AR")} {pieces === 1 ? "pieza" : "piezas"}. <Link href="/ventas" className="font-semibold text-orange-800 underline dark:text-orange-300">Ver ventas</Link></p>
            </div>
            <ProfitToggle visible />
          </div>
        </section>
      )}

      <div className="mt-5"><InstallApp /></div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <SimpleModeToggle initial={simple} compact />
        {hasSales && profitHidden && <ProfitToggle visible={false} />}
      </div>
      <LegalLinks className="mt-8" />
    </AppShell>
  );
}
