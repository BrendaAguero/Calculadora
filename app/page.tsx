import { HomeTimers } from "@/components/home-timers";
import { upcomingSaleDates } from "@/lib/sale-dates";
import { todayAR } from "@/lib/test-logs";
import Link from "next/link";
import { cookies } from "next/headers";
import { ChevronRight, Factory, Receipt, ShoppingCart, TriangleAlert } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccessSnapshot, hasFeature } from "@/lib/access/permissions";
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
import { MIXES, mergeSettings, mixByCode } from "@/lib/mixes";
import { MixQuick, type QuickOption } from "@/components/mix-quick";
import { widgetSet } from "@/lib/home-widgets";

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
  const month = resolvePeriod({ periodo: "mes" });
  const monthName = MONTHS[new Date(month.from!.getTime() + 12 * 3_600_000).getUTCMonth()];

  // Precios de materiales viejos (con la inflación conviene revisarlos).
  const countOldPrices = async (userId: string) => {
    const { data: mats } = await supabase.from("materials").select("current_price_id").eq("user_id", userId).eq("status", "active").not("current_price_id", "is", null);
    const ids = (mats ?? []).map((m) => m.current_price_id as string);
    if (!ids.length) return 0;
    const { count } = await supabase.from("material_prices").select("id", { count: "exact", head: true }).in("id", ids).lt("valid_from", daysAgo(OLD_PRICE_DAYS));
    return count ?? 0;
  };

  const count = async (table: string) => user ? (await supabase.from(table).select("id", { count: "exact", head: true }).eq("user_id", user.id)).count ?? 0 : 0;
  // Todo se pide a la vez (antes iba de a una consulta y el Inicio tardaba más).
  const [snapshot, activitiesCount, oldPrices, settingsRes, [materials, formulas, molds, calculations], profileRes, salesRes, anySaleRes, calcsRes, stock, owned, simple, hidden, cookieStore, prefsRes, timersRes] = await Promise.all([
    user ? getAccessSnapshot() : Promise.resolve(null),
    user ? supabase.from("user_activities").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "active").then((r) => r.count) : Promise.resolve(null),
    user ? countOldPrices(user.id) : Promise.resolve(0),
    user ? supabase.from("activity_settings").select("activity_code,settings").eq("user_id", user.id) : Promise.resolve({ data: [] }),
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
    user ? supabase.from("user_preferences").select("home_widgets").eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    user ? supabase.from("cure_timers").select("id,label,ends_at").eq("user_id", user.id).is("done_at", null).order("ends_at").limit(3) : Promise.resolve({ data: [] }),
  ]);
  // Edición Personal recién activada: primero elige su actividad principal.
  if (user && snapshot?.baseLicenseActive && !snapshot.entrepreneurActive && !snapshot.isAdmin && !snapshot.isTester && activitiesCount === 0) redirect("/bienvenida");
  const plus = Boolean(snapshot && (snapshot.entrepreneurActive || snapshot.isAdmin || snapshot.isTester));
  const savedSettings = settingsRes.data;
  // Primera vez: elegir el modo y qué ver.
  if (user && !prefsRes.data?.home_widgets) redirect("/empezar");
  const show = widgetSet(prefsRes.data?.home_widgets);

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
  // Recetas guardadas de cada mezcla (si no hay, las de fábrica).
  const quickOptions: QuickOption[] = (calculators.length ? calculators : CALCULATORS.slice(0, 1)).map((c) => {
    const def = mixByCode(c.code);
    return { code: c.code, name: c.name, href: c.href, settings: def ? mergeSettings(def, (savedSettings ?? []).find((s) => s.activity_code === c.code)?.settings) : null };
  });
  const recentCalcs = (calcsRes.data ?? []) as unknown as Calc[];
  const sales = (salesRes.data ?? []) as { total: number; net_income: number; quantity: number }[];
  const sold = sales.reduce((acc, s) => acc + Number(s.total), 0);
  const profit = sales.reduce((acc, s) => acc + Number(s.net_income), 0);
  const pieces = sales.reduce((acc, s) => acc + Number(s.quantity), 0);
  // Sin el Pack Ventas y Stock no se muestran ganancias ni avisos de stock (llevarían a pantallas bloqueadas).
  const pack = !snapshot || hasFeature(snapshot, "VENTAS");
  const hasSales = pack && (anySaleRes.count ?? 0) > 0;
  const profitHidden = cookieStore.get(PROFIT_COOKIE)?.value === "0";
  const low = !pack ? [] : stock.rows.filter((r) => !r.archived && isLow(r)).slice(0, 4);
  const firstName = (profileRes.data?.full_name ?? "").trim().split(/\s+/)[0];
  // Ventas, producción y compras son del Pack Ventas y Stock: sin él no se muestran los atajos.
  const quick = !pack ? [] : [
    { href: "/ventas/nueva", label: "Registrar una venta", icon: Receipt, show: true },
    { href: "/produccion/nueva", label: "Registrar producción", icon: Factory, show: !simple && !hidden.includes("produccion") },
    { href: "/compras/nueva", label: "Registrar una compra", icon: ShoppingCart, show: !simple && !hidden.includes("compras") },
  ].filter((q) => q.show);

  const title = (calc: Calc) => one(calc.products)?.name ?? one(calc.formulas)?.name ?? one(calc.molds)?.name ?? `Cálculo de ${one(calc.activities)?.name ?? "yeso"}`;
  const big = simple ? "text-xl" : "text-lg";
  // Próxima fecha para vender, solo cuando ya es momento de preparar.
  const nextSale = upcomingSaleDates(todayAR()).find((d) => d.preparing);

  return (
    <AppShell>
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-base text-neutral-500 dark:text-neutral-400">{greeting()}{firstName ? `, ${firstName}` : ""}</p>
          <h1 className="text-[30px] leading-tight lg:text-4xl">¿Qué querés calcular hoy?</h1>
        </div>
      </header>

      {/* Temporizadores en marcha (solo si hay alguno). */}
      <HomeTimers timers={timersRes.data ?? []} />

      {nextSale && (
        <Link href="/fechas" className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-orange-50 px-4 py-3 text-sm text-orange-900 dark:bg-orange-950/40 dark:text-orange-100">
          <span><strong>{nextSale.name}</strong>: {nextSale.daysLeft === 0 ? "es hoy" : `faltan ${nextSale.daysLeft} día${nextSale.daysLeft === 1 ? "" : "s"}`}. ¡Es momento de preparar!</span>
          <span className="shrink-0 font-semibold underline">Ver fechas</span>
        </Link>
      )}

      {/* Lo principal: cuánto material y cuánto líquido preparar. */}
      {show.has("preparo") && <MixQuick options={quickOptions} />}

      <nav aria-label="Calcular el precio" className="mt-3 flex flex-wrap gap-2">
        {calculators.length > 1 && calculators.map((c) => (
          <Link key={c.code} href={c.href} className={`rounded-full bg-white px-4 py-2 font-semibold dark:bg-neutral-900 ${big === "text-xl" ? "text-base" : "text-sm"}`}>Precio de {c.name.toLowerCase()} →</Link>
        ))}
        <Link href="/herramientas" className={`rounded-full bg-white px-4 py-2 font-semibold dark:bg-neutral-900 ${big === "text-xl" ? "text-base" : "text-sm"}`}>Herramientas →</Link>
      </nav>

      {show.has("pasos") && nextStep && (
        <Link href={nextStep[1]} className="mt-4 flex items-center gap-4 rounded-3xl border-2 border-resina bg-amber-50 p-4 dark:bg-amber-950/30">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-resina font-display text-lg font-bold text-resina-dark">{done + 1}</span>
          <span className="min-w-0">
            <span className="block text-sm text-neutral-600 dark:text-neutral-300">Paso {done + 1} de {steps.length} para empezar</span>
            <span className="block font-semibold">{nextStep[2]}</span>
          </span>
          <ChevronRight size={22} aria-hidden="true" className="ml-auto shrink-0 text-neutral-500" />
        </Link>
      )}

      {show.has("calculos") && recentCalcs.length > 0 && (
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

      {show.has("avisos") && oldPrices > 0 && (
        <Link href="/materials" className="mt-4 flex items-center gap-3 rounded-3xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <TriangleAlert size={22} aria-hidden="true" className="shrink-0 text-amber-700" />
          <span>{oldPrices === 1 ? "1 material tiene" : `${oldPrices} materiales tienen`} el precio de hace más de 2 meses. <strong>Actualizalos</strong> para que tus cálculos no queden cortos.</span>
        </Link>
      )}

      {show.has("acciones") && quick.length > 0 && <nav aria-label="Otras acciones" className={`mt-4 grid gap-2.5 ${quick.length > 1 ? "sm:grid-cols-3" : ""}`}>
        {quick.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex items-center gap-3 rounded-3xl bg-white px-4 py-3.5 font-semibold hover:ring-2 hover:ring-orange-200 dark:bg-neutral-900 dark:hover:ring-orange-900">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300"><Icon size={20} aria-hidden="true" /></span>
            {label}
          </Link>
        ))}
      </nav>}

      {show.has("avisos") && low.length > 0 && (
        <Link href="/stock" className="mt-4 flex items-center gap-3 rounded-3xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <TriangleAlert size={20} aria-hidden="true" className="shrink-0 text-amber-700" />
          <span><strong>{low[0].name}</strong> se está terminando: quedan {amount(low[0].quantity, low[0].unit)}.{low.length > 1 ? ` Y ${low.length - 1} más.` : ""}</span>
        </Link>
      )}

      {/* Ganancias: solo si ya hay ventas, y se pueden ocultar. */}
      {show.has("ganancias") && hasSales && !profitHidden && (
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
