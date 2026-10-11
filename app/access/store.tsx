import Link from 'next/link';
import { SubmitButton } from '@/components/submit-button';
import type { AccessSnapshot } from '@/lib/access/permissions';
import { mercadoPagoReady } from '@/lib/mercadopago';
import { createClient } from '@/lib/supabase/server';
import { buyModule, cancelPurchase, payPurchase, releaseDevice } from './actions';
import { signOutEverywhere } from '../seguridad/actions';

const money = (value: number | string) => Number(value).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const cardClass = 'rounded-3xl bg-white p-5 dark:bg-neutral-900';
const dateTime = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { dateStyle: 'medium', timeZone: 'America/Argentina/Buenos_Aires' });

// Extras que ya funcionan; el resto se muestra como «Próximamente» (con Plus se incluyen al estar listos).
const SELLABLE_MODULES = new Set(['EXTRA_DEVICE']);
const MODULE_HINTS: Record<string, string> = {
  EXTRA_DEVICE: 'Usá la app en un aparato más (podés comprar varios).',
  CALCULO_INVERSO: 'Partir del precio de venta para saber cuánto podés gastar.',
  ESCALADO_AVANZADO: 'Escalar fórmulas con más opciones.',
  MOLDES_AVANZADOS: 'Más datos y cálculos para tus moldes.',
};
// Stock y Proveedores ya vienen en la Edición Personal: no se venden aparte.
const INCLUDED_MODULES = new Set(['STOCK_BASICO', 'PROVEEDORES_BASICO']);
const PURCHASE_LABELS: Record<string, string> = { license: 'Edición Personal', license_upgrade: 'Edición Personal', module: '' };

export async function PlanStore({ snapshot, userId }: { snapshot: AccessSnapshot; userId: string; referral?: string }) {
  const supabase = await createClient();
  const [{ data: modules }, { data: pending }, { data: devices }, { data: allowed }] = await Promise.all([
    supabase.from('modules').select('id,code,name,price').eq('active', true).order('price'),
    supabase.from('purchases').select('id,product_type,product_id,total,created_at').eq('user_id', userId).eq('payment_status', 'pending').in('product_type', ['module']).order('created_at', { ascending: false }),
    supabase.from('user_devices').select('id,label,created_at,last_seen_at,last_city').eq('user_id', userId).is('released_at', null).order('created_at'),
    supabase.rpc('allowed_devices', { p_user_id: userId }),
  ]);
  const nameOf = (purchase: { product_type: string; product_id: string }) => modules?.find((m) => m.id === purchase.product_id)?.name ?? PURCHASE_LABELS[purchase.product_type] ?? '';
  const online = mercadoPagoReady();

  if (!snapshot.baseLicenseActive && !snapshot.isAdmin && !snapshot.isTester) {
    return (
      <section id="planes" className={cardClass}>
        <h2 className="font-semibold">Edición Personal</h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Esta cuenta todavía no tiene la Edición Personal. Pagás una sola vez y la usás en 2 aparatos.</p>
        <Link href="/comprar" className="mt-3 inline-block rounded-xl bg-orange-700 px-4 py-2 text-sm font-semibold text-white">Comprar la Edición Personal</Link>
      </section>
    );
  }

  return (
    <>
      <section id="planes" className={cardClass}>
        <h2 className="font-semibold">Extras (pago único)</h2>
        <p className="mt-1 text-xs text-neutral-500">Se suman a tu Edición Personal. Con Mensualidad Plus tenés todos los módulos incluidos.</p>

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
          {(modules ?? []).filter((m) => !INCLUDED_MODULES.has(m.code)).map((module) => {
            const owned = module.code !== 'EXTRA_DEVICE' && (snapshot.modules.includes(module.code) || snapshot.entrepreneurActive);
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
