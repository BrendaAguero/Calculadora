import Link from 'next/link';
import { one, requireAdmin } from '@/lib/admin';
import { money } from '@/app/stock/constants';
import { cardClass, dateOnly, errorBox, okBox, pageClass } from '@/lib/ui';
import { reviewAffiliate, setAffiliateStatus, updateWithdrawal } from '../actions';

const AFF: Record<string, string> = { pending: 'Pendiente', approved: 'Activa', suspended: 'Suspendida', rejected: 'Rechazada' };
const WD: Record<string, string> = { requested: 'Pedido', reviewing: 'En revisión', approved: 'Aprobado', paid: 'Pagado', rejected: 'Rechazado' };
const btn = 'rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700';

export default async function AdminAffiliatesPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const { supabase } = await requireAdmin();
  const [{ data: affiliates }, { data: withdrawals }, { data: commissions }] = await Promise.all([
    supabase.from('affiliates').select('id,status,commission_percentage,is_pro,valid_sales_count,application_note,created_at,profiles(email,full_name),affiliate_codes(code,active)').order('created_at', { ascending: false }),
    supabase.from('withdrawals').select('id,amount,status,payout_method,payout_reference,requested_at,paid_at,affiliates(profiles(email))').order('requested_at', { ascending: false }).limit(100),
    supabase.from('commissions').select('affiliate_id,commission_amount,status'),
  ]);
  const totals = new Map<string, { held: number; available: number; paid: number }>();
  for (const c of commissions ?? []) {
    const t = totals.get(c.affiliate_id) ?? { held: 0, available: 0, paid: 0 };
    if (c.status === 'held') t.held += Number(c.commission_amount);
    if (c.status === 'available' || c.status === 'withdrawal_requested') t.available += Number(c.commission_amount);
    if (c.status === 'paid') t.paid += Number(c.commission_amount);
    totals.set(c.affiliate_id, t);
  }
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
                <button className={btn}>Aprobar</button>
              </form>
              <form action={reviewAffiliate}><input type="hidden" name="affiliate_id" value={a.id} /><input type="hidden" name="decision" value="reject" /><button className={btn}>Rechazar</button></form>
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
                <button className={btn}>Marcar como pagado</button>
              </form>
              <form action={updateWithdrawal}><input type="hidden" name="withdrawal_id" value={w.id} /><input type="hidden" name="status" value="rejected" /><button className={btn}>Rechazar</button></form>
            </div>
            <p className="mt-1 text-xs text-neutral-500">Primero hacé la transferencia y después marcalo como pagado. Si lo rechazás, las comisiones vuelven a estar disponibles.</p>
          </div>
        ))}
      </section>

      <section className={cardClass}>
        <h2 className="font-semibold">Afiliadas</h2>
        {!others.length ? <p className="mt-2 text-sm text-neutral-500">Todavía no hay afiliadas.</p> : (
          <ul className="mt-2 divide-y divide-neutral-100 text-sm dark:divide-neutral-800">{others.map((a) => {
            const t = totals.get(a.id) ?? { held: 0, available: 0, paid: 0 };
            const code = (a.affiliate_codes ?? []).find((c) => c.active)?.code ?? (a.affiliate_codes ?? [])[0]?.code;
            return (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span><strong>{code ?? '—'}</strong> · {one(a.profiles)?.email} · {Number(a.commission_percentage)} %{a.is_pro ? ' · PRO' : ''} · {a.valid_sales_count} ventas · {AFF[a.status]}<br /><span className="text-xs text-neutral-500">retenido {money(t.held)} · disponible {money(t.available)} · pagado {money(t.paid)}</span></span>
                {(a.status === 'approved' || a.status === 'suspended') && (
                  <form action={setAffiliateStatus}><input type="hidden" name="affiliate_id" value={a.id} /><input type="hidden" name="status" value={a.status === 'approved' ? 'suspended' : 'approved'} /><button className={btn}>{a.status === 'approved' ? 'Suspender' : 'Reactivar'}</button></form>
                )}
              </li>
            );
          })}</ul>
        )}
      </section>
    </main>
  );
}
