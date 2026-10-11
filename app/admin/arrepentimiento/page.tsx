import Link from 'next/link';
import { SubmitButton } from '@/components/submit-button';
import { requireAdmin } from '@/lib/admin';
import { cardClass, dateOnly, dateTime, errorBox, inputClass, okBox, pageClass } from '@/lib/ui';
import { resolveRegret } from '../actions';

const STATUS: Record<string, string> = { received: 'Recibido', refunded: 'Devuelto', rejected: 'Rechazado' };
const btn = 'rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700';

export default async function AdminRegretPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const { supabase } = await requireAdmin();
  const { data: requests } = await supabase.from('regret_requests').select('id,code,full_name,email,purchase_reference,purchase_date,details,status,admin_note,created_at,resolved_at').order('created_at', { ascending: false }).limit(200);
  const open = (requests ?? []).filter((r) => r.status === 'received');
  const closed = (requests ?? []).filter((r) => r.status !== 'received');

  return (
    <main className={pageClass}>
      <header>
        <Link href="/admin" className="text-sm text-neutral-500 dark:text-neutral-400">← Administración</Link>
        <h1 className="text-2xl font-semibold">Botón de arrepentimiento</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Buscá la compra en <Link href="/admin/ventas" className="underline">Ventas</Link>, devolvé el dinero desde Mercado Pago y marcá el pedido. Al devolver en Mercado Pago, lo comprado se desactiva solo.</p>
      </header>
      {ok && <div role="status" className={okBox}>{ok}</div>}
      {error && <div role="alert" className={errorBox}>{error}</div>}

      <section className={cardClass}>
        <h2 className="font-semibold">Pendientes ({open.length})</h2>
        {!open.length ? <p className="mt-2 text-sm text-neutral-500">No hay pedidos pendientes.</p> : open.map((r) => (
          <div key={r.id} className="mt-3 border-t border-neutral-100 pt-3 text-sm dark:border-neutral-800">
            <p className="font-medium">{r.full_name} <span className="font-normal text-neutral-500">{r.email}</span></p>
            <p className="text-neutral-500"><span className="font-mono">{r.code}</span> · pedido el {dateTime(r.created_at)}{r.purchase_date ? ` · compra del ${dateOnly(r.purchase_date + 'T12:00:00Z')}` : ''}</p>
            {r.purchase_reference && <p className="mt-1">Compra: {r.purchase_reference}</p>}
            {r.details && <p className="mt-1 text-neutral-600 dark:text-neutral-300">«{r.details}»</p>}
            <form action={resolveRegret} className="mt-2 flex flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={r.id} />
              <input name="note" maxLength={1000} placeholder="Nota (opcional)" className={`${inputClass} max-w-xs`} />
              <SubmitButton name="status" value="refunded" className={btn}>Devuelto</SubmitButton>
              <SubmitButton name="status" value="rejected" className={btn}>Rechazar</SubmitButton>
            </form>
          </div>
        ))}
      </section>

      {closed.length > 0 && (
        <section className={cardClass}>
          <h2 className="font-semibold">Resueltos</h2>
          {closed.map((r) => (
            <p key={r.id} className="mt-2 border-t border-neutral-100 pt-2 text-sm dark:border-neutral-800">
              <span className="font-mono">{r.code}</span> · {r.full_name} · {STATUS[r.status] ?? r.status}{r.resolved_at ? ` el ${dateOnly(r.resolved_at)}` : ''}{r.admin_note ? ` · ${r.admin_note}` : ''}
            </p>
          ))}
        </section>
      )}
    </main>
  );
}
