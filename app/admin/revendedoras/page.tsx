import Link from 'next/link';
import { SubmitButton } from '@/components/submit-button';
import { requireAdmin } from '@/lib/admin';
import { getResellerResources } from '@/lib/reseller';
import { createAdminClient } from '@/lib/supabase/admin';
import { cardClass, errorBox, inputClass, labelClass, okBox, pageClass, primaryButton } from '@/lib/ui';
import { saveResellerResources, setResellerMargin, setResellerMarkup, setResellerPrices } from '../actions';

const pesos = (value: number) => value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

export default async function AdminResellersPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const { supabase } = await requireAdmin();
  const [{ data: config }, resources, { data: accounts }] = await Promise.all([
    supabase.from('pricing_config').select('key,value_numeric').in('key', ['reseller_unit_price', 'reseller_discount_5', 'reseller_discount_10', 'reseller_discount_20', 'personal_price_online', 'personal_price_transfer', 'reseller_min_margin_pct', 'reseller_max_markup_pct']),
    getResellerResources(supabase),
    supabase.from('reseller_accounts').select('user_id,status,created_at').order('created_at', { ascending: false }).limit(200),
  ]);
  const value = (key: string) => Number(config?.find((c) => c.key === key)?.value_numeric ?? 0);
  const unit = value('reseller_unit_price');
  const tier = (d: number) => Math.round((unit * (1 - d / 100)) / 10) * 10;

  // Saldos de cada revendedora (con el cliente del servidor; la función no es pública).
  const ids = (accounts ?? []).map((a) => a.user_id);
  const admin = createAdminClient();
  const [{ data: profiles }, balances] = await Promise.all([
    ids.length ? supabase.from('profiles').select('id,email,full_name').in('id', ids) : Promise.resolve({ data: [] as { id: string; email: string | null; full_name: string | null }[] }),
    Promise.all(ids.map(async (id) => [id, admin ? Number((await admin.rpc('reseller_balance', { p_user_id: id })).data ?? 0) : null] as const)),
  ]);

  return (
    <main className={pageClass}>
      <header>
        <Link href="/admin" className="text-sm text-neutral-500 dark:text-neutral-400">← Administración</Link>
        <h1 className="text-2xl font-semibold">Revendedoras</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Los pedidos de clientas se aprueban en <Link href="/admin/emails" className="underline">Emails</Link>.</p>
      </header>
      {ok && <div role="status" className={okBox}>{ok}</div>}
      {error && <div role="alert" className={errorBox}>{error}</div>}

      <form action={setResellerPrices} className={`${cardClass} grid gap-3 sm:grid-cols-4`}>
        <h2 className="font-semibold sm:col-span-4">Precios</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 sm:col-span-4">Precio al público: {pesos(value('personal_price_online'))}. Hoy: de a una {pesos(unit)} · desde 5 {pesos(tier(value('reseller_discount_5')))} · desde 10 {pesos(tier(value('reseller_discount_10')))} · desde 20 {pesos(tier(value('reseller_discount_20')))} (cada una).</p>
        <label className={labelClass}>Precio de a una<input name="unit" inputMode="numeric" required defaultValue={unit} className={inputClass} /></label>
        <label className={labelClass}>Descuento desde 5 (%)<input name="d5" inputMode="numeric" required defaultValue={value('reseller_discount_5')} className={inputClass} /></label>
        <label className={labelClass}>Descuento desde 10 (%)<input name="d10" inputMode="numeric" required defaultValue={value('reseller_discount_10')} className={inputClass} /></label>
        <label className={labelClass}>Descuento desde 20 (%)<input name="d20" inputMode="numeric" required defaultValue={value('reseller_discount_20')} className={inputClass} /></label>
        <div className="sm:col-span-4"><SubmitButton className={primaryButton}>Guardar precios</SubmitButton></div>
      </form>

      <form action={setResellerMargin} className={`${cardClass} grid gap-3 sm:grid-cols-2`}>
        <h2 className="font-semibold sm:col-span-2">Protección del margen</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 sm:col-span-2">Para que revender siempre convenga: la app no deja guardar un precio de revendedora, un precio al público ni un descuento automático que le deje a la revendedora menos de este margen frente al precio más bajo al público (con el mayor descuento encendido). Los descuentos no se suman: en cada compra se aplica uno solo.</p>
        <p className="text-sm sm:col-span-2">Hoy, de a una: paga {pesos(unit)} y el público paga desde {pesos(Math.min(value('personal_price_online'), value('personal_price_transfer') || value('personal_price_online')))} → le quedan {pesos(Math.min(value('personal_price_online'), value('personal_price_transfer') || value('personal_price_online')) - unit)} por licencia.</p>
        <label className={labelClass}>Margen mínimo (%)<input name="margin" inputMode="numeric" required defaultValue={value('reseller_min_margin_pct') || 20} className={inputClass} /></label>
        <div className="sm:col-span-2"><SubmitButton className={primaryButton}>Guardar margen</SubmitButton></div>
      </form>

      <form action={setResellerMarkup} className={`${cardClass} grid gap-3 sm:grid-cols-2`}>
        <h2 className="font-semibold sm:col-span-2">Precio de venta de las revendedoras</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 sm:col-span-2">Pueden vender desde el precio oficial hasta este porcentaje más (por su atención: ayudar a empezar, efectivo, cuotas). Lo ven en su panel y figura en sus condiciones. A cada clienta le llega por correo el precio oficial y el máximo, así sabe si le cobraron de más. Poné 0 para que solo puedan cobrar el precio oficial.</p>
        <p className="text-sm sm:col-span-2">Hoy: entre {pesos(value('personal_price_online'))} y {pesos(Math.round((value('personal_price_online') * (1 + (value('reseller_max_markup_pct') || 0) / 100)) / 100) * 100)}.</p>
        <label className={labelClass}>Máximo por encima del oficial (%)<input name="markup" inputMode="numeric" required defaultValue={value('reseller_max_markup_pct')} className={inputClass} /></label>
        <div className="sm:col-span-2"><SubmitButton className={primaryButton}>Guardar tope</SubmitButton></div>
      </form>

      <form action={saveResellerResources} className={`${cardClass} grid gap-3 sm:grid-cols-2`}>
        <h2 className="font-semibold sm:col-span-2">Contacto y recursos de venta</h2>
        <label className={labelClass}>WhatsApp (con código de país, por ejemplo +5493511234567)<input name="whatsapp" defaultValue={resources.whatsapp} className={inputClass} /></label>
        <label className={labelClass}>Enlace al grupo de revendedoras (https://…)<input name="group_link" defaultValue={resources.groupLink ?? ''} className={inputClass} /></label>
        <label className={`${labelClass} sm:col-span-2`}>Tiempo estimado de aprobación<input name="wait_time" maxLength={120} defaultValue={resources.waitTime} className={inputClass} /></label>
        <label className={`${labelClass} sm:col-span-2`}>Mensaje para que la revendedora le mande a su clienta<textarea name="client_message" rows={4} maxLength={1500} defaultValue={resources.clientMessage} className={inputClass} /></label>
        <label className={`${labelClass} sm:col-span-2`}>Consejos para vender (uno por línea)<textarea name="tips" rows={5} maxLength={4000} defaultValue={resources.tips} className={inputClass} /></label>
        <label className={`${labelClass} sm:col-span-2`}>Material gráfico e información (uno por línea: «Título | https://…», por ejemplo una carpeta de Google Drive)<textarea name="materials" rows={4} maxLength={4000} defaultValue={resources.materials} className={inputClass} placeholder={'Imágenes para Instagram | https://drive.google.com/...\nVideo de la calculadora | https://...'} /></label>
        <div className="sm:col-span-2"><SubmitButton className={primaryButton}>Guardar recursos</SubmitButton></div>
      </form>

      <section className={cardClass}>
        <h2 className="font-semibold">Revendedoras ({accounts?.length ?? 0})</h2>
        <ul className="mt-2 divide-y divide-neutral-100 text-sm dark:divide-neutral-800">
          {(accounts ?? []).map((a) => {
            const p = profiles?.find((x) => x.id === a.user_id);
            const balance = balances.find(([id]) => id === a.user_id)?.[1];
            return <li key={a.user_id} className="py-2">{p?.full_name ? `${p.full_name} · ` : ''}{p?.email ?? a.user_id} · {balance == null ? '' : `${balance} licencias disponibles`}{a.status !== 'active' ? ' · suspendida' : ''}</li>;
          })}
          {!accounts?.length && <li className="py-2 text-neutral-500">Todavía no hay revendedoras.</li>}
        </ul>
      </section>
    </main>
  );
}
