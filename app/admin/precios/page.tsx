import Link from 'next/link';
import { SubmitButton } from '@/components/submit-button';
import { requireAdmin } from '@/lib/admin';
import { cardClass, errorBox, inputClass, labelClass, okBox, pageClass, primaryButton } from '@/lib/ui';
import { adjustPrices, setActivityPrices, setLoyaltyDiscounts, setPackPrices, setPlusAnnualPrice, setPlusTrialDays, setPrices, setRegularPrice } from '../actions';
import { adjustDue } from '@/lib/price-adjust';

export default async function AdminPricesPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const { supabase } = await requireAdmin();
  const [{ data: config }, { data: monthly }, { data: device }, { data: pack }, { data: annual }, { data: lastAdjust }, { data: loyalty }] = await Promise.all([
    supabase.from('pricing_config').select('key,value_numeric').in('key', ['personal_price_online', 'personal_price_transfer', 'personal_price_mercadolibre', 'activity_price_secondary', 'activity_price_extra', 'pack_ventas_with_personal', 'personal_price_regular', 'plus_trial_days']),
    supabase.from('subscription_plans_catalog').select('price').eq('duration_months', 1).maybeSingle(),
    supabase.from('modules').select('price').eq('code', 'EXTRA_DEVICE').maybeSingle(),
    supabase.from('modules').select('price').eq('code', 'PACK_VENTAS').maybeSingle(),
    supabase.from('subscription_plans_catalog').select('price').eq('duration_months', 12).maybeSingle(),
    supabase.from('pricing_config').select('value_numeric,value_text').eq('key', 'last_price_adjust').maybeSingle(),
    supabase.from('discount_rules').select('min_days,percentage').eq('discount_type', 'personal_loyalty').order('min_days'),
  ]);
  const due = adjustDue(lastAdjust?.value_text ?? null);
  const tiers = [0, 1, 2].map((i) => ({ days: Number(loyalty?.[i]?.min_days ?? [90, 180, 365][i]), pct: Number(loyalty?.[i]?.percentage ?? [10, 15, 25][i]) }));
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
      <form action={adjustPrices} className={`${cardClass} grid gap-3 ${due ? 'ring-2 ring-amber-400' : ''}`}>
        <h2 className="font-semibold">Ajuste por inflación</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Sube <strong>todos</strong> los precios juntos (Edición Personal, Personal Plus mensual y anual, pack, aparato, actividades, revendedoras y precio tachado), redondeados a $100. Conviene hacerlo cada 3 meses con la inflación de esos 3 meses (la publica el INDEC). Las Personal Plus mensuales ya contratadas siguen con su monto.
        </p>
        <p className={`text-sm ${due ? 'font-semibold text-amber-700 dark:text-amber-300' : 'text-neutral-500'}`}>
          {lastAdjust?.value_text ? `Último ajuste: ${new Date(lastAdjust.value_text).toLocaleDateString('es-AR', { dateStyle: 'long', timeZone: 'America/Argentina/Buenos_Aires' })} (${Number(lastAdjust.value_numeric).toLocaleString('es-AR')} %).` : 'Todavía no hiciste ningún ajuste.'}{due ? ' Ya toca ajustar.' : ''}
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className={labelClass}>Porcentaje<input name="pct" inputMode="decimal" required placeholder="Ej.: 6" className={`${inputClass} w-28`} /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="confirm" className="h-5 w-5 accent-orange-800" />Sí, subir todos los precios</label>
          <SubmitButton className={primaryButton}>Ajustar precios</SubmitButton>
        </div>
      </form>
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
      <form action={setPlusTrialDays} className={`${cardClass} grid gap-3 sm:grid-cols-2`}>
        <h2 className="font-semibold sm:col-span-2">Prueba gratis de Personal Plus</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 sm:col-span-2">Cada cuenta que nunca tuvo Personal Plus la puede probar una sola vez, sin tarjeta, desde «Mi acceso». Al terminar vuelve a como estaba, sin borrar nada. Poné 0 para apagarla.</p>
        <label className={labelClass}>Días de prueba<input name="days" inputMode="numeric" required defaultValue={value('plus_trial_days')} className={inputClass} /></label>
        <div className="sm:col-span-2"><SubmitButton className={primaryButton}>Guardar días de prueba</SubmitButton></div>
      </form>
      <form action={setPackPrices} className={`${cardClass} grid gap-3 sm:grid-cols-2`}>
        <h2 className="font-semibold sm:col-span-2">Pack Ventas y Stock</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 sm:col-span-2">Ventas, resumen, stock, producción, compras y proveedores. Se compra en la tienda de la app (pago único). Con Plus viene incluido.</p>
        <label className={labelClass}>Precio del pack (suelto)<input name="pack" inputMode="numeric" required defaultValue={Number(pack?.price ?? 0)} className={inputClass} /></label>
        <input type="hidden" name="with_personal" value={value('pack_ventas_with_personal')} />
        <div className="sm:col-span-2"><SubmitButton className={primaryButton}>Guardar precios del pack</SubmitButton></div>
      </form>
      <form action={setLoyaltyDiscounts} className={`${cardClass} grid gap-3 sm:grid-cols-3`}>
        <h2 className="font-semibold sm:col-span-3">Descuento por antigüedad para pasar a Personal Plus</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 sm:col-span-3">Quien tiene la Edición Personal (comprada, no de regalo) y se pasa a Personal Plus, recibe un descuento según cuánto tiempo la tiene. Se aplica al mensual (todos los meses) y al anual. Se usa el escalón más alto que alcanza.</p>
        {tiers.map((t, i) => (
          <div key={i} className="grid gap-2">
            <label className={labelClass}>Desde (días)<input name={`d${i + 1}`} inputMode="numeric" required defaultValue={t.days} className={inputClass} /></label>
            <label className={labelClass}>Descuento (%)<input name={`p${i + 1}`} inputMode="numeric" required defaultValue={t.pct} className={inputClass} /></label>
          </div>
        ))}
        <div className="sm:col-span-3"><SubmitButton className={primaryButton}>Guardar descuentos</SubmitButton></div>
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
