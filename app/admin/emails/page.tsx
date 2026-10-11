import Link from 'next/link';
import { SubmitButton } from '@/components/submit-button';
import { requireAdmin } from '@/lib/admin';
import { cardClass, dateTime, errorBox, inputClass, labelClass, okBox, pageClass, primaryButton } from '@/lib/ui';
import { CopyButton } from '@/components/copy-button';
import { decryptKey } from '@/lib/access-key';
import { mailReady } from '@/lib/mail';
import { createAdminClient } from '@/lib/supabase/admin';
import { adminReleaseDevice, approveEmail, newAccessKey, resendAccessKey, revokeEmail } from '../actions';

const SOURCES: Record<string, string> = { transferencia: 'Transferencia', mercadolibre: 'MercadoLibre', online: 'Online (Mercado Pago)', revendedora: 'Revendedora', cortesia: 'Cortesía' };
const btn = 'rounded-lg border border-neutral-300 px-3 py-1.5 text-xs dark:border-neutral-700';

export default async function AdminEmailsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; q?: string }> }) {
  const { ok, error, q } = await searchParams;
  const { supabase } = await requireAdmin();
  let query = supabase.from('approved_emails').select('id,email,source,status,note,user_id,created_at').order('created_at', { ascending: false }).limit(200);
  if (q) query = query.ilike('email', `%${q.replace(/[%_]/g, '')}%`);
  // Las claves se leen con el cliente del servidor (la columna cifrada no es visible para nadie más).
  const admin = createAdminClient();
  const [{ data: emails }, { data: devices }, { data: orders }, { data: keys }] = await Promise.all([
    query,
    supabase.from('user_devices').select('id,user_id,label,last_seen_at').is('released_at', null),
    supabase.from('personal_orders').select('id,email,total,status,created_at').order('created_at', { ascending: false }).limit(20),
    admin ? admin.from('approved_emails').select('id,key_cipher') : Promise.resolve({ data: [] as { id: string; key_cipher: string | null }[] }),
  ]);
  const keyOf = (id: string) => decryptKey(keys?.find((k) => k.id === id)?.key_cipher);

  return (
    <main className={pageClass}>
      <header>
        <Link href="/admin" className="text-sm text-neutral-500 dark:text-neutral-400">← Administración</Link>
        <h1 className="text-2xl font-semibold">Edición Personal: emails aprobados</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Solo pueden entrar los emails de esta lista. Las compras online se aprueban solas; las de transferencia y MercadoLibre las aprobás acá.</p>
      </header>
      {ok && <div role="status" className={okBox}>{ok}</div>}
      {error && <div role="alert" className={errorBox}>{error}</div>}

      <form action={approveEmail} className={`${cardClass} grid gap-3 sm:grid-cols-3`}>
        <h2 className="font-semibold sm:col-span-3">Aprobar un email</h2>
        <label className={labelClass}>Email<input name="email" type="email" required className={inputClass} /></label>
        <label className={labelClass}>Cómo pagó
          <select name="source" className={inputClass} defaultValue="transferencia">
            {Object.entries(SOURCES).filter(([key]) => key !== 'online').map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label className={labelClass}>Nota (opcional)<input name="note" maxLength={500} placeholder="Ej.: venta ML #123, transferencia 12/10" className={inputClass} /></label>
        <div className="sm:col-span-3"><SubmitButton className={primaryButton}>Aprobar</SubmitButton></div>
        <p className="text-xs text-neutral-500 sm:col-span-3">Al aprobar se crea su <strong>clave de acceso</strong>{mailReady() ? ' y se la mandamos por correo' : ''}. También la ves abajo para copiarla y mandarla por mensaje (por ejemplo, en MercadoLibre).</p>
        {!mailReady() && <p className="text-xs text-amber-700 dark:text-amber-300 sm:col-span-3">El envío automático por correo todavía no está configurado: mandá la clave a mano.</p>}
      </form>

      <section className={cardClass}>
        <form className="flex gap-2"><input name="q" defaultValue={q ?? ''} placeholder="Buscar email" className={inputClass} /><button className={btn}>Buscar</button></form>
        <ul className="mt-3 divide-y divide-neutral-100 text-sm dark:divide-neutral-800">
          {(emails ?? []).map((row) => {
            const own = (devices ?? []).filter((d) => d.user_id && d.user_id === row.user_id);
            return (
              <li key={row.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span><strong>{row.email}</strong> <span className="text-neutral-500">· {SOURCES[row.source] ?? row.source} · {dateTime(row.created_at)}</span>
                    {row.status === 'revoked' && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800 dark:bg-red-950 dark:text-red-200">Revocado</span>}
                    {!row.user_id && row.status === 'approved' && <span className="ml-2 text-xs text-neutral-500">(todavía no entró)</span>}
                  </span>
                  {row.status === 'approved' && <form action={revokeEmail}><input type="hidden" name="id" value={row.id} /><SubmitButton className={btn}>Revocar</SubmitButton></form>}
                </div>
                {row.note && <p className="text-xs text-neutral-500">{row.note}</p>}
                {row.status === 'approved' && (
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    {keyOf(row.id) ? <><span>Clave: <strong className="font-mono text-sm">{keyOf(row.id)}</strong></span><CopyButton text={keyOf(row.id)!} label="Copiar clave" /></> : <span className="text-neutral-500">Sin clave</span>}
                    {keyOf(row.id) && mailReady() && <form action={resendAccessKey}><input type="hidden" name="id" value={row.id} /><SubmitButton className="underline">Reenviar por correo</SubmitButton></form>}
                    <form action={newAccessKey}><input type="hidden" name="id" value={row.id} /><input type="hidden" name="email" value={row.email} /><input type="hidden" name="send" value={mailReady() ? '1' : '0'} /><SubmitButton className="underline">{keyOf(row.id) ? 'Cambiar clave (solo si se filtró)' : 'Crear clave'}</SubmitButton></form>
                  </div>
                )}
                {own.length > 0 && (
                  <ul className="mt-1 space-y-1 text-xs">
                    {own.map((d) => (
                      <li key={d.id} className="flex items-center gap-2">📱 {d.label ?? 'Aparato'} · último uso {dateTime(d.last_seen_at)}
                        <form action={adminReleaseDevice}><input type="hidden" name="device_id" value={d.id} /><SubmitButton className="underline">liberar</SubmitButton></form>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
          {!emails?.length && <li className="py-3 text-neutral-500">No hay emails aprobados todavía.</li>}
        </ul>
      </section>

      <section className={cardClass}>
        <h2 className="font-semibold">Últimos pedidos online</h2>
        <ul className="mt-2 divide-y divide-neutral-100 text-sm dark:divide-neutral-800">
          {(orders ?? []).map((o) => <li key={o.id} className="py-2">{o.email} · ${Number(o.total).toLocaleString('es-AR')} · {o.status === 'approved' ? 'Pagado' : o.status === 'pending' ? 'Sin pagar' : o.status} · {dateTime(o.created_at)}</li>)}
          {!orders?.length && <li className="py-2 text-neutral-500">Sin pedidos todavía.</li>}
        </ul>
      </section>
    </main>
  );
}
