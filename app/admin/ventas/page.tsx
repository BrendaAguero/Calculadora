import Link from 'next/link';
import { one, requireAdmin } from '@/lib/admin';
import { money } from '@/app/stock/constants';
import { cardClass, dateTime, errorBox, pageClass } from '@/lib/ui';

const TYPE: Record<string, string> = { license: 'Licencia', license_upgrade: 'Upgrade de licencia', activity: 'Actividad', module: 'Módulo', subscription_initial: 'Emprendedor', subscription_renewal: 'Emprendedor (renovación)' };
const PAY: Record<string, string> = { pending: 'Pendiente', approved: 'Aprobado', rejected: 'Rechazado', canceled: 'Cancelado', refunded: 'Reembolsado' };

export default async function AdminSalesPage() {
  const { supabase } = await requireAdmin();
  const [{ data: purchases, error }, { data: subscriptions }] = await Promise.all([
    supabase.from('purchases').select('id,product_type,total,discount_amount,payment_provider,payment_status,payment_reference,created_at,profiles(email)').order('created_at', { ascending: false }).limit(200),
    supabase.from('subscriptions').select('id,duration_months,status,start_at,expires_at,auto_renew,final_price,profiles(email)').in('status', ['active', 'pending']).order('expires_at', { ascending: false }).limit(200),
  ]);
  const approved = (purchases ?? []).filter((p) => p.payment_status === 'approved');
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const thisMonth = approved.filter((p) => new Date(p.created_at) >= monthStart).reduce((acc, p) => acc + Number(p.total), 0);
  const now = new Date();

  return (
    <main className={pageClass}>
      <header>
        <Link href="/admin" className="text-sm text-neutral-500 dark:text-neutral-400">← Administración</Link>
        <h1 className="text-2xl font-semibold">Ventas de la plataforma</h1>
      </header>
      {error && <div role="alert" className={errorBox}>{error.message}</div>}
      <section className="grid grid-cols-2 gap-3">
        <div className={cardClass}><p className="text-xs text-neutral-500">Cobrado este mes</p><p className="mt-1 text-xl font-semibold">{money(thisMonth)}</p></div>
        <div className={cardClass}><p className="text-xs text-neutral-500">Emprendedor activos</p><p className="mt-1 text-xl font-semibold">{(subscriptions ?? []).filter((s) => s.status === 'active' && new Date(s.expires_at) > now).length}</p></div>
      </section>

      <section className={cardClass}>
        <h2 className="font-semibold">Compras</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-neutral-500"><tr><th className="py-1 pr-2 font-normal">Fecha</th><th className="pr-2 font-normal">Cuenta</th><th className="pr-2 font-normal">Qué</th><th className="pr-2 font-normal">Pago</th><th className="text-right font-normal">Total</th></tr></thead>
            <tbody>{(purchases ?? []).map((p) => (
              <tr key={p.id} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className="py-2 pr-2 whitespace-nowrap">{dateTime(p.created_at)}</td>
                <td className="pr-2">{one(p.profiles)?.email}</td>
                <td className="pr-2">{TYPE[p.product_type] ?? p.product_type}</td>
                <td className="pr-2">{PAY[p.payment_status] ?? p.payment_status} · {p.payment_provider === 'mercadopago' ? 'Mercado Pago' : p.payment_provider}</td>
                <td className="text-right">{money(p.total)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section className={cardClass}>
        <h2 className="font-semibold">Suscripciones Emprendedor (activas y pendientes)</h2>
        <ul className="mt-2 divide-y divide-neutral-100 text-sm dark:divide-neutral-800">{(subscriptions ?? []).map((s) => (
          <li key={s.id} className="flex flex-wrap justify-between gap-2 py-2">
            <span>{one(s.profiles)?.email} · {s.duration_months === 1 ? 'mensual' : `${s.duration_months} meses`}{s.auto_renew ? ' · renueva' : ''}</span>
            <span>{s.status === 'pending' ? 'pendiente de pago' : `${dateTime(s.start_at)} → ${dateTime(s.expires_at)}`} · {money(s.final_price)}</span>
          </li>
        ))}</ul>
      </section>
    </main>
  );
}
