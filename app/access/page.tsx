import Link from "next/link";
import { SubmitButton } from '@/components/submit-button';
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { countActive, getAccessSnapshot, getResourceLimit, RESOURCE_LABELS, type Resource } from "@/lib/access/permissions";
import { cancelEntrepreneurAutoRenew, cancelEntrepreneurRequest, payEntrepreneurRequest, requestEntrepreneur, requestEntrepreneurUpgrade } from "./actions";
import { mercadoPagoReady, syncUserPreapprovals } from "@/lib/mercadopago";

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
type UpgradeQuote = { ok: true; months: number; from_months: number; credit: number; final_price: number; upgrade_price: number } | { ok: false; error: string };

const money = (value: number | string) => Number(value).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const date = (value: string) => new Date(value).toLocaleDateString("es-AR", { dateStyle: "long", timeZone: "America/Argentina/Buenos_Aires" });
const monthsLabel = (months: number) => (months === 1 ? "1 mes" : `${months} meses`);

// Mercado Pago pide, para la suscripción mensual, el email de la cuenta de Mercado Pago con la que se va a pagar.
function MercadoPagoEmail({ defaultValue }: { defaultValue: string }) {
  return (
    <label className="grid max-w-xs gap-1 text-xs text-neutral-500 dark:text-neutral-400">Email de tu cuenta de Mercado Pago (solo para la suscripción mensual)
      <input name="mp_email" type="email" defaultValue={defaultValue} maxLength={200} autoComplete="email" className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white" />
    </label>
  );
}

export default async function AccessPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; confirmar?: string }> }) {
  const { ok, error, confirmar } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Suscripción mensual: confirma cobros que no hayan llegado por aviso y cancela en Mercado Pago lo que ya no se renueva.
  if (mercadoPagoReady()) await syncUserPreapprovals(user.id).catch(() => null);

  const snapshot = await getAccessSnapshot();
  if (!snapshot) redirect("/login");

  const [counts, { data: pending }, { data: monthly }, quotes, upgradeQuotes] = await Promise.all([
    Promise.all(RESOURCES.map((resource) => countActive(supabase, user.id, resource))),
    supabase.from("subscriptions").select("id, duration_months, auto_renew, final_price, total_discount_percentage, upgrade_credit, created_at, external_preapproval_id, preapproval_status").eq("user_id", user.id).eq("status", "pending").maybeSingle(),
    // Suscripción mensual vigente (la más nueva), con o sin renovación.
    supabase.from("subscriptions").select("id, auto_renew, auto_renew_canceled_at, expires_at, final_price, external_preapproval_id").eq("user_id", user.id).eq("status", "active").eq("duration_months", 1).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    snapshot.baseLicenseActive
      ? Promise.all(MONTHS.map(async (months) => (await supabase.rpc("quote_entrepreneur", { p_months: months })).data as Quote | null))
      : Promise.resolve([]),
    // Actualizar a un plan más largo (solo con un único plan activo y pagado; la base lo comprueba).
    snapshot.entrepreneurActive
      ? Promise.all(([6, 12] as const).map(async (months) => (await supabase.rpc("quote_entrepreneur_upgrade", { p_months: months })).data as UpgradeQuote | null))
      : Promise.resolve([]),
  ]);
  const upgrades = upgradeQuotes.flatMap((quote) => (quote?.ok ? [quote] : []));
  const confirmMonths = Number(confirmar);
  const confirming = snapshot.entrepreneurActive && !pending && [6, 12].includes(confirmMonths) ? confirmMonths : null;
  const addMonths = (iso: string, months: number) => { const d = new Date(iso); d.setMonth(d.getMonth() + months); return d.toISOString(); };

  const monthlyQuote = quotes[0]?.ok ? quotes[0] : null;
  const hasMonthly = Boolean(monthly?.auto_renew);
  const referral = (await cookies()).get("ref")?.value ?? "";
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
          {snapshot.isTester && <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">Cuenta de prueba: sin límites ni restricciones de plan.</p>}
          {snapshot.isAdmin && (
            <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
              Sos administradora: tenés acceso completo. <Link href="/admin" className="underline">Ir a la administración</Link>
            </p>
          )}
        </section>

        <section id="emprendedor" className={cardClass}>
          <h2 className="font-semibold">Emprendedor</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Mientras está activo habilita todas las funciones avanzadas y módulos, sin límite de altas. Al vencer volvés a tu plan {snapshot.basePlan ? planLabel : "base"} y no se borra nada.
          </p>

          {(monthly?.auto_renew || monthly?.auto_renew_canceled_at) && (
            <div className="mt-4 rounded-xl border border-violet-300 bg-violet-50 p-4 text-sm text-violet-900 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-100">
              {monthly.auto_renew ? (
                <>
                  <p>Tenés la <strong>suscripción mensual</strong>: se renueva cada mes. Podés cancelar la renovación cuando quieras; Emprendedor sigue activo hasta que venza.</p>
                  <p className="mt-1 text-xs">{monthly.external_preapproval_id ? `Mercado Pago te cobra ${money(monthly.final_price)} por mes. La próxima renovación es el ${date(monthly.expires_at)}.` : "Esta suscripción no tiene cobro automático: para renovarla, pedí Emprendedor de nuevo cuando venza."}</p>
                  <form action={cancelEntrepreneurAutoRenew} className="mt-3">
                    <input type="hidden" name="subscription_id" value={monthly.id} />
                    <SubmitButton className="rounded-xl border border-violet-400 px-4 py-2 font-medium dark:border-violet-700">Cancelar renovación</SubmitButton>
                  </form>
                </>
              ) : (
                <p>Cancelaste la renovación de la suscripción mensual. Emprendedor sigue activo hasta el {date(snapshot.entrepreneurExpiresAt ?? monthly.expires_at)}.</p>
              )}
            </div>
          )}

          {confirming && (
            <div role="dialog" aria-labelledby="confirmar-titulo" className="mt-4 rounded-xl border-2 border-violet-400 bg-white p-4 text-sm dark:border-violet-700 dark:bg-neutral-900">
              <p id="confirmar-titulo" className="font-semibold">¿Seguro querés comprar {monthsLabel(confirming)} más?</p>
              <p className="mt-1 text-neutral-600 dark:text-neutral-400">Se suman al final: te quedaría Emprendedor hasta el {date(addMonths(snapshot.entrepreneurExpiresAt!, confirming))}.</p>
              {upgrades.filter((upgrade) => upgrade.months >= confirming).map((upgrade) => (
                <p key={upgrade.months} className="mt-2 text-violet-800 dark:text-violet-200">Por <strong>{money(upgrade.upgrade_price)}</strong> podés actualizar a {monthsLabel(upgrade.months)} desde hoy (te descontamos {money(upgrade.credit)} por lo que te queda de tu plan actual).</p>
              ))}
              <div className="mt-3 flex flex-wrap gap-2">
                {upgrades.filter((upgrade) => upgrade.months >= confirming).map((upgrade) => (
                  <form key={upgrade.months} action={requestEntrepreneurUpgrade}>
                    <input type="hidden" name="months" value={upgrade.months} />
                    <SubmitButton className="rounded-xl bg-violet-700 px-4 py-2 font-medium text-white">Actualizar a {monthsLabel(upgrade.months)} por {money(upgrade.upgrade_price)}</SubmitButton>
                  </form>
                ))}
                <form action={requestEntrepreneur}>
                  <input type="hidden" name="months" value={confirming} />
                  <input type="hidden" name="confirmed" value="1" />
                  <SubmitButton className="rounded-xl border border-neutral-300 px-4 py-2 font-medium dark:border-neutral-700">Sí, sumar {monthsLabel(confirming)}</SubmitButton>
                </form>
                <Link href="/access#emprendedor" className="rounded-xl px-4 py-2 text-neutral-600 underline dark:text-neutral-400">Cancelar</Link>
              </div>
            </div>
          )}

          {!pending && !confirming && upgrades.length > 0 && (
            <div className="mt-4 rounded-xl border border-violet-300 p-4 text-sm dark:border-violet-900">
              <p className="font-medium">Actualizá tu plan</p>
              <p className="mt-1 text-neutral-600 dark:text-neutral-400">Pasás a un plan más largo desde hoy y te descontamos lo que te queda sin usar del actual. Cuanto antes actualices, más se descuenta.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {upgrades.map((upgrade) => (
                  <form key={upgrade.months} action={requestEntrepreneurUpgrade}>
                    <input type="hidden" name="months" value={upgrade.months} />
                    <SubmitButton className="rounded-xl bg-violet-700 px-4 py-2 font-medium text-white">{monthsLabel(upgrade.months)} por {money(upgrade.upgrade_price)}</SubmitButton>
                  </form>
                ))}
              </div>
              <p className="mt-2 text-xs text-neutral-500">Descuento por lo que te queda: {money(upgrades[0].credit)}.</p>
            </div>
          )}

          {pending ? (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              <p>Pedido pendiente: <strong>{pending.upgrade_credit != null ? `actualización a ${monthsLabel(pending.duration_months)}` : pending.duration_months === 1 ? "suscripción mensual" : monthsLabel(pending.duration_months)}</strong> por {money(pending.final_price)}{pending.upgrade_credit != null ? ` (con ${money(pending.upgrade_credit)} descontados por tu plan actual)` : Number(pending.total_discount_percentage) > 0 ? ` (con ${Number(pending.total_discount_percentage)} % de descuento)` : ""}, enviado el {date(pending.created_at)}.</p>
              <p className="mt-1">{!mercadoPagoReady() ? 'Por ahora la activación es manual: queda activo cuando la administradora confirme el pago.'
                : pending.preapproval_status === 'authorized' ? 'Ya autorizaste la suscripción en Mercado Pago. Emprendedor se activa solo apenas se acredite el primer cobro (suele tardar unos minutos).'
                : pending.duration_months === 1 && pending.auto_renew ? 'Autorizá la suscripción en Mercado Pago: se cobra ahora y después una vez por mes, hasta que la canceles.'
                : 'Pagalo con Mercado Pago y se activa en el momento.'}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {mercadoPagoReady() && pending.preapproval_status !== 'authorized' && (
                  <form action={payEntrepreneurRequest} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="subscription_id" value={pending.id} />
                    {pending.duration_months === 1 && pending.auto_renew && !pending.external_preapproval_id && <MercadoPagoEmail defaultValue={user.email ?? ""} />}
                    <SubmitButton className="rounded-xl bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-700">Pagar con Mercado Pago</SubmitButton>
                  </form>
                )}
                <form action={cancelEntrepreneurRequest}>
                  <input type="hidden" name="subscription_id" value={pending.id} />
                  <SubmitButton className="rounded-xl border border-amber-400 px-4 py-2 font-medium dark:border-amber-700">Cancelar pedido</SubmitButton>
                </form>
              </div>
            </div>
          ) : !snapshot.baseLicenseActive ? (
            <p className="mt-4 text-sm text-neutral-500">Para pedir Emprendedor primero necesitás una licencia Básico o Avanzado.</p>
          ) : confirming ? null : (
            <form action={requestEntrepreneur} className="mt-4 space-y-3">
              {snapshot.entrepreneurActive && <p className="text-sm text-neutral-600 dark:text-neutral-400">Si pedís 6 o 12 meses, se suman al final del que ya tenés.{hasMonthly ? " Al activarse, la suscripción mensual deja de renovarse sola para que no pagues dos veces." : ""}</p>}
              <div className="grid gap-2 sm:grid-cols-3">
                {MONTHS.map((months, index) => {
                  const quote = quotes[index];
                  const title = months === 1 ? "Suscripción mensual" : monthsLabel(months);
                  // La suscripción mensual no se suma: se contrata cuando no hay Emprendedor vigente.
                  const monthlyBlocked = months === 1 && snapshot.entrepreneurActive;
                  if (!quote?.ok || monthlyBlocked) return <div key={months} className="rounded-xl border border-neutral-200 p-3 text-sm text-neutral-500 dark:border-neutral-800">{title}: {monthlyBlocked ? (hasMonthly ? "ya la tenés" : `disponible cuando venza tu plan actual (${date(snapshot.entrepreneurExpiresAt!)})`) : quote && !quote.ok ? quote.error : "no disponible"}</div>;
                  // Comparación con pagar mes a mes: los plazos largos salen más baratos.
                  const perMonth = Number(quote.final_price) / months;
                  const savings = monthlyQuote && months > 1 ? Number(monthlyQuote.final_price) * months - Number(quote.final_price) : 0;
                  return (
                    <label key={months} className="flex cursor-pointer flex-col rounded-xl border border-neutral-300 p-3 text-sm has-[:checked]:border-violet-500 has-[:checked]:ring-2 has-[:checked]:ring-violet-500/30 dark:border-neutral-700">
                      <span className="flex items-center gap-2 font-medium"><input type="radio" name="months" value={months} defaultChecked={months === (snapshot.entrepreneurActive ? 6 : 1)} required />{title}</span>
                      {Number(quote.discount_pct) > 0 && <span className="mt-1 text-neutral-500 line-through">{money(quote.price)}</span>}
                      <strong className="text-lg">{money(quote.final_price)}</strong>
                      {Number(quote.discount_pct) > 0 && <span className="text-emerald-700 dark:text-emerald-400">{Number(quote.discount_pct)} % de descuento</span>}
                      {months === 1
                        ? <span className="mt-1 text-xs text-neutral-500">Se renueva cada mes. Cancelás cuando quieras.</span>
                        : <span className="mt-1 text-xs text-neutral-500">{money(perMonth)} por mes{savings > 0 ? ` · ahorrás ${money(savings)} frente a ${months} mensualidades` : ""}</span>}
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-neutral-500">Descuentos: por antigüedad de tu licencia o por compra reciente de licencia. Si te corresponden los dos, se aplica el mayor.</p>
              <label className="grid max-w-xs gap-1 text-xs text-neutral-500 dark:text-neutral-400">Código de afiliada (opcional)
                <input name="affiliate_code" defaultValue={referral} maxLength={20} autoCapitalize="characters" placeholder="Ej.: LUCIA1234" className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm uppercase text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white" />
              </label>
              {mercadoPagoReady() && !snapshot.entrepreneurActive && <MercadoPagoEmail defaultValue={user.email ?? ""} />}
              <SubmitButton className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">{mercadoPagoReady() ? 'Continuar al pago' : 'Pedir Emprendedor'}</SubmitButton>
              {mercadoPagoReady() && <p className="text-xs text-neutral-500">Vas a pagar en Mercado Pago. Al aprobarse el pago, Emprendedor se activa solo. La suscripción mensual se cobra sola cada mes hasta que la canceles.</p>}
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
