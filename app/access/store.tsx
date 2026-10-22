import Link from 'next/link';
import { SubmitButton } from '@/components/submit-button';
import type { AccessSnapshot } from '@/lib/access/permissions';
import { mercadoPagoReady } from '@/lib/mercadopago';
import { createClient } from '@/lib/supabase/server';
import { buyActivity, buyModule, cancelPurchase, payPurchase, releaseDevice } from './actions';
import { signOutEverywhere } from '../seguridad/actions';

const money = (value: number | string) => Number(value).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const cardClass = 'rounded-3xl bg-white p-5 dark:bg-neutral-900';
const dateTime = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { dateStyle: 'medium', timeZone: 'America/Argentina/Buenos_Aires' });

// Tienda: solo extras específicos (los necesita una parte de las usuarias). Recetas de color y Cuaderno vienen con la Edición Personal.
// Si aparece otro activo en la base sin estar listo, se muestra como «Próximamente».
const SELLABLE_MODULES = new Set(['EXTRA_DEVICE', 'PACK_VENTAS']);
const MODULE_HINTS: Record<string, string> = {
  EXTRA_DEVICE: 'Usá la app en un aparato más (podés comprar varios).',
  PACK_VENTAS: 'Solo si vendés: ventas, resumen de ganancias, stock, producción, compras y proveedores.',
};
const PURCHASE_LABELS: Record<string, string> = { license: 'Edición Personal', license_upgrade: 'Edición Personal', module: '' };

export async function PlanStore({ snapshot, userId }: { snapshot: AccessSnapshot; userId: string; referral?: string }) {
  const supabase = await createClient();
  const [{ data: modules }, { data: pending }, { data: devices }, { data: allowed }, { data: activities }, { data: owned }, { data: activityPrice }] = await Promise.all([
    supabase.from('modules').select('id,code,name,price').eq('active', true).order('price'),
    supabase.from('purchases').select('id,product_type,product_id,total,created_at').eq('user_id', userId).eq('payment_status', 'pending').in('product_type', ['module', 'activity']).order('created_at', { ascending: false }),
    supabase.from('user_devices').select('id,label,created_at,last_seen_at,last_city').eq('user_id', userId).is('released_at', null).order('created_at'),
    supabase.rpc('allowed_devices', { p_user_id: userId }),
    supabase.from('activities').select('id,code,name').eq('active', true).order('sort_order'),
    supabase.from('user_activities').select('activity_id,is_primary').eq('user_id', userId).eq('status', 'active'),
    supabase.rpc('my_activity_price'),
  ]);
  const nameOf = (purchase: { product_type: string; product_id: string }) => modules?.find((m) => m.id === purchase.product_id)?.name ?? activities?.find((a) => a.id === purchase.product_id)?.name ?? PURCHASE_LABELS[purchase.product_type] ?? '';
  const online = mercadoPagoReady();
  // Durante la prueba gratis la tienda se muestra como para cualquier cuenta: lo que compre le queda al terminar.
  const paidPlus = snapshot.entrepreneurActive && !snapshot.plusTrialEndsAt;
  // Comparación para la Edición Personal: todos los extras sueltos frente a un año de Personal Plus.
  const plusQuote = snapshot.baseLicenseActive && !paidPlus
    ? ((await supabase.rpc('quote_entrepreneur', { p_months: 12 })).data as { ok: boolean; final_price: number; discount_pct: number } | null)
    : null;
  const plusAnnual = plusQuote?.ok ? plusQuote : null;
  const missingActivities = (activities ?? []).filter((a) => !owned?.some((o) => o.activity_id === a.id)).length;
  const extrasTotal = (modules ?? []).filter((m) => m.code !== 'EXTRA_DEVICE' && SELLABLE_MODULES.has(m.code) && !snapshot.modules.includes(m.code)).reduce((acc, m) => acc + Number(m.price), 0)
    + missingActivities * Number(activityPrice ?? 0);

  if (!snapshot.baseLicenseActive && !paidPlus && !snapshot.isAdmin && !snapshot.isTester) {
    return (
      <section id="planes" className={cardClass}>
        <h2 className="font-semibold">Elegí cómo pagar</h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Estás usando la versión gratis. Para tener todo el taller, elegí <strong>una</strong> de las dos formas (no hace falta tener las dos):</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
            <p className="font-semibold">Edición Personal</p>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Pagás <strong>una sola vez</strong> y es tuya: calculadora, materiales, fórmulas, moldes, productos, Recetas de color y Cuaderno de pruebas, en 2 aparatos, con sus actualizaciones. Si vendés, después sumás el Pack Ventas y Stock.</p>
            <Link href="/comprar" className="mt-3 inline-block rounded-xl bg-orange-700 px-4 py-2 text-sm font-semibold text-white">Comprar</Link>
          </div>
          <div className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
            <p className="font-semibold">Personal Plus</p>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Pagás <strong>por mes o por año</strong> y tenés todo incluido mientras esté activo: todas las actividades, el Pack Ventas y Stock, sin límites ni publicidad, y las funciones nuevas. El mensual lo cancelás cuando quieras.</p>
            <Link href="#emprendedor" className="mt-3 inline-block rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold dark:border-neutral-700">Ver Personal Plus</Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section id="planes" className={cardClass}>
        <h2 className="font-semibold">Tienda (pago único)</h2>
        <p className="mt-1 text-xs text-neutral-500">{paidPlus ? 'Con Personal Plus ya tenés todo incluido; solo podés sumar aparatos.' : 'Extras opcionales para tu Edición Personal: comprá solo lo que necesites, una sola vez.'}</p>

        {(pending ?? []).length > 0 && (
          <div className="mt-4 space-y-2">
            {pending!.map((purchase) => (
              <div key={purchase.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                <span>Pedido pendiente: <strong>{nameOf(purchase)}</strong> por {money(purchase.total)}</span>
                <span className="flex gap-2">
                  {online && <form action={payPurchase}><input type="hidden" name="purchase_id" value={purchase.id} /><input type="hidden" name="name" value={nameOf(purchase)} /><SubmitButton className="rounded-lg bg-sky-600 px-3 py-1.5 font-medium text-white">Pagar</SubmitButton></form>}
                  <form action={cancelPurchase}><input type="hidden" name="purchase_id" value={purchase.id} /><SubmitButton className="rounded-lg border border-amber-400 px-3 py-1.5 dark:border-amber-700">Cancelar</SubmitButton></form>
                </span>
              </div>
            ))}
          </div>
        )}

        <ul className="mt-3 divide-y divide-neutral-100 text-sm dark:divide-neutral-800">
          {(modules ?? []).map((module) => {
            const owned = module.code !== 'EXTRA_DEVICE' && (snapshot.modules.includes(module.code) || paidPlus);
            const sellable = SELLABLE_MODULES.has(module.code);
            return (
              <li key={module.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span><strong>{module.name}</strong> · {money(module.price)}<span className="block text-xs text-neutral-500">{MODULE_HINTS[module.code]}</span></span>
                {owned ? <span className="text-emerald-700 dark:text-emerald-400">✓ Lo tenés</span>
                  : !sellable ? <span className="text-xs text-neutral-500">Próximamente</span>
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
        {plusAnnual && extrasTotal > 0 && (
          <p className="mt-3 rounded-xl bg-violet-50 px-3 py-2 text-sm text-violet-900 dark:bg-violet-950/40 dark:text-violet-100">
            ¿Vas a querer varios? Sumar todos los extras y actividades sueltos sale unos <strong>{money(extrasTotal)}</strong>. <strong>Personal Plus por año</strong> sale {money(plusAnnual.final_price)}{Number(plusAnnual.discount_pct) > 0 ? ` con tu ${Number(plusAnnual.discount_pct)} % de descuento por antigüedad` : ''} e incluye todo eso, sin límites y con las funciones nuevas. <Link href="#emprendedor" className="font-semibold underline">Ver Personal Plus</Link>
          </p>
        )}
      </section>

      <section id="actividades" className={cardClass}>
        <h2 className="font-semibold">Actividades</h2>
        <p className="mt-1 text-xs text-neutral-500">{paidPlus ? 'Con Personal Plus tenés todas las actividades.' : 'Tu actividad principal viene incluida. La segunda sale siempre a mitad de precio; las siguientes, precio normal. Se compran una vez y quedan para siempre.'}</p>
        <ul className="mt-3 divide-y divide-neutral-100 text-sm dark:divide-neutral-800">
          {(activities ?? []).map((activity) => {
            const mine = owned?.find((o) => o.activity_id === activity.id);
            return (
              <li key={activity.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span><strong>{activity.name}</strong>{mine?.is_primary && <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-800 dark:bg-orange-950 dark:text-orange-300">Principal</span>}</span>
                {mine ? <span className="text-emerald-700 dark:text-emerald-400">✓ La tenés</span>
                  : paidPlus ? <span className="text-xs text-neutral-500">Incluida con Plus</span>
                  : !owned?.length ? <Link href="/bienvenida" className="text-xs font-semibold underline">Elegí tu actividad principal</Link>
                  : (
                    <form action={buyActivity} className="flex items-center gap-3">
                      <input type="hidden" name="activity" value={activity.code} />
                      <input type="hidden" name="name" value={activity.name} />
                      {activityPrice != null && <span>{money(activityPrice)}</span>}
                      <SubmitButton className="rounded-lg border border-neutral-300 px-3 py-1.5 font-medium dark:border-neutral-700">Comprar</SubmitButton>
                    </form>
                  )}
              </li>
            );
          })}
        </ul>
      </section>

      <section id="aparatos" className={cardClass}>
        <h2 className="font-semibold">Mis aparatos</h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Usás {devices?.length ?? 0} de {Number(allowed ?? 2)}. Si cambiaste de celular o computadora, liberá el que ya no usás.</p>
        <ul className="mt-3 divide-y divide-neutral-100 text-sm dark:divide-neutral-800">
          {(devices ?? []).map((device) => (
            <li key={device.id} className="flex items-center justify-between gap-2 py-2">
              <span>{device.label ?? 'Aparato'}<span className="block text-xs text-neutral-500">Desde {dateTime(device.created_at)} · último uso {dateTime(device.last_seen_at)}{device.last_city ? ` · cerca de ${device.last_city}` : ''}</span></span>
              <form action={releaseDevice}><input type="hidden" name="device_id" value={device.id} /><SubmitButton className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs dark:border-neutral-700">Liberar</SubmitButton></form>
            </li>
          ))}
          {!devices?.length && <li className="py-2 text-neutral-500">Todavía no hay aparatos registrados.</li>}
        </ul>
        <form action={signOutEverywhere} className="mt-3"><SubmitButton className="text-xs text-red-700 underline dark:text-red-300">Cerrar sesión en todos mis aparatos</SubmitButton></form>
      </section>
    </>
  );
}
