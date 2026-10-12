import Link from "next/link";
import { Calculator, ChevronRight, Factory, Package, Plus, Receipt, ShoppingCart, TriangleAlert } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccessSnapshot } from "@/lib/access/permissions";
import { AppShell } from "@/components/app-shell";
import { LegalLinks } from "@/components/legal-links";
import { InstallApp } from "@/components/install-app";
import { resolvePeriod } from "@/lib/period";
import { isLow, loadStock } from "@/app/stock/data";
import { amount } from "@/app/stock/constants";
import { getSimpleMode } from "@/lib/simple-mode-server";
import { SimpleModeToggle } from "@/components/simple-mode-toggle";
import { OLD_PRICE_DAYS } from "@/lib/price-age";

const one = <T,>(value: T | T[] | null) => (Array.isArray(value) ? value[0] : value);
const pesos = (value: number) => value.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const saleDay = (iso: string) => {
  const day = (d: Date) => new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
  const today = day(new Date());
  const yesterday = day(new Date(Date.now() - 86_400_000));
  const value = day(new Date(iso));
  if (value === today) return "Hoy";
  if (value === yesterday) return "Ayer";
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", timeZone: "America/Argentina/Buenos_Aires" });
};
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const greeting = () => {
  const hour = new Date(Date.now() - 3 * 3_600_000).getUTCHours();
  return hour < 12 ? "Buen día" : hour < 20 ? "Buenas tardes" : "Buenas noches";
};

const SIMPLE_ACTIONS = [
  { href: "/calcular", label: "Calcular un precio", hint: "Cuánto cobrar por una pieza", icon: Calculator, main: true },
  { href: "/ventas/nueva", label: "Registrar una venta", hint: "Anotá lo que vendiste", icon: Receipt },
  { href: "/stock", label: "Ver lo que tengo", hint: "Materiales y piezas en stock", icon: Package },
];

const ACTIONS = [
  { href: "/calcular", label: "Calcular", icon: Calculator, main: true },
  { href: "/ventas/nueva", label: "Vender", icon: Receipt },
  { href: "/produccion/nueva", label: "Producir", icon: Factory },
  { href: "/compras/nueva", label: "Comprar", icon: ShoppingCart },
];

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // Edición Personal recién activada: primero elige su actividad principal.
  if (user) {
    const snapshot = await getAccessSnapshot();
    if (snapshot?.baseLicenseActive && !snapshot.entrepreneurActive && !snapshot.isAdmin && !snapshot.isTester) {
      const { count } = await supabase.from("user_activities").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "active");
      if (count === 0) redirect("/bienvenida");
    }
  }
  const month = resolvePeriod({ periodo: "mes" });
  const monthName = MONTHS[new Date(month.from!.getTime() + 12 * 3_600_000).getUTCMonth()];

  // Tutorial inicial: se muestra hasta que la persona completa los primeros pasos.
  const count = async (table: string) => user ? (await supabase.from(table).select("id", { count: "exact", head: true }).eq("user_id", user.id)).count ?? 0 : 0;
  const [[materials, formulas, molds, calculations], profileRes, salesRes, recentRes, productionsRes, stock] = await Promise.all([
    Promise.all(["materials", "formulas", "molds", "calculations"].map(count)),
    user ? supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    user ? supabase.from("sales").select("total,net_income,quantity").eq("user_id", user.id).is("voided_at", null).gte("sale_date", month.from!.toISOString()).limit(5000) : Promise.resolve({ data: [] }),
    user ? supabase.from("sales").select("id,total,quantity,sale_date,customer_name,products(name)").eq("user_id", user.id).is("voided_at", null).order("sale_date", { ascending: false }).limit(4) : Promise.resolve({ data: [] }),
    user ? supabase.from("productions").select("quantity").eq("user_id", user.id).gte("produced_at", month.from!.toISOString()).limit(5000) : Promise.resolve({ data: [] }),
    user ? loadStock(supabase, user.id) : Promise.resolve({ rows: [], error: null }),
  ]);
  // Precios de materiales viejos (con la inflación conviene revisarlos).
  const oldPrices = user ? await (async () => {
    const { data: mats } = await supabase.from("materials").select("current_price_id").eq("user_id", user.id).eq("status", "active").not("current_price_id", "is", null);
    const ids = (mats ?? []).map((m) => m.current_price_id as string);
    if (!ids.length) return 0;
    const { count } = await supabase.from("material_prices").select("id", { count: "exact", head: true }).in("id", ids).lt("valid_from", daysAgo(OLD_PRICE_DAYS));
    return count ?? 0;
  })() : 0;
  const oldNotice = oldPrices > 0 && (
    <Link href="/materials" className="mt-4 flex items-center gap-3 rounded-3xl border border-amber-300 bg-amber-50 p-4 text-base text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
      <TriangleAlert size={22} aria-hidden="true" className="shrink-0 text-amber-700" />
      <span>{oldPrices === 1 ? "1 material tiene" : `${oldPrices} materiales tienen`} el precio de hace más de 2 meses. <strong>Actualizalos</strong> para que tus precios no queden cortos.</span>
    </Link>
  );
  const steps: [boolean, string, string][] = [
    [materials > 0, "/materials/new", "Cargá tu primer material con su precio"],
    [formulas > 0, "/formulas/new", "Guardá tu fórmula (por ejemplo, yeso con 75 % de agua)"],
    [molds > 0, "/gestion/moldes/new", "Registrá un molde con sus gramos"],
    [calculations > 0, "/calcular", "Hacé y guardá tu primer cálculo"],
  ];
  const done = steps.filter(([ok]) => ok).length;

  const sales = (salesRes.data ?? []) as { total: number; net_income: number; quantity: number }[];
  const sold = sales.reduce((acc, s) => acc + Number(s.total), 0);
  const profit = sales.reduce((acc, s) => acc + Number(s.net_income), 0);
  const pieces = sales.reduce((acc, s) => acc + Number(s.quantity), 0);
  const margin = sold > 0 ? Math.round((profit / sold) * 100) : null;
  const produced = ((productionsRes.data ?? []) as { quantity: number }[]).reduce((acc, p) => acc + Number(p.quantity), 0);
  const stockValue = stock.rows.reduce((acc, r) => acc + (r.unitValue == null ? 0 : Math.max(r.quantity, 0) * r.unitValue), 0);
  const low = stock.rows.filter((r) => !r.archived && isLow(r)).slice(0, 4);
  const recent = (recentRes.data ?? []) as unknown as { id: string; total: number; quantity: number; sale_date: string; customer_name: string | null; products: { name: string } | { name: string }[] | null }[];
  const firstName = (profileRes.data?.full_name ?? "").trim().split(/\s+/)[0];
  const nextStep = steps.find(([ok]) => !ok);

  if (await getSimpleMode()) {
    return (
      <AppShell>
        <header>
          <p className="text-base text-neutral-500 dark:text-neutral-400">{greeting()}{firstName ? `, ${firstName}` : ""}</p>
          <h1 className="text-[30px] leading-tight lg:text-4xl">¿Qué querés hacer hoy?</h1>
        </header>

        {nextStep && (
          <Link href={nextStep[1]} className="mt-5 flex items-center gap-4 rounded-3xl border-2 border-resina bg-amber-50 p-5 dark:bg-amber-950/30">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-resina font-display text-lg font-bold text-resina-dark">{done + 1}</span>
            <span className="min-w-0">
              <span className="block text-sm text-neutral-600 dark:text-neutral-300">Paso {done + 1} de {steps.length} para empezar</span>
              <span className="block text-lg font-semibold">{nextStep[2]}</span>
            </span>
            <ChevronRight size={22} aria-hidden="true" className="ml-auto shrink-0 text-neutral-500" />
          </Link>
        )}

        <nav aria-label="Qué querés hacer" className="mt-5 grid gap-3 lg:grid-cols-3">
          {SIMPLE_ACTIONS.map(({ href, label, hint, icon: Icon, main }) => (
            <Link key={href} href={href} className="flex items-center gap-4 rounded-3xl bg-white p-5 hover:ring-2 hover:ring-orange-200 dark:bg-neutral-900 dark:hover:ring-orange-900">
              <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${main ? "bg-resina text-resina-dark" : "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300"}`}><Icon size={28} aria-hidden="true" /></span>
              <span className="min-w-0">
                <span className="block text-xl font-bold">{label}</span>
                <span className="block text-[15px] text-neutral-500 dark:text-neutral-400">{hint}</span>
              </span>
              <ChevronRight size={22} aria-hidden="true" className="ml-auto shrink-0 text-neutral-400" />
            </Link>
          ))}
        </nav>

        <Link href="/ventas" aria-label={`Ganancia de ${monthName}: ${pesos(profit)}. Ver lo que vendí`} className="terrazo mt-5 block rounded-4xl bg-orange-800 p-6 text-white dark:bg-orange-900">
          <p className="text-base text-white/85">Lo que ganaste en {monthName}</p>
          <p className="mt-1 font-display text-[42px] font-bold leading-none tracking-tight">{pesos(profit)}</p>
          <p className="mt-3 text-base text-white/85">{sales.length === 0 ? "Cuando registres ventas, acá vas a ver tu ganancia." : `Vendiste ${pesos(sold)} en ${pieces.toLocaleString("es-AR")} ${pieces === 1 ? "pieza" : "piezas"}.`}</p>
        </Link>

        {low.length > 0 && (
          <Link href="/stock" className="mt-4 flex items-center gap-3 rounded-3xl border border-amber-300 bg-amber-50 p-4 text-base text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            <TriangleAlert size={22} aria-hidden="true" className="shrink-0 text-amber-700" />
            <span><strong>{low[0].name}</strong> se está terminando: quedan {amount(low[0].quantity, low[0].unit)}.</span>
          </Link>
        )}

        {oldNotice}
        <div className="mt-4"><InstallApp /></div>
        <div className="mt-4"><SimpleModeToggle initial /></div>
        <LegalLinks className="mt-8" />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{greeting()}{firstName ? `, ${firstName}` : ""}</p>
          <h1 className="text-[28px] leading-tight lg:text-4xl">Tu taller hoy</h1>
        </div>
        <div className="flex items-center gap-3">
          <SimpleModeToggle initial={false} compact />
          <Link href="/ventas/nueva" className="hidden items-center gap-2 rounded-2xl bg-resina px-4 py-2.5 text-sm font-bold text-resina-dark lg:inline-flex"><Plus size={18} aria-hidden="true" />Nueva venta</Link>
        </div>
      </header>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section aria-label={`Ganancia de ${monthName}`} className="terrazo rounded-4xl bg-orange-800 p-6 text-white dark:bg-orange-900">
          <p className="text-sm text-white/80">Ganancia de {monthName}</p>
          <p className="mt-1 font-display text-[42px] font-bold leading-none tracking-tight lg:text-6xl">{pesos(profit)}</p>
          <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/80">
            <div><dt>Ventas</dt><dd className="font-display text-lg font-bold text-white">{pesos(sold)}</dd></div>
            <div><dt>Margen</dt><dd className="font-display text-lg font-bold text-white">{margin === null ? "—" : `${margin} %`}</dd></div>
            <div><dt>Piezas vendidas</dt><dd className="font-display text-lg font-bold text-white">{pieces.toLocaleString("es-AR")}</dd></div>
          </dl>
        </section>
        <div className="hidden gap-4 lg:grid">
          <Link href="/produccion" className="rounded-3xl bg-white p-5 dark:bg-neutral-900"><p className="text-sm text-neutral-500 dark:text-neutral-400">Producción de {monthName}</p><p className="mt-1 font-display text-3xl font-bold">{produced.toLocaleString("es-AR")} piezas</p></Link>
          <Link href="/stock" className="rounded-3xl bg-white p-5 dark:bg-neutral-900"><p className="text-sm text-neutral-500 dark:text-neutral-400">Valor de tu stock</p><p className="mt-1 font-display text-3xl font-bold">{pesos(stockValue)}</p></Link>
        </div>
      </div>

      <nav aria-label="Accesos rápidos" className="mt-4 grid grid-cols-4 gap-2.5 lg:gap-4">
        {ACTIONS.map(({ href, label, icon: Icon, main }) => (
          <Link key={href} href={href} className="flex flex-col items-center gap-2 rounded-3xl bg-white px-1 py-3.5 text-[13px] font-semibold hover:ring-2 hover:ring-orange-200 dark:bg-neutral-900 dark:hover:ring-orange-900 lg:flex-row lg:gap-3 lg:px-4 lg:text-[15px]">
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${main ? "bg-resina text-resina-dark" : "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300"}`}><Icon size={22} aria-hidden="true" /></span>
            {label}
          </Link>
        ))}
      </nav>

      {oldNotice}
      <div className="mt-4"><InstallApp /></div>

      {done < steps.length && (
        <section aria-labelledby="primeros-pasos" className="mt-4 rounded-3xl bg-white p-5 dark:bg-neutral-900">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="primeros-pasos" className="text-lg">Primeros pasos</h2>
            <span className="text-sm text-neutral-500 dark:text-neutral-400">{done} de {steps.length}</span>
          </div>
          <ol className="mt-3 space-y-2.5 text-sm">
            {steps.map(([ok, href, label]) => (
              <li key={href} className="flex items-center gap-2.5">
                <span aria-hidden="true" className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${ok ? "bg-orange-700 text-white" : "border-2 border-neutral-300 dark:border-neutral-600"}`}>{ok ? "✓" : ""}</span>
                {ok ? <span className="text-neutral-500 line-through">{label}</span> : <Link href={href} className="font-medium underline decoration-orange-300 underline-offset-4">{label}</Link>}
                <span className="sr-only">{ok ? "(hecho)" : "(pendiente)"}</span>
              </li>
            ))}
          </ol>
          <Link href="/ayuda#empezar" className="mt-3 inline-block text-sm text-orange-800 underline dark:text-orange-300">Ver la guía de primeros pasos</Link>
        </section>
      )}

      {low.length > 0 && (
        <Link href="/stock" className="mt-4 flex items-center gap-3 rounded-3xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100 lg:hidden">
          <TriangleAlert size={20} aria-hidden="true" className="shrink-0 text-amber-700" />
          <span><strong>{low[0].name}</strong> está por terminarse: quedan {amount(low[0].quantity, low[0].unit)}.{low.length > 1 ? ` Y ${low.length - 1} más.` : ""}</span>
        </Link>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="ultimas-ventas">
          <div className="mb-2 flex items-baseline justify-between px-1">
            <h2 id="ultimas-ventas" className="text-lg">Últimas ventas</h2>
            <Link href="/ventas" className="text-sm font-semibold text-orange-800 dark:text-orange-300">Ver todas</Link>
          </div>
          <div className="divide-y divide-neutral-100 rounded-3xl bg-white px-5 dark:divide-neutral-800 dark:bg-neutral-900">
            {recent.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 py-3.5">
                <div className="min-w-0">
                  <p className="truncate">{one(s.products)?.name ?? "Venta"}{Number(s.quantity) > 1 ? ` ×${Number(s.quantity).toLocaleString("es-AR")}` : ""}</p>
                  <p className="text-[13px] text-neutral-500 dark:text-neutral-400">{saleDay(s.sale_date)}{s.customer_name ? ` · ${s.customer_name}` : ""}</p>
                </div>
                <p className="shrink-0 font-display text-base font-bold">{pesos(Number(s.total))}</p>
              </div>
            ))}
            {recent.length === 0 && (
              <div className="py-5 text-sm text-neutral-500 dark:text-neutral-400">Todavía no cargaste ventas. <Link href="/ventas/nueva" className="font-semibold text-orange-800 underline dark:text-orange-300">Cargá la primera</Link> y acá vas a ver tu ganancia del mes.</div>
            )}
          </div>
        </section>

        <section aria-labelledby="por-terminarse" className="hidden lg:block">
          <div className="mb-2 flex items-baseline justify-between px-1">
            <h2 id="por-terminarse" className="text-lg">Por terminarse</h2>
            <Link href="/stock" className="text-sm font-semibold text-orange-800 dark:text-orange-300">Ver stock</Link>
          </div>
          <div className="divide-y divide-neutral-100 rounded-3xl bg-white px-5 dark:divide-neutral-800 dark:bg-neutral-900">
            {low.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 py-3.5">
                <div className="min-w-0"><p className="truncate">{r.name}</p><p className="text-[13px] text-neutral-500 dark:text-neutral-400">{amount(r.quantity, r.unit)}{r.minimum !== null ? ` (mínimo ${amount(r.minimum, r.unit)})` : ""}</p></div>
                <TriangleAlert size={18} aria-label="Stock bajo" className="shrink-0 text-amber-600" />
              </div>
            ))}
            {low.length === 0 && <p className="py-5 text-sm text-neutral-500 dark:text-neutral-400">Nada por terminarse. Poné un mínimo en cada material para que te avisemos.</p>}
          </div>
        </section>
      </div>

      <LegalLinks className="mt-8" />
    </AppShell>
  );
}
