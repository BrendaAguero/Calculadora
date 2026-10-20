import Link from 'next/link';
import { SubmitButton } from '@/components/submit-button';
import { requireAdmin } from '@/lib/admin';
import { cardClass, errorBox, inputClass, labelClass, okBox, pageClass, primaryButton } from '@/lib/ui';
import { setActivityPrices, setPackPrices, setPlusAnnualPrice, setPrices, setRegularPrice } from '../actions';

export default async function AdminPricesPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const { supabase } = await requireAdmin();
  const [{ data: config }, { data: monthly }, { data: device }, { data: pack }, { data: annual }] = await Promise.all([
    supabase.from('pricing_config').select('key,value_numeric').in('key', ['personal_price_online', 'personal_price_transfer', 'personal_price_mercadolibre', 'activity_price_secondary', 'activity_price_extra', 'pack_ventas_with_personal', 'personal_price_regular']),
    supabase.from('subscription_plans_catalog').select('price').eq('duration_months', 1).maybeSingle(),
    supabase.from('modules').select('price').eq('code', 'EXTRA_DEVICE').maybeSingle(),
    supabase.from('modules').select('price').eq('code', 'PACK_VENTAS').maybeSingle(),
    supabase.from('subscription_plans_catalog').select('price').eq('duration_months', 12).maybeSingle(),
  ]);
  const value = (key: string) => Number(config?.find((c) => c.key === key)?.value_numeric ?? 0);

  return (
    <main className={pageClass}>
      <header>
        <Link href="/admin" className="text-sm text-neutral-500 dark:text-neutral-400">← Administración</Link>
        <h1 className="text-2xl font-semibold">Precios</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Los pedidos ya hechos mantienen su precio. Personal Plus nueva se cobra al precio nuevo; las ya activas siguen con el suyo.</p>
      </header>
      {ok && <div role="status" className={okBox}>{ok}</div>}
      {error && <div role="alert" className={errorBox}>{error}</div>}
      <form action={setPrices} className={`${cardClass} grid gap-3 sm:grid-cols-2`}>
        <label className={labelClass}>Edición Personal · online (Mercado Pago)<input name="online" inputMode="numeric" required defaultValue={value('personal_price_online')} className={inputClass} /></label>
        <label className={labelClass}>Edición Personal · transferencia<input name="transfer" inputMode="numeric" required defaultValue={value('personal_price_transfer')} className={inputClass} /></label>
        <label className={labelClass}>Edición Personal · MercadoLibre (solo se muestra)<input name="mercadolibre" inputMode="numeric" required defaultValue={value('personal_price_mercadolibre')} className={inputClass} /></label>
        <label className={labelClass}>Personal Plus por mes (todo incluido y funciones nuevas; alternativa a la Edición Personal)<input name="monthly" inputMode="numeric" required defaultValue={Number(monthly?.price ?? 0)} className={inputClass} /></label>
        <label className={labelClass}>Aparato extra<input name="extra_device" inputMode="numeric" required defaultValue={Number(device?.price ?? 0)} className={inputClass} /></label>
        <div className="sm:col-span-2"><SubmitButton className={primaryButton}>Guardar precios</SubmitButton></div>
      </form>
      <form action={setRegularPrice} className={`${cardClass} grid gap-3 sm:grid-cols-2`}>
        <h2 className="font-semibold sm:col-span-2">Precio de lanzamiento</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 sm:col-span-2">Si ponés un precio normal mayor al online, en la compra se ve tachado con la etiqueta «Precio de lanzamiento». Poné 0 para no mostrarlo.</p>
        <label className={labelClass}>Precio normal (tachado)<input name="regular" inputMode="numeric" required defaultValue={value('personal_price_regular')} className={inputClass} /></label>
        <div className="sm:col-span-2"><SubmitButton className={primaryButton}>Guardar precio normal</SubmitButton></div>
      </form>
      <form action={setPlusAnnualPrice} className={`${cardClass} grid gap-3 sm:grid-cols-2`}>
        <h2 className="font-semibold sm:col-span-2">Personal Plus anual</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 sm:col-span-2">Pago por 12 meses (una sola vez). Conviene que salga como unos 10 meses del precio mensual.</p>
        <label className={labelClass}>Precio por año<input name="annual" inputMode="numeric" required defaultValue={Number(annual?.price ?? 0)} className={inputClass} /></label>
        <div className="sm:col-span-2"><SubmitButton className={primaryButton}>Guardar precio anual</SubmitButton></div>
      </form>
      <form action={setPackPrices} className={`${cardClass} grid gap-3 sm:grid-cols-2`}>
        <h2 className="font-semibold sm:col-span-2">Pack Ventas y Stock</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 sm:col-span-2">Ventas, resumen, stock, producción, compras y proveedores. Se compra en la tienda de la app (pago único). Con Plus viene incluido.</p>
        <label className={labelClass}>Precio del pack (suelto)<input name="pack" inputMode="numeric" required defaultValue={Number(pack?.price ?? 0)} className={inputClass} /></label>
        <input type="hidden" name="with_personal" value={value('pack_ventas_with_personal')} />
        <div className="sm:col-span-2"><SubmitButton className={primaryButton}>Guardar precios del pack</SubmitButton></div>
      </form>
      <form action={setActivityPrices} className={`${cardClass} grid gap-3 sm:grid-cols-2`}>
        <h2 className="font-semibold sm:col-span-2">Actividades</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 sm:col-span-2">La actividad principal viene incluida. La segunda sale siempre a mitad de precio (se calcula sola); las siguientes, precio normal. Con Plus tienen todas.</p>
        <label className={labelClass}>Actividad (precio normal)<input name="extra" inputMode="numeric" required defaultValue={value('activity_price_extra')} className={inputClass} /><span>La segunda actividad: {Math.round(value('activity_price_extra') / 2).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })} (mitad).</span></label>
        <div className="sm:col-span-2"><SubmitButton className={primaryButton}>Guardar precios de actividades</SubmitButton></div>
      </form>
    </main>
  );
}
