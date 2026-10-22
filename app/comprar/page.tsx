import Link from 'next/link';
import { PublicPage } from '@/components/public-page';
import { SubmitButton } from '@/components/submit-button';
import { CONTACT_EMAIL } from '@/lib/legal';
import { createClient } from '@/lib/supabase/server';
import { cardClass, errorBox, inputClass, labelClass } from '@/lib/ui';
import { buyPersonal } from './actions';
import { PlusPrices } from '@/components/plus-prices';
import { launchLastDay } from '@/lib/launch';
import { cookies } from 'next/headers';
import { PROMO_COOKIE } from '@/lib/promo';

export const metadata = { title: 'Comprar · Calculadora Emprender' };

const money = (value: number) => value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

export default async function BuyPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: prices }, { data: monthly }, { data: pack }, { data: offers }, { data: annual }] = await Promise.all([
    supabase.from('pricing_config').select('key,value_numeric,value_text').in('key', ['personal_price_online', 'personal_price_transfer', 'personal_price_mercadolibre', 'included_devices', 'personal_price_regular', 'launch_ends_at']),
    supabase.from('subscription_plans_catalog').select('price').eq('duration_months', 1).eq('active', true).maybeSingle(),
    supabase.from('modules').select('price').eq('code', 'PACK_VENTAS').eq('active', true).maybeSingle(),
    user ? supabase.rpc('my_offer') : Promise.resolve({ data: null }),
    supabase.from('subscription_plans_catalog').select('price').eq('duration_months', 12).eq('active', true).maybeSingle(),
  ]);
  const price = (key: string, fallback: number) => Number(prices?.find((p) => p.key === key)?.value_numeric ?? fallback);
  const launchEnd = launchLastDay(prices?.find((p) => p.key === 'launch_ends_at')?.value_text);
  const devices = price('included_devices', 2);
  const packPrice = Number(pack?.price ?? 10000);
  // Descuento personal (de un aviso automático): se aplica solo al comprar con el email de esta cuenta.
  const offer = ((offers ?? []) as { discount_pct: number; expires_at: string }[])[0] ?? null;
  const listPrice = price('personal_price_online', 15000);
  const finalPrice = offer ? Math.round(listPrice * (100 - offer.discount_pct) / 100) : listPrice;
  const promo = (await cookies()).get(PROMO_COOKIE)?.value ?? '';
  const offerUntil = offer ? new Date(offer.expires_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', timeZone: 'America/Argentina/Buenos_Aires' }) : '';

  return (
    <PublicPage>
      <h1 className="text-2xl font-bold">Edición Personal</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">Calculá cuánto preparar, cuánto te cuesta cada pieza y a cuánto venderla. Guardá tus materiales, fórmulas, moldes y productos. <strong>Pagás una sola vez.</strong></p>

      <section className={`mt-6 ${cardClass}`}>
        {offer && (
          <p className="mb-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">🎁 Tenés un {offer.discount_pct} % de descuento hasta el {offerUntil}. Se aplica al comprar con tu email ({user?.email}).</p>
        )}
        {offer && <p className="text-sm text-neutral-500 line-through">{money(listPrice)}</p>}
        {!offer && price('personal_price_regular', 0) > price('personal_price_online', 15000) && (
          <p className="text-sm"><span className="text-neutral-500 line-through">{money(price('personal_price_regular', 0))}</span> <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">Precio de lanzamiento{launchEnd ? ` hasta el ${launchEnd}` : ''}</span></p>
        )}
        <p className="text-3xl font-bold">{money(finalPrice)}</p>
        <p className="text-xs text-neutral-500">pago único con Mercado Pago</p>
        <ul className="mt-4 space-y-1 text-sm text-neutral-700 dark:text-neutral-300">
          <li>✓ Calculadora de tu actividad principal: Yeso, Resina, Jesmonite o Cemento</li>
          <li>✓ Materiales, fórmulas, moldes, productos y cálculos guardados</li>
          <li>✓ Hasta 100 materiales, 50 productos, 30 fórmulas y 30 moldes</li>
          <li>✓ Recetas de color y Cuaderno de pruebas incluidos</li>
          <li>✓ Actualizaciones de la app (arreglos y mantenimiento)</li>
          <li>✓ En {devices} aparatos (celular y computadora)</li>
          <li>✓ Incluye publicidad discreta</li>
        </ul>
        <p className="mt-3 text-xs text-neutral-500">La Edición Personal recibe actualizaciones; alguna mejora puede llegar, pero las funciones nuevas son para Personal Plus. Si vendés, después podés sumar el <strong>Pack Ventas y Stock</strong> desde la tienda de la app ({money(packPrice)}, una sola vez).</p>

        {error && <div role="alert" className={`mt-4 ${errorBox}`}>{error}</div>}
        <form action={buyPersonal} className="mt-4 grid gap-3">
          <label className={labelClass}>Tu nombre<input name="full_name" maxLength={120} autoComplete="name" className={inputClass} /></label>
          <label className={labelClass}>Tu email (ahí te mandamos tu clave de acceso)<input name="email" type="email" required maxLength={200} autoComplete="email" defaultValue={user?.email ?? ''} className={inputClass} /></label>
          <label className={labelClass}>Código de descuento (opcional)<input name="discount_code" maxLength={20} autoCapitalize="characters" defaultValue={promo} placeholder="Ej.: NAVIDAD26" className={`${inputClass} uppercase`} /><span>Se aplica antes de pagar. Si ya tenés un descuento mayor, queda ese.</span></label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="terms" className="mt-1" required /><span>Acepto los <Link href="/legal/terminos" className="underline">términos</Link>, la <Link href="/legal/privacidad" className="underline">privacidad</Link> y las <Link href="/legal/compras" className="underline">condiciones de compra</Link>.</span></label>
          <div><SubmitButton className="rounded-xl bg-orange-700 px-5 py-2.5 font-semibold text-white hover:bg-orange-800" pendingText="Yendo a Mercado Pago…">Comprar con Mercado Pago</SubmitButton></div>
        </form>
      </section>

      <section className={`mt-4 ${cardClass} text-sm`}>
        <h2 className="font-semibold">Otras formas de pago</h2>
        <ul className="mt-2 space-y-1 text-neutral-700 dark:text-neutral-300">
          <li><strong>Transferencia:</strong> {money(price('personal_price_transfer', 15000))}. Escribinos a <a className="underline" href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Quiero la Edición Personal por transferencia')}`}>{CONTACT_EMAIL}</a> y te pasamos los datos.</li>
          <li><strong>MercadoLibre:</strong> {money(price('personal_price_mercadolibre', 18000))}. Después de comprar, mandanos tu email por mensaje.</li>
        </ul>
        <p className="mt-2 text-xs text-neutral-500">En esos casos verificamos el pago a mano y te mandamos tu clave de acceso por correo.</p>
      </section>

      <section className={`mt-4 ${cardClass} text-sm`}>
        <h2 className="font-semibold">¿Preferís una suscripción?</h2>
        <PlusPrices monthly={Number(monthly?.price ?? 6900)} annual={annual ? Number(annual.price) : null} />
        <p className="mt-3 text-neutral-700 dark:text-neutral-300">Con <strong>Personal Plus</strong> tenés todo incluido mientras esté activo: todas las actividades, el Pack Ventas y Stock, sin límites, sin publicidad, sin conexión y <strong>todas las funciones nuevas</strong>. Es <strong>en lugar de</strong> la Edición Personal, no además. El mensual lo cancelás cuando quieras.</p>
        <p className="mt-2"><Link href="/registro" className="font-semibold underline">Creá tu cuenta gratis</Link> y elegila en «Mi acceso».</p>
      </section>

      <p className="mt-4 text-sm">¿Ya la tenés? <Link href="/login" className="underline">Entrá con tu clave</Link>.</p>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">¿Querés revenderla? El <Link href="/revendedora" className="underline">modo revendedora</Link> es gratis: comprás licencias con descuento y, con un paquete de 5 o más, te regalamos la tuya.</p>
    </PublicPage>
  );
}
