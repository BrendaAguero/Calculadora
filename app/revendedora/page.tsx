import { redirect } from 'next/navigation';
import { BookOpen, Download, Lightbulb, MessageCircle, Store, UserPlus, Users } from 'lucide-react';
import { CopyButton } from '@/components/copy-button';
import { CONTACT_EMAIL } from '@/lib/legal';
import { getResellerResources, parseMaterials, whatsappLink } from '@/lib/reseller';
import { AppShell } from '@/components/app-shell';
import { SubmitButton } from '@/components/submit-button';
import { createClient } from '@/lib/supabase/server';
import { dateOnly, errorBox, inputClass, okBox } from '@/lib/ui';
import { addClient, becomeReseller, buyPack, cancelClient } from './actions';

const pesos = (value: number) => value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const card = 'rounded-3xl bg-white p-5 dark:bg-neutral-900';
const PACKS = [5, 10, 20];
const STATUS: Record<string, string> = { pending: 'Esperando aprobación', approved: 'Aprobada · ya tiene su clave', rejected: 'No aprobada' };

export default async function ResellerPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; asignada?: string }> }) {
  const { ok, error, asignada } = await searchParams;
  const assigned = asignada && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(asignada) ? asignada.slice(0, 200) : null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const [{ data: account }, { data: price }, { data: retail }] = await Promise.all([
    supabase.from('reseller_accounts').select('status').eq('user_id', user.id).maybeSingle(),
    supabase.from('pricing_config').select('value_numeric').eq('key', 'reseller_unit_price').maybeSingle(),
    supabase.from('pricing_config').select('value_numeric').eq('key', 'personal_price_online').maybeSingle(),
  ]);
  const unit = Number(price?.value_numeric ?? 0);
  const retailPrice = Number(retail?.value_numeric ?? 0);
  const messages = <>{ok && <div role="status" className={`mt-4 ${okBox}`}>{ok}</div>}{error && <div role="alert" className={`mt-4 ${errorBox}`}>{error}</div>}</>;

  if (!account) {
    return (
      <AppShell>
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-resina text-resina-dark"><Store size={24} aria-hidden="true" /></span>
        <h1 className="mt-4 text-3xl">Modo revendedora</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-300">Vendé la Edición Personal a tus clientas y ganá la diferencia.</p>
        {messages}
        <ol className="mt-5 space-y-3">
          {[
            `Comprás licencias de a una (${pesos(unit)} c/u; al público valen ${pesos(retailPrice)}) o en paquetes de 5, 10 o 20 con más descuento.`,
            'Cobrás a tus clientas como quieras y asignás cada licencia con el correo de tu clienta.',
            'La administración aprueba y tu clienta recibe su clave de acceso por correo. Tenés recursos de venta, consejos y material gráfico.',
            'Activarlo es gratis. Si comprás un paquete de 5 licencias o más, te regalamos tu propia Edición Personal para que conozcas lo que vendés.',
          ].map((text, i) => <li key={i} className={`${card} flex gap-3`}><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-orange-100 text-sm font-bold text-orange-800 dark:bg-orange-950 dark:text-orange-300">{i + 1}</span>{text}</li>)}
        </ol>
        <form action={becomeReseller} className="mt-5"><SubmitButton className="rounded-2xl bg-resina px-5 py-3 font-bold text-resina-dark">Activar el modo revendedora (gratis)</SubmitButton></form>
      </AppShell>
    );
  }

  const [{ data: balance }, { data: clients }, { data: orders }, { data: discounts }, resources] = await Promise.all([
    supabase.rpc('my_reseller_balance'),
    supabase.from('reseller_clients').select('id,email,full_name,status,note,created_at').eq('reseller_id', user.id).order('created_at', { ascending: false }).limit(200),
    supabase.from('reseller_orders').select('id,quantity,total,status,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
    supabase.from('pricing_config').select('key,value_numeric').in('key', ['reseller_discount_5', 'reseller_discount_10', 'reseller_discount_20']),
    getResellerResources(supabase),
  ]);
  const left = Number(balance ?? 0);
  const discountFor = (q: number) => Number(discounts?.find((d) => d.key === `reseller_discount_${q >= 20 ? 20 : q >= 10 ? 10 : 5}`)?.value_numeric ?? 0) * (q >= 5 ? 1 : 0);
  const priceFor = (q: number) => Math.round((unit * (1 - discountFor(q) / 100)) / 10) * 10;
  const materials = parseMaterials(resources.materials);
  const waText = assigned ? `Hola, soy revendedora de Calculadora Emprender. Acabo de asignar una licencia a ${assigned}. ¿Me la aprobás?` : 'Hola, soy revendedora de Calculadora Emprender.';

  const contact = (
    <section id="contacto" className={`mt-4 scroll-mt-6 ${card} ${assigned ? 'ring-2 ring-resina' : ''}`}>
      <h2 className="flex items-center gap-2 text-lg"><MessageCircle size={20} aria-hidden="true" />{assigned ? '¡Pedido enviado!' : 'Contacto con la administración'}</h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
        {assigned ? <>Le pediste a la administración que habilite a <strong>{assigned}</strong>. </> : null}
        Contactate con la administración para acelerar el proceso de aceptar a una clienta. Tiempo estimado: <strong>{resources.waitTime}</strong>.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {resources.whatsapp && <a href={whatsappLink(resources.whatsapp, waText)} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-orange-800 px-4 py-2.5 text-sm font-semibold text-white">WhatsApp: {resources.whatsapp}</a>}
        <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Revendedora: nueva clienta')}&body=${encodeURIComponent(waText)}`} className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-semibold dark:border-neutral-700">{CONTACT_EMAIL}</a>
        {resources.groupLink && <a href={resources.groupLink} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-semibold dark:border-neutral-700">Grupo de revendedoras</a>}
      </div>
    </section>
  );

  return (
    <AppShell>
      <header className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-resina text-resina-dark"><Store size={24} aria-hidden="true" /></span>
        <div><h1 className="text-3xl">Revendedora</h1><p className="text-sm text-neutral-500 dark:text-neutral-400">Tus licencias, tus clientas y tus recursos</p></div>
      </header>
      {messages}
      {assigned && contact}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <section className="terrazo-borde rounded-4xl bg-orange-800 p-6 text-white dark:bg-orange-900">
          <p className="text-sm text-white/75">Licencias disponibles</p>
          <p className="mt-1 font-display text-6xl font-bold">{Math.max(left, 0)}</p>
          <p className="mt-2 text-sm text-white/75">Cada clienta que asignás usa una. Si no se aprueba o la cancelás, vuelve a tu saldo.</p>
        </section>
        <section className={card}>
          <h2 className="text-lg">Comprar licencias</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">De a una: {pesos(unit)} c/u (al público: {pesos(retailPrice)}). En paquete, más barato:</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {PACKS.map((q) => (
              <form key={q} action={buyPack}>
                <input type="hidden" name="quantity" value={q} />
                <SubmitButton className="w-full rounded-2xl border border-neutral-200 p-3 text-center hover:border-orange-600 dark:border-neutral-700">
                  <span className="block font-display text-2xl font-bold">{q}</span>
                  <span className="block text-xs font-semibold text-orange-800 dark:text-orange-300">−{discountFor(q)} %</span>
                  <span className="block text-xs text-neutral-500 dark:text-neutral-400">{pesos(priceFor(q))} c/u</span>
                </SubmitButton>
              </form>
            ))}
          </div>
          <form action={buyPack} className="mt-3 flex items-end gap-2">
            <label className="flex-1 text-sm font-medium">Otra cantidad<input name="quantity" type="number" min={1} max={100} step={1} required defaultValue={1} className={`mt-1 ${inputClass}`} /></label>
            <SubmitButton className="rounded-xl bg-orange-800 px-4 py-2.5 font-semibold text-white">Comprar</SubmitButton>
          </form>
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">Desde 5 licencias se aplica el descuento del paquete.</p>
        </section>
      </div>

      <section className={`mt-4 ${card}`}>
        <h2 className="flex items-center gap-2 text-lg"><UserPlus size={20} aria-hidden="true" />Asignar a una clienta</h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Poné el correo de tu clienta: le pedimos a la administración que la habilite y le llega su clave de acceso por correo.</p>
        <form action={addClient} className="mt-3 grid gap-3 sm:grid-cols-[1.3fr_1fr_auto]">
          <label className="text-sm font-medium">Correo de la clienta<input name="email" type="email" required className={`mt-1 ${inputClass}`} placeholder="clienta@email.com" /></label>
          <label className="text-sm font-medium">Nombre (opcional)<input name="full_name" maxLength={120} className={`mt-1 ${inputClass}`} /></label>
          <div className="flex items-end"><SubmitButton className="w-full rounded-xl bg-resina px-4 py-2.5 font-bold text-resina-dark disabled:opacity-60">Asignar</SubmitButton></div>
        </form>
        {left <= 0 && <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">No te quedan licencias: comprá para poder asignar.</p>}
      </section>

      {!assigned && contact}

      <section className="mt-4">
        <h2 className="mb-2 flex items-center gap-2 px-1 text-lg"><Users size={20} aria-hidden="true" />Mis clientas</h2>
        <div className="divide-y divide-neutral-100 rounded-3xl bg-white px-5 dark:divide-neutral-800 dark:bg-neutral-900">
          {(clients ?? []).map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <div><p className="font-medium">{c.full_name ? `${c.full_name} · ` : ''}{c.email}</p><p className="text-xs text-neutral-500 dark:text-neutral-400">{dateOnly(c.created_at)} · {STATUS[c.status] ?? c.status}{c.note ? ` · ${c.note}` : ''}</p></div>
              {c.status === 'pending' && <form action={cancelClient}><input type="hidden" name="id" value={c.id} /><SubmitButton className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs dark:border-neutral-700">Cancelar</SubmitButton></form>}
            </div>
          ))}
          {!clients?.length && <p className="py-5 text-sm text-neutral-500 dark:text-neutral-400">Todavía no asignaste licencias.</p>}
        </div>
      </section>

      <section id="recursos" className="mt-6">
        <h2 className="mb-2 flex items-center gap-2 px-1 text-lg"><BookOpen size={20} aria-hidden="true" />Recursos de venta</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className={card}>
            <h3 className="font-semibold">Mensaje para tu clienta</h3>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Mandáselo después de la venta para que sepa qué esperar.</p>
            <p className="mt-3 whitespace-pre-line rounded-2xl bg-neutral-50 p-4 text-sm dark:bg-neutral-950">{resources.clientMessage}</p>
            <div className="mt-3"><CopyButton text={resources.clientMessage} label="Copiar mensaje" /></div>
          </div>
          <div className={card}>
            <h3 className="font-semibold">Consejos para vender</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {resources.tips.split('\n').filter((t) => t.trim()).map((tip, i) => <li key={i} className="flex gap-2"><Lightbulb size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-resina" />{tip}</li>)}
            </ul>
          </div>
          <div className={`${card} lg:col-span-2`}>
            <h3 className="font-semibold">Material gráfico e información</h3>
            {materials.length > 0 ? (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {materials.map((m) => <li key={m.url}><a href={m.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-medium hover:border-orange-600 dark:border-neutral-700"><Download size={16} aria-hidden="true" />{m.title}</a></li>)}
              </ul>
            ) : <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">Pronto vas a encontrar acá imágenes, videos y folletos para tus redes.</p>}
          </div>
        </div>
      </section>

      {(orders ?? []).length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 px-1 text-lg">Mis compras</h2>
          <div className="divide-y divide-neutral-100 rounded-3xl bg-white px-5 text-sm dark:divide-neutral-800 dark:bg-neutral-900">
            {orders!.map((o) => <p key={o.id} className="py-3">{o.quantity} {o.quantity === 1 ? 'licencia' : 'licencias'} · {pesos(Number(o.total))} · {o.status === 'approved' ? 'Pagado' : o.status === 'pending' ? 'Sin pagar' : o.status === 'refunded' ? 'Devuelto' : 'Cancelado'} · {dateOnly(o.created_at)}</p>)}
          </div>
        </section>
      )}
    </AppShell>
  );
}
