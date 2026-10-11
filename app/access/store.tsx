import { SubmitButton } from '@/components/submit-button';
import type { AccessSnapshot } from '@/lib/access/permissions';
import { mercadoPagoReady } from '@/lib/mercadopago';
import { createClient } from '@/lib/supabase/server';
import { buyLicense, buyModule, cancelPurchase, payPurchase, upgradeLicense } from './actions';

const money = (value: number | string) => Number(value).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const cardClass = 'rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900';
const buyButton = 'rounded-xl bg-orange-700 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-800';
const affiliateInput = 'rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm uppercase text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white';

// Qué incluye cada plan (lo que se vende tiene que coincidir con lo que la app hace).
const PLANS = [
  { code: 'FREE', name: 'Gratis', features: ['Calculadora de Yeso (modos Fácil y Estándar)', '5 materiales, 2 productos, 1 fórmula y 1 molde', 'Historial de cálculos', 'Con publicidad'] },
  { code: 'BASIC', name: 'Básico', features: ['Calculadora completa (incluye Personalizado)', '30 materiales, 10 productos, 5 fórmulas y 5 moldes', 'Sin publicidad', 'Pago único: es tuyo para siempre'] },
  { code: 'ADVANCED', name: 'Avanzado', features: ['Todo lo de Básico', '100 materiales, 50 productos, 30 fórmulas y 30 moldes', 'Sin publicidad', 'Pago único: es tuyo para siempre'] },
] as const;

// Módulos que ya funcionan; el resto se muestra como «Próximamente».
const SELLABLE_MODULES = new Set(['STOCK_BASICO', 'PROVEEDORES_BASICO']);
const MODULE_HINTS: Record<string, string> = {
  STOCK_BASICO: 'Stock de materias primas y productos, con mínimos y alertas.',
  PROVEEDORES_BASICO: 'Proveedores, compras y comparación de precios.',
  CALCULO_INVERSO: 'Partir del precio de venta para saber cuánto podés gastar.',
  ESCALADO_AVANZADO: 'Escalar fórmulas con más opciones.',
  MOLDES_AVANZADOS: 'Más datos y cálculos para tus moldes.',
};
const PURCHASE_LABELS: Record<string, string> = { license: 'Licencia', license_upgrade: 'Pase a Avanzado', module: 'Módulo' };

type UpgradeQuote = { ok: true; price: number; next_change_days: number | null } | { ok: false; error: string };

export async function PlanStore({ snapshot, userId, referral }: { snapshot: AccessSnapshot; userId: string; referral: string }) {
  const supabase = await createClient();
  const [{ data: plans }, { data: modules }, { data: pending }, upgrade] = await Promise.all([
    supabase.from('plans').select('id,code,price').in('code', ['BASIC', 'ADVANCED']),
    supabase.from('modules').select('id,code,name,price').eq('active', true).order('price'),
    supabase.from('purchases').select('id,product_type,product_id,total,created_at').eq('user_id', userId).eq('payment_status', 'pending').in('product_type', ['license', 'license_upgrade', 'module']).order('created_at', { ascending: false }),
    snapshot.basePlan === 'BASIC' ? supabase.rpc('quote_license_upgrade').then((r) => r.data as UpgradeQuote | null) : Promise.resolve(null),
  ]);
  const price = (code: string) => plans?.find((p) => p.code === code)?.price;
  const nameOf = (purchase: { product_type: string; product_id: string }) =>
    plans?.find((p) => p.id === purchase.product_id)?.code === 'ADVANCED' ? 'Avanzado'
      : plans?.find((p) => p.id === purchase.product_id) ? 'Básico'
      : modules?.find((m) => m.id === purchase.product_id)?.name ?? '';
  const current = snapshot.basePlan ?? (snapshot.isFree ? 'FREE' : null);
  const online = mercadoPagoReady();

  return (
    <section id="planes" className={cardClass}>
      <h2 className="font-semibold">Planes</h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Básico y Avanzado se pagan una sola vez. Si querés todo sin límites por un tiempo, sumá Emprendedor.</p>

      {(pending ?? []).length > 0 && (
        <div className="mt-4 space-y-2">
          {pending!.map((purchase) => (
            <div key={purchase.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              <span>Pedido pendiente: <strong>{PURCHASE_LABELS[purchase.product_type]} {nameOf(purchase)}</strong> por {money(purchase.total)}</span>
              <span className="flex gap-2">
                {online && <form action={payPurchase}><input type="hidden" name="purchase_id" value={purchase.id} /><input type="hidden" name="name" value={nameOf(purchase)} /><SubmitButton className="rounded-lg bg-sky-600 px-3 py-1.5 font-medium text-white">Pagar</SubmitButton></form>}
                <form action={cancelPurchase}><input type="hidden" name="purchase_id" value={purchase.id} /><SubmitButton className="rounded-lg border border-amber-400 px-3 py-1.5 dark:border-amber-700">Cancelar</SubmitButton></form>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = current === plan.code;
          const planPrice = plan.code === 'FREE' ? 0 : price(plan.code);
          return (
            <div key={plan.code} className={`flex flex-col rounded-xl border p-4 text-sm ${isCurrent ? 'border-orange-500 ring-2 ring-orange-500/30' : 'border-neutral-200 dark:border-neutral-800'}`}>
              <p className="font-semibold">{plan.name}{isCurrent && <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-800 dark:bg-orange-950 dark:text-orange-200">Tu plan</span>}</p>
              <p className="mt-1 text-lg font-bold">{planPrice === 0 ? 'Gratis' : planPrice != null ? money(planPrice) : '—'}</p>
              <ul className="mt-2 flex-1 space-y-1 text-neutral-600 dark:text-neutral-300">{plan.features.map((f) => <li key={f}>✓ {f}</li>)}</ul>
              {snapshot.isFree && plan.code !== 'FREE' && (
                <form action={buyLicense} className="mt-3">
                  <input type="hidden" name="plan" value={plan.code} />
                  <input type="hidden" name="affiliate_code" value={referral} />
                  <SubmitButton className={`${buyButton} w-full`}>Comprar {plan.name}</SubmitButton>
                </form>
              )}
            </div>
          );
        })}
      </div>

      {snapshot.basePlan === 'BASIC' && upgrade && (
        <div className="mt-4 rounded-xl border border-violet-300 bg-violet-50 p-4 text-sm text-violet-900 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-100">
          {upgrade.ok ? (
            <>
              <p>Pasate a <strong>Avanzado</strong> por <strong>{money(upgrade.price)}</strong>{upgrade.next_change_days ? ` (este precio vale ${upgrade.next_change_days} día${upgrade.next_change_days === 1 ? '' : 's'} más; después sube)` : ''}.</p>
              <form action={upgradeLicense} className="mt-3 flex flex-wrap items-end gap-2">
                <label className="grid gap-1 text-xs">Código de afiliada (opcional)<input name="affiliate_code" defaultValue={referral} maxLength={20} className={affiliateInput} /></label>
                <SubmitButton className={buyButton}>Pasarme a Avanzado</SubmitButton>
              </form>
            </>
          ) : <p>{upgrade.error}</p>}
        </div>
      )}

      {snapshot.isFree && (
        <label className="mt-3 grid max-w-xs gap-1 text-xs text-neutral-500 dark:text-neutral-400">Si te recomendó una afiliada, su código se aplica solo{referral ? `: ${referral}` : ''}.</label>
      )}

      <h3 className="mt-6 font-semibold">Módulos (pago único)</h3>
      <p className="mt-1 text-xs text-neutral-500">Se suman a Básico o Avanzado. Con Emprendedor activo ya los tenés incluidos.</p>
      <ul className="mt-3 divide-y divide-neutral-100 text-sm dark:divide-neutral-800">
        {(modules ?? []).map((module) => {
          const owned = snapshot.modules.includes(module.code);
          const sellable = SELLABLE_MODULES.has(module.code);
          return (
            <li key={module.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <span><strong>{module.name}</strong> · {money(module.price)}<span className="block text-xs text-neutral-500">{MODULE_HINTS[module.code]}</span></span>
              {owned ? <span className="text-emerald-700 dark:text-emerald-400">✓ Lo tenés</span>
                : !sellable ? <span className="text-xs text-neutral-500">Próximamente</span>
                : !snapshot.baseLicenseActive ? <span className="text-xs text-neutral-500">Necesita Básico o Avanzado</span>
                : (
                  <form action={buyModule}>
                    <input type="hidden" name="module" value={module.code} />
                    <input type="hidden" name="name" value={module.name} />
                    <SubmitButton className="rounded-lg border border-neutral-300 px-3 py-1.5 font-medium dark:border-neutral-700">Comprar</SubmitButton>
                  </form>
                )}
            </li>
          );
        })}
      </ul>
      {online && <p className="mt-2 text-xs text-neutral-500">Pagás en Mercado Pago y se activa apenas se aprueba el pago. Tenés 10 días para arrepentirte.</p>}
    </section>
  );
}
