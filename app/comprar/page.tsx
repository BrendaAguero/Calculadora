import Link from 'next/link';
import { PublicPage } from '@/components/public-page';
import { SubmitButton } from '@/components/submit-button';
import { CONTACT_EMAIL } from '@/lib/legal';
import { createClient } from '@/lib/supabase/server';
import { cardClass, errorBox, inputClass, labelClass } from '@/lib/ui';
import { buyPersonal } from './actions';

export const metadata = { title: 'Comprar · Calculadora Emprender' };

const money = (value: number) => value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

export default async function BuyPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const [{ data: prices }, { data: monthly }, { data: pack }] = await Promise.all([
    supabase.from('pricing_config').select('key,value_numeric').in('key', ['personal_price_online', 'personal_price_transfer', 'personal_price_mercadolibre', 'included_devices', 'pack_ventas_with_personal']),
    supabase.from('subscription_plans_catalog').select('price').eq('duration_months', 1).eq('active', true).maybeSingle(),
    supabase.from('modules').select('price').eq('code', 'PACK_VENTAS').eq('active', true).maybeSingle(),
  ]);
  const price = (key: string, fallback: number) => Number(prices?.find((p) => p.key === key)?.value_numeric ?? fallback);
  const devices = price('included_devices', 2);
  const packPrice = Number(pack?.price ?? 10000);
  const packWith = price('pack_ventas_with_personal', 7000);

  return (
    <PublicPage>
      <h1 className="text-2xl font-bold">Edición Personal</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">Calculá cuánto preparar, cuánto te cuesta cada pieza y a cuánto venderla. Guardá tus materiales, fórmulas, moldes y productos. <strong>Pagás una sola vez.</strong></p>

      <section className={`mt-6 ${cardClass}`}>
        <p className="text-3xl font-bold">{money(price('personal_price_online', 44900))}</p>
        <p className="text-xs text-neutral-500">pago único con Mercado Pago</p>
        <ul className="mt-4 space-y-1 text-sm text-neutral-700 dark:text-neutral-300">
          <li>✓ Calculadora de tu actividad principal: Yeso, Resina, Jesmonite o Cemento</li>
          <li>✓ Materiales, fórmulas, moldes, productos y cálculos guardados</li>
          <li>✓ Hasta 100 materiales, 50 productos, 30 fórmulas y 30 moldes</li>
          <li>✓ En {devices} aparatos (celular y computadora)</li>
          <li>✓ Incluye publicidad discreta</li>
        </ul>
        <p className="mt-3 text-xs text-neutral-500">Opcional después: <strong>Mensualidad Plus</strong> ({money(Number(monthly?.price ?? 4900))} por mes): sin publicidad, todas las actividades, el Pack Ventas y Stock y los módulos del taller, sin límites y modo sin conexión.</p>

        {error && <div role="alert" className={`mt-4 ${errorBox}`}>{error}</div>}
        <form action={buyPersonal} className="mt-4 grid gap-3">
          <label className={labelClass}>Tu nombre<input name="full_name" maxLength={120} autoComplete="name" className={inputClass} /></label>
          <label className={labelClass}>Tu email (ahí te mandamos tu clave de acceso)<input name="email" type="email" required maxLength={200} autoComplete="email" className={inputClass} /></label>
          <fieldset className="grid gap-2 rounded-2xl border border-neutral-200 p-3 text-sm dark:border-neutral-700">
            <legend className="px-1 font-semibold">¿Vas a usar la app para vender?</legend>
            <label className="flex items-start gap-2"><input type="radio" name="vender" value="si" className="mt-1" required /><span><strong>Sí, también vendo.</strong> Sumá el <strong>Pack Ventas y Stock</strong> por {money(packWith)} <span className="text-neutral-500">(después sale {money(packPrice)})</span>: ventas, resumen de ganancias, stock, producción, compras y proveedores. Total: <strong>{money(price('personal_price_online', 44900) + packWith)}</strong>.</span></label>
            <label className="flex items-start gap-2"><input type="radio" name="vender" value="no" className="mt-1" /><span>No, solo quiero calcular. Total: <strong>{money(price('personal_price_online', 44900))}</strong>.</span></label>
          </fieldset>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="terms" className="mt-1" required /><span>Acepto los <Link href="/legal/terminos" className="underline">términos</Link>, la <Link href="/legal/privacidad" className="underline">privacidad</Link> y las <Link href="/legal/compras" className="underline">condiciones de compra</Link>.</span></label>
          <div><SubmitButton className="rounded-xl bg-orange-700 px-5 py-2.5 font-semibold text-white hover:bg-orange-800" pendingText="Yendo a Mercado Pago…">Comprar con Mercado Pago</SubmitButton></div>
        </form>
      </section>

      <section className={`mt-4 ${cardClass} text-sm`}>
        <h2 className="font-semibold">Otras formas de pago</h2>
        <ul className="mt-2 space-y-1 text-neutral-700 dark:text-neutral-300">
          <li><strong>Transferencia:</strong> {money(price('personal_price_transfer', 40000))}. Escribinos a <a className="underline" href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Quiero la Edición Personal por transferencia')}`}>{CONTACT_EMAIL}</a> y te pasamos los datos.</li>
          <li><strong>MercadoLibre:</strong> {money(price('personal_price_mercadolibre', 49900))}. Después de comprar, mandanos tu email por mensaje.</li>
        </ul>
        <p className="mt-2 text-xs text-neutral-500">En esos casos verificamos el pago a mano y te mandamos tu clave de acceso por correo.</p>
      </section>

      <p className="mt-4 text-sm">¿Ya la tenés? <Link href="/login" className="underline">Entrá con tu clave</Link>.</p>
    </PublicPage>
  );
}
