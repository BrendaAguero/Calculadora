import Link from 'next/link';
import { SubmitButton } from '@/components/submit-button';
import { one, requireAdmin } from '@/lib/admin';
import { money } from '@/app/stock/constants';
import { cardClass, dateOnly, errorBox, inputClass, labelClass, okBox, pageClass, primaryButton } from '@/lib/ui';
import { cancelAffiliateCommissions, reviewAffiliate, setAffiliateAnnualDiscount, setAffiliatePercentage, setAffiliateStatus, setAffiliateWithdrawalMin, updateWithdrawal } from '../actions';

const AFF: Record<string, string> = { pending: 'Pendiente', approved: 'Activa', suspended: 'Suspendida', rejected: 'Rechazada' };
const WD: Record<string, string> = { requested: 'Pedido', reviewing: 'En revisión', approved: 'Aprobado', paid: 'Pagado', rejected: 'Rechazado' };
const btn = 'rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700';

export default async function AdminAffiliatesPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const { supabase } = await requireAdmin();
  const since = new Date(new Date().getTime() - 30 * 86400000).toISOString().slice(0, 10);
  const [{ data: affiliates }, { data: withdrawals }, { data: commissions }, { data: visits }, { data: mins }, { data: adjustments }] = await Promise.all([
    supabase.from('affiliates').select('id,status,commission_percentage,is_pro,valid_sales_count,application_note,created_at,profiles(email,full_name),affiliate_codes(code,active)').order('created_at', { ascending: false }),
    supabase.from('withdrawals').select('id,amount,status,payout_method,payout_reference,requested_at,paid_at,affiliates(profiles(email))').order('requested_at', { ascending: false }).limit(100),
    supabase.from('commissions').select('affiliate_id,commission_amount,status'),
    supabase.from('affiliate_link_visits').select('affiliate_id,visits').gte('day', since),
    supabase.from('pricing_config').select('key,value_numeric').in('key', ['affiliate_min_withdrawal', 'affiliate_min_withdrawal_pro', 'affiliate_annual_discount_pct']),
    supabase.from('affiliate_adjustments').select('affiliate_id,amount').is('withdrawal_id', null),
  ]);
  const visits30 = new Map<string, number>();
  for (const v of visits ?? []) visits30.set(v.affiliate_id, (visits30.get(v.affiliate_id) ?? 0) + Number(v.visits));
  const min = (k: string, d: number) => Number(mins?.find((m) => m.key === k)?.value_numeric ?? d);
  const paidWithdrawals = (withdrawals ?? []).filter((w) => w.status === 'paid' || w.status === 'rejected').slice(0, 20);
  const totals = new Map<string, { held: number; available: number; paid: number }>();
  for (const c of commissions ?? []) {
    const t = totals.get(c.affiliate_id) ?? { held: 0, available: 0, paid: 0 };
    if (c.status === 'held') t.held += Number(c.commission_amount);
    if (c.status === 'available' || c.status === 'withdrawal_requested') t.available += Number(c.commission_amount);
    if (c.status === 'paid') t.paid += Number(c.commission_amount);
    totals.set(c.affiliate_id, t);
  }
  // Ventas devueltas después de cobrada la comisión: se descuentan del próximo retiro.
  const debts = new Map<string, number>();
  for (const d of adjustments ?? []) debts.set(d.affiliate_id, (debts.get(d.affiliate_id) ?? 0) - Number(d.amount));
  const pending = (affiliates ?? []).filter((a) => a.status === 'pending');
  const others = (affiliates ?? []).filter((a) => a.status !== 'pending');
  const openWithdrawals = (withdrawals ?? []).filter((w) => ['requested', 'reviewing', 'approved'].includes(w.status));

  return (
    <main className={pageClass}>
      <header>
        <Link href="/admin" className="text-sm text-neutral-500 dark:text-neutral-400">← Administración</Link>
        <h1 className="text-2xl font-semibold">Afiliadas</h1>
      </header>
      {ok && <div role="status" className={okBox}>{ok}</div>}
      {error && <div role="alert" className={errorBox}>{error}</div>}

      <section className={cardClass}>
        <h2 className="font-semibold">Solicitudes ({pending.length})</h2>
        {!pending.length ? <p className="mt-2 text-sm text-neutral-500">No hay solicitudes nuevas.</p> : pending.map((a) => (
          <div key={a.id} className="mt-3 border-t border-neutral-100 pt-3 text-sm dark:border-neutral-800">
            <p className="font-medium">{one(a.profiles)?.full_name || one(a.profiles)?.email} <span className="font-normal text-neutral-500">{one(a.profiles)?.email} · {dateOnly(a.created_at)}</span></p>
            {a.application_note && <p className="mt-1 text-neutral-600 dark:text-neutral-300">«{a.application_note}»</p>}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <form action={reviewAffiliate} className="flex items-center gap-2">
                <input type="hidden" name="affiliate_id" value={a.id} /><input type="hidden" name="decision" value="approve" />
                <select name="percentage" defaultValue="15" className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-950"><option value="15">15 %</option><option value="20">20 %</option></select>
                <SubmitButton className={btn}>Aprobar</SubmitButton>
              </form>
              <form action={reviewAffiliate}><input type="hidden" name="affiliate_id" value={a.id} /><input type="hidden" name="decision" value="reject" /><SubmitButton className={btn}>Rechazar</SubmitButton></form>
            </div>
          </div>
        ))}
      </section>

      <section className={cardClass}>
        <h2 className="font-semibold">Retiros por pagar ({openWithdrawals.length})</h2>
        {!openWithdrawals.length ? <p className="mt-2 text-sm text-neutral-500">No hay retiros pendientes.</p> : openWithdrawals.map((w) => (
          <div key={w.id} className="mt-3 border-t border-neutral-100 pt-3 text-sm dark:border-neutral-800">
            <p><strong>{money(w.amount)}</strong> a {one(one(w.affiliates)?.profiles)?.email} · {w.payout_method}: <span className="font-mono">{w.payout_reference}</span> · pedido el {dateOnly(w.requested_at)} · {WD[w.status]}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <form action={updateWithdrawal} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="withdrawal_id" value={w.id} /><input type="hidden" name="status" value="paid" />
                <input name="notes" placeholder="N.º de operación (opcional)" className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-950" />
                <SubmitButton className={btn}>Marcar como pagado</SubmitButton>
              </form>
              <form action={updateWithdrawal}><input type="hidden" name="withdrawal_id" value={w.id} /><input type="hidden" name="status" value="rejected" /><SubmitButton className={btn}>Rechazar</SubmitButton></form>
            </div>
            <p className="mt-1 text-xs text-neutral-500">Primero hacé la transferencia y después marcalo como pagado. Si lo rechazás, las comisiones vuelven a estar disponibles. El monto ya trae restadas las ventas devueltas, si las hubo.</p>
          </div>
        ))}
      </section>

      {paidWithdrawals.length > 0 && (
        <section className={cardClass}>
          <h2 className="font-semibold">Últimos retiros cerrados</h2>
          <ul className="mt-2 divide-y divide-neutral-100 text-sm dark:divide-neutral-800">{paidWithdrawals.map((w) => (
            <li key={w.id} className="flex flex-wrap justify-between gap-2 py-2"><span>{one(one(w.affiliates)?.profiles)?.email} · {w.payout_method}</span><span>{money(w.amount)} · {WD[w.status]}{w.paid_at ? ` el ${dateOnly(w.paid_at)}` : ''}</span></li>
          ))}</ul>
        </section>
      )}

      <form action={setAffiliateWithdrawalMin} className={`${cardClass} grid gap-3 sm:grid-cols-2`}>
        <h2 className="font-semibold sm:col-span-2">Mínimo para retirar</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 sm:col-span-2">Las afiliadas pueden pedir el retiro cuando juntan este monto disponible. Así evitás muchas transferencias chicas.</p>
        <label className={labelClass}>Afiliadas<input name="min" inputMode="numeric" required defaultValue={min('affiliate_min_withdrawal', 20000)} className={inputClass} /></label>
        <label className={labelClass}>Afiliadas PRO<input name="min_pro" inputMode="numeric" required defaultValue={min('affiliate_min_withdrawal_pro', 10000)} className={inputClass} /></label>
        <div className="sm:col-span-2"><SubmitButton className={primaryButton}>Guardar mínimos</SubmitButton></div>
      </form>

      <form action={setAffiliateAnnualDiscount} className={`${cardClass} grid gap-3 sm:grid-cols-2`}>
        <h2 className="font-semibold sm:col-span-2">Descuento del plan anual con código</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 sm:col-span-2">Quien contrata Personal Plus anual con el código o el enlace de una afiliada paga este porcentaje menos. Si ya tiene un descuento mayor (por antigüedad), vale ese. Poné 0 para no dar descuento.</p>
        <label className={labelClass}>Descuento (%)<input name="pct" inputMode="decimal" required defaultValue={min('affiliate_annual_discount_pct', 5)} className={inputClass} /></label>
        <div className="sm:col-span-2"><SubmitButton className={primaryButton}>Guardar descuento</SubmitButton></div>
      </form>

      <section className={cardClass}>
        <h2 className="font-semibold">Afiliadas</h2>
        {!others.length ? <p className="mt-2 text-sm text-neutral-500">Todavía no hay afiliadas.</p> : (
          <ul className="mt-2 divide-y divide-neutral-100 text-sm dark:divide-neutral-800">{others.map((a) => {
            const t = totals.get(a.id) ?? { held: 0, available: 0, paid: 0 };
            const code = (a.affiliate_codes ?? []).find((c) => c.active)?.code ?? (a.affiliate_codes ?? [])[0]?.code;
            return (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span><strong>{code ?? '—'}</strong> · {one(a.profiles)?.email} · {Number(a.commission_percentage)} %{a.is_pro ? ' · PRO' : ''} · {a.valid_sales_count} ventas · {visits30.get(a.id) ?? 0} visitas (30 días) · {AFF[a.status]}<br /><span className="text-xs text-neutral-500">retenido {money(t.held)} · disponible {money(t.available)} · pagado {money(t.paid)}{debts.get(a.id) ? ` · a descontar ${money(debts.get(a.id) ?? 0)} por ventas devueltas` : ''}</span></span>
                {(a.status === 'approved' || a.status === 'suspended') && (
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={setAffiliatePercentage} className="flex items-center gap-1">
                      <input type="hidden" name="affiliate_id" value={a.id} />
                      <input name="pct" inputMode="decimal" defaultValue={Number(a.commission_percentage)} aria-label="Comisión (%)" className="w-16 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-950" />
                      <SubmitButton className={btn}>Cambiar %</SubmitButton>
                    </form>
                    <form action={setAffiliateStatus}><input type="hidden" name="affiliate_id" value={a.id} /><input type="hidden" name="status" value={a.status === 'approved' ? 'suspended' : 'approved'} /><SubmitButton className={btn}>{a.status === 'approved' ? 'Suspender' : 'Reactivar'}</SubmitButton></form>
                  </div>
                )}
                {a.status === 'suspended' && (t.held > 0 || t.available > 0) && (
                  <form action={cancelAffiliateCommissions} className="flex w-full flex-wrap items-center gap-2 rounded-xl bg-red-50 p-2 text-xs dark:bg-red-950/30">
                    <input type="hidden" name="affiliate_id" value={a.id} />
                    <input name="reason" required minLength={5} placeholder="Motivo (por ejemplo, ventas falsas)" className="flex-1 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-950" />
                    <label className="flex items-center gap-1"><input type="checkbox" name="confirm" />Anular sus comisiones pendientes</label>
                    <SubmitButton className={btn}>Anular</SubmitButton>
                  </form>
                )}
              </li>
            );
          })}</ul>
        )}
      </section>
    </main>
  );
}
