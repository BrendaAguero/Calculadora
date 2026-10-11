import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { countActive, getAccessSnapshot, getResourceLimit, RESOURCE_LABELS, type Resource } from "@/lib/access/permissions";
import { cancelEntrepreneurRequest, requestEntrepreneur } from "./actions";

const labels: Record<string, string> = {
  YESO: "Yeso",
  RESINA: "Resina",
  JESMONITE: "Jesmonite",
  CEMENTO_DECORATIVO: "Cemento decorativo",
  CALCULO_INVERSO: "Cálculo inverso",
  ESCALADO_AVANZADO: "Escalado avanzado",
  MOLDES_AVANZADOS: "Moldes avanzados",
  STOCK_BASICO: "Stock básico",
  PROVEEDORES_BASICO: "Proveedores básico",
};

const RESOURCES: Resource[] = ["materials", "products", "formulas", "molds"];
const MONTHS = [1, 6, 12] as const;
const cardClass = "rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900";

type Quote = { ok: true; price: number; discount_pct: number; final_price: number; age_pct: number; recent_pct: number } | { ok: false; error: string };

const money = (value: number | string) => Number(value).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const date = (value: string) => new Date(value).toLocaleDateString("es-AR", { dateStyle: "long", timeZone: "America/Argentina/Buenos_Aires" });
const monthsLabel = (months: number) => (months === 1 ? "1 mes" : `${months} meses`);

export default async function AccessPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const snapshot = await getAccessSnapshot();
  if (!snapshot) redirect("/login");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [counts, { data: pending }, quotes] = await Promise.all([
    Promise.all(RESOURCES.map((resource) => countActive(supabase, user.id, resource))),
    supabase.from("subscriptions").select("id, duration_months, final_price, total_discount_percentage, created_at").eq("user_id", user.id).eq("status", "pending").maybeSingle(),
    snapshot.baseLicenseActive
      ? Promise.all(MONTHS.map(async (months) => (await supabase.rpc("quote_entrepreneur", { p_months: months })).data as Quote | null))
      : Promise.resolve([]),
  ]);

  const planLabel = snapshot.basePlan === "ADVANCED" ? "Avanzado" : snapshot.basePlan === "BASIC" ? "Básico" : "Sin licencia";

  return (
    <main className="min-h-screen bg-neutral-50 px-5 py-8 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <Link href="/mas" className="text-sm underline">← Volver</Link>
          <h1 className="mt-3 text-3xl font-semibold">Licencias y acceso</h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Los permisos se comprueban en el servidor. Tener una pantalla o botón visible no otorga acceso por sí mismo.
          </p>
        </div>

        {ok && <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">{ok}</div>}
        {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{error}</div>}

        <section className={cardClass}>
          <h2 className="font-semibold">Tu plan</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-neutral-500">Licencia base</span><p className="font-medium">{planLabel}</p></div>
            <div><span className="text-neutral-500">Emprendedor</span><p className="font-medium">{snapshot.entrepreneurActive ? `Activo hasta el ${date(snapshot.entrepreneurExpiresAt!)}` : "No activo"}</p></div>
          </div>
          {snapshot.isAdmin && (
            <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
              Sos administradora: tenés acceso completo. <Link href="/admin/emprendedor" className="underline">Ver pedidos de Emprendedor</Link>
            </p>
          )}
        </section>

        <section id="emprendedor" className={cardClass}>
          <h2 className="font-semibold">Emprendedor</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Mientras está activo habilita todas las funciones avanzadas y módulos, sin límite de altas. Al vencer volvés a tu plan {snapshot.basePlan ? planLabel : "base"} y no se borra nada.
          </p>

          {pending ? (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              <p>Pedido pendiente: <strong>{monthsLabel(pending.duration_months)}</strong> por {money(pending.final_price)}{Number(pending.total_discount_percentage) > 0 ? ` (con ${Number(pending.total_discount_percentage)} % de descuento)` : ""}, enviado el {date(pending.created_at)}.</p>
              <p className="mt-1">Por ahora la activación es manual: queda activo cuando la administradora confirme el pago.</p>
              <form action={cancelEntrepreneurRequest} className="mt-3">
                <input type="hidden" name="subscription_id" value={pending.id} />
                <button type="submit" className="rounded-xl border border-amber-400 px-4 py-2 font-medium dark:border-amber-700">Cancelar pedido</button>
              </form>
            </div>
          ) : !snapshot.baseLicenseActive ? (
            <p className="mt-4 text-sm text-neutral-500">Para pedir Emprendedor primero necesitás una licencia Básico o Avanzado.</p>
          ) : (
            <form action={requestEntrepreneur} className="mt-4 space-y-3">
              {snapshot.entrepreneurActive && <p className="text-sm text-neutral-600 dark:text-neutral-400">Si renovás ahora, el tiempo nuevo se suma al final del que ya tenés.</p>}
              <div className="grid gap-2 sm:grid-cols-3">
                {MONTHS.map((months, index) => {
                  const quote = quotes[index];
                  if (!quote?.ok) return <div key={months} className="rounded-xl border border-neutral-200 p-3 text-sm text-neutral-500 dark:border-neutral-800">{monthsLabel(months)}: {quote && !quote.ok ? quote.error : "no disponible"}</div>;
                  return (
                    <label key={months} className="flex cursor-pointer flex-col rounded-xl border border-neutral-300 p-3 text-sm has-[:checked]:border-violet-500 has-[:checked]:ring-2 has-[:checked]:ring-violet-500/30 dark:border-neutral-700">
                      <span className="flex items-center gap-2 font-medium"><input type="radio" name="months" value={months} defaultChecked={months === 1} required />{monthsLabel(months)}</span>
                      {Number(quote.discount_pct) > 0 && <span className="mt-1 text-neutral-500 line-through">{money(quote.price)}</span>}
                      <strong className="text-lg">{money(quote.final_price)}</strong>
                      {Number(quote.discount_pct) > 0 && <span className="text-emerald-700 dark:text-emerald-400">{Number(quote.discount_pct)} % de descuento</span>}
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-neutral-500">Descuentos: por antigüedad de tu licencia o por compra reciente de licencia. Si te corresponden los dos, se aplica el mayor.</p>
              <button type="submit" className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">Pedir Emprendedor</button>
            </form>
          )}
        </section>

        <section className={cardClass}>
          <h2 className="font-semibold">Actividades</h2>
          {snapshot.activities.length ? (
            <ul className="mt-3 space-y-2 text-sm">{snapshot.activities.map((code) => <li key={code}>✓ {labels[code] ?? code}</li>)}</ul>
          ) : <p className="mt-3 text-sm text-neutral-500">Todavía no hay actividades adquiridas.</p>}
        </section>

        <section className={cardClass}>
          <h2 className="font-semibold">Módulos</h2>
          {snapshot.modules.length ? (
            <ul className="mt-3 space-y-2 text-sm">{snapshot.modules.map((code) => <li key={code}>✓ {labels[code] ?? code}</li>)}</ul>
          ) : <p className="mt-3 text-sm text-neutral-500">No hay módulos permanentes adquiridos.</p>}
          {snapshot.entrepreneurActive && <p className="mt-3 text-sm text-violet-700 dark:text-violet-300">Emprendedor habilita temporalmente los módulos funcionales.</p>}
        </section>

        <section className={cardClass}>
          <h2 className="font-semibold">Límites del plan</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            {RESOURCES.map((resource, index) => {
              const limit = getResourceLimit(snapshot, resource);
              const used = counts[index];
              const label = RESOURCE_LABELS[resource];
              return (
                <div key={resource}>
                  <span className="capitalize text-neutral-500">{label}</span>
                  <p className="font-medium">{used.error ? "—" : used.count} {Number.isFinite(limit) ? `de ${limit}` : "· sin límite"}</p>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-neutral-500">Los archivados no cuentan. Cálculos e historial no tienen límite.</p>
        </section>
      </div>
    </main>
  );
}
