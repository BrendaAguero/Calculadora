import Link from 'next/link';
import { CopyButton } from '@/components/copy-button';
import { SubmitButton } from '@/components/submit-button';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { siteOrigin } from '@/lib/origin';
import { money } from '@/app/stock/constants';
import { cardClass, dateOnly, errorBox, inputClass, labelClass, okBox, pageClass, primaryButton } from '@/lib/ui';
import { applyAffiliate, requestWithdrawal } from './actions';

const COMMISSION_LABELS: Record<string, string> = {
  pending: 'Pendiente', held: 'Retenida', available: 'Disponible', withdrawal_requested: 'En retiro', paid: 'Pagada', reversed: 'Anulada', canceled: 'Cancelada',
};
const WITHDRAWAL_LABELS: Record<string, string> = { requested: 'Pedido', reviewing: 'En revisión', approved: 'Aprobado', paid: 'Pagado', rejected: 'Rechazado' };

// Textos sugeridos para que las afiliadas compartan su enlace.
function promoTexts(link: string, code: string): [string, string][] {
  return [
    ['Post para redes', `¿Trabajás con yeso, resina o cemento? 🧮 Yo calculo materiales, costos y precios con la Calculadora Emprender: sé cuánto gasto en cada pieza y cuánto gano.\n\nProbala con mi enlace: ${link}`],
    ['Mensaje de WhatsApp', `¡Hola! Te paso la app que uso para calcular cuánto material lleva cada pieza y a qué precio vender: ${link}\nSi comprás, usá mi código ${code}.`],
    ['Para talleres y clases', `Para calcular las mezclas y los costos de lo que hagan, les recomiendo la Calculadora Emprender. Entren desde ${link} o usen el código ${code} al comprar.`],
    ['Historia corta', `Dejé de calcular a ojo 🙌 Costos, mezclas y ganancia en un solo lugar → ${link}`],
  ];
}

export default async function AffiliatesPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Libera las comisiones cuya retención ya terminó y evalúa PRO antes de mostrar.
  await supabase.rpc('refresh_my_affiliate');
  const { data: affiliate } = await supabase.from('affiliates').select('id,status,commission_percentage,is_pro,valid_sales_count,approved_at,affiliate_codes(code,active)').eq('user_id', user.id).maybeSingle();
  const [{ data: commissions }, { data: withdrawals }] = affiliate?.status === 'approved' || affiliate?.status === 'suspended'
    ? await Promise.all([
      supabase.from('commissions').select('id,commission_amount,gross_sale_amount,percentage,status,hold_until,created_at').eq('affiliate_id', affiliate.id).order('created_at', { ascending: false }).limit(100),
      supabase.from('withdrawals').select('id,amount,status,payout_method,requested_at,paid_at').eq('affiliate_id', affiliate.id).order('requested_at', { ascending: false }).limit(20),
    ])
    : [{ data: [] }, { data: [] }];

  const code = (affiliate?.affiliate_codes ?? []).find((c) => c.active)?.code;
  const link = code ? `${await siteOrigin()}/r/${code}` : null;
  const sum = (status: string) => (commissions ?? []).filter((c) => c.status === status).reduce((acc, c) => acc + Number(c.commission_amount), 0);
  const minimum = affiliate?.is_pro ? 10000 : 20000;
  const openWithdrawal = (withdrawals ?? []).some((w) => ['requested', 'reviewing', 'approved'].includes(w.status));

  return (
    <main className={pageClass}>
      <header>
        <Link href="/mas" className="text-sm text-neutral-500 dark:text-neutral-400">← Más</Link>
        <h1 className="text-2xl font-semibold">Programa de afiliadas</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Recomendá la Calculadora y ganá una comisión por cada compra que llegue con tu código.</p>
      </header>
      {ok && <div role="status" className={okBox}>{ok}</div>}
      {error && <div role="alert" className={errorBox}>{error}</div>}

      {!affiliate ? (
        <form action={applyAffiliate} className={`${cardClass} grid gap-3`}>
          <h2 className="font-semibold">Cómo funciona</h2>
          <ul className="list-inside list-disc text-sm text-neutral-600 dark:text-neutral-300">
            <li>Comisión del 15 % o 20 % de cada compra pagada con tu código (25 % si llegás a PRO).</li>
            <li>La comisión queda retenida 11 días por si hay devoluciones; después pasa a disponible.</li>
            <li>Podés pedir el retiro desde $20.000 disponibles ($10.000 si sos PRO).</li>
            <li>PRO: 10 ventas válidas por mes durante 3 meses seguidos.</li>
            <li>No se permite usar el propio código ni crear cuentas falsas: esas ventas no generan comisión.</li>
          </ul>
          <label className={labelClass}>¿Cómo pensás recomendarla? (opcional)<textarea name="note" rows={3} maxLength={500} className={inputClass} placeholder="Redes, ferias, talleres…" /></label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="accept" className="mt-1" required /> Acepto las <Link href="/legal/afiliadas" target="_blank" className="underline">condiciones del programa</Link>.</label>
          <div><SubmitButton className={primaryButton}>Quiero ser afiliada</SubmitButton></div>
        </form>
      ) : affiliate.status === 'pending' ? (
        <div className={`${cardClass} text-sm`}>Tu solicitud está en revisión. Cuando se apruebe vas a ver acá tu código y tu enlace.</div>
      ) : affiliate.status === 'rejected' ? (
        <div className={`${cardClass} text-sm`}>Tu solicitud no fue aprobada. Si creés que es un error, escribinos.</div>
      ) : (
        <>
          {affiliate.status === 'suspended' && <div role="alert" className={errorBox}>Tu cuenta de afiliada está suspendida: tu código no genera comisiones nuevas.</div>}
          <section className={cardClass}>
            <p className="text-xs text-neutral-500">Tu código</p>
            <p className="mt-1 text-3xl font-bold tracking-wider">{code ?? '—'}</p>
            {link && <p className="mt-2 break-all text-sm">Enlace para compartir: <span className="font-medium">{link}</span></p>}
            <p className="mt-2 text-xs text-neutral-500">Comisión {Number(affiliate.commission_percentage)} %{affiliate.is_pro ? ' · PRO ⭐' : ''} · {affiliate.valid_sales_count} ventas válidas</p>
            {link && <div className="mt-3 flex flex-wrap gap-2"><CopyButton text={link} label="Copiar enlace" />{code && <CopyButton text={code} label="Copiar código" />}</div>}
          </section>

          {link && code && (
            <section className={cardClass}>
              <h2 className="font-semibold">Material para compartir</h2>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Textos listos para redes, WhatsApp o tus talleres. Copialos y adaptalos a tu forma de hablar.</p>
              <ul className="mt-3 grid gap-3">
                {promoTexts(link, code).map(([title, body]) => (
                  <li key={title} className="rounded-xl border border-neutral-200 p-3 text-sm dark:border-neutral-800">
                    <div className="flex items-center justify-between gap-2"><p className="font-medium">{title}</p><CopyButton text={body} /></div>
                    <p className="mt-2 whitespace-pre-line text-neutral-600 dark:text-neutral-300">{body}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-neutral-500">Recordá: no prometas funciones ni descuentos que no existen y no hagas spam. <Link href="/legal/afiliadas" className="underline">Ver condiciones</Link>.</p>
            </section>
          )}

          <section className="grid grid-cols-3 gap-3">
            {[['Retenidas', sum('held')], ['Disponibles', sum('available')], ['Pagadas', sum('paid')]].map(([label, value]) => (
              <div key={label as string} className={cardClass}><p className="text-xs text-neutral-500">{label}</p><p className="mt-1 text-lg font-semibold">{money(value as number)}</p></div>
            ))}
          </section>

          <form action={requestWithdrawal} className={`${cardClass} grid gap-3 sm:grid-cols-2`}>
            <h2 className="font-semibold sm:col-span-2">Retirar</h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 sm:col-span-2">Mínimo {money(minimum)}. Se retira todo lo disponible.{openWithdrawal ? ' Ya tenés un retiro en curso.' : ''}</p>
            <label className={labelClass}>Medio
              <select name="method" className={inputClass}><option>Mercado Pago</option><option>Transferencia (CBU/CVU)</option></select>
            </label>
            <label className={labelClass}>Alias, CBU o CVU<input name="reference" required maxLength={120} className={inputClass} /></label>
            <div className="sm:col-span-2"><button type="submit" disabled={openWithdrawal || sum('available') < minimum} className={`${primaryButton} disabled:opacity-40`}>Pedir retiro</button></div>
          </form>

          <section className={cardClass}>
            <h2 className="font-semibold">Comisiones</h2>
            {!commissions?.length ? <p className="mt-2 text-sm text-neutral-500">Todavía no hay compras con tu código.</p> : (
              <ul className="mt-2 divide-y divide-neutral-100 text-sm dark:divide-neutral-800">{commissions.map((c) => (
                <li key={c.id} className="flex justify-between gap-3 py-2">
                  <span>{dateOnly(c.created_at)} · venta {money(c.gross_sale_amount)} · {Number(c.percentage)} %{c.status === 'held' && c.hold_until ? ` · se libera el ${dateOnly(c.hold_until)}` : ''}</span>
                  <span className="text-right"><strong>{money(c.commission_amount)}</strong><span className="block text-xs text-neutral-500">{COMMISSION_LABELS[c.status] ?? c.status}</span></span>
                </li>
              ))}</ul>
            )}
          </section>

          {(withdrawals ?? []).length > 0 && (
            <section className={cardClass}>
              <h2 className="font-semibold">Retiros</h2>
              <ul className="mt-2 divide-y divide-neutral-100 text-sm dark:divide-neutral-800">{withdrawals!.map((w) => (
                <li key={w.id} className="flex justify-between py-2"><span>{dateOnly(w.requested_at)} · {w.payout_method}</span><span>{money(w.amount)} · {WITHDRAWAL_LABELS[w.status] ?? w.status}</span></li>
              ))}</ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}
