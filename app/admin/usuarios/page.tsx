import Link from 'next/link';
import { SubmitButton } from '@/components/submit-button';
import { requireAdmin } from '@/lib/admin';
import { cardClass, dateOnly, errorBox, inputClass, okBox, pageClass } from '@/lib/ui';
import { createAdminClient } from '@/lib/supabase/admin';
import { grantLicense, setAccountStatus, setMaxFreeAccounts } from '../actions';

const STATUS: Record<string, string> = { active: 'Activa', suspended: 'Suspendida', blocked: 'Bloqueada' };

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; ok?: string; error?: string }> }) {
  const { q, ok, error } = await searchParams;
  const { supabase, userId } = await requireAdmin();

  let query = supabase.from('profiles').select('id,email,full_name,role,account_status,is_tester,created_at').order('created_at', { ascending: false }).limit(200);
  if (q) query = query.ilike('email', `%${q.replace(/[%_]/g, '')}%`);
  const { data: users, error: loadError } = await query;
  // Cuántas cuentas gratis hay y el tope (la cuenta la hace la base; solo la administración llega acá).
  const adminClient = createAdminClient();
  const freeStatus = adminClient ? ((await adminClient.rpc('free_accounts_status')).data as { count: number; max: number | null; open: boolean } | null) : null;
  const ids = (users ?? []).map((u) => u.id);
  const now = new Date().toISOString();
  const [{ data: licenses }, { data: subscriptions }] = ids.length
    ? await Promise.all([
      supabase.from('licenses').select('user_id,plans(code),dev_grant_id,expires_at').eq('status', 'active').in('user_id', ids).or(`expires_at.is.null,expires_at.gt.${now}`),
      supabase.from('subscriptions').select('user_id,expires_at').eq('status', 'active').gt('expires_at', now).in('user_id', ids),
    ])
    : [{ data: [] }, { data: [] }];
  const plan = new Map((licenses ?? []).map((l) => [l.user_id, `Edición Personal${l.dev_grant_id ? ' (cortesía' + (l.expires_at ? `, vence el ${dateOnly(l.expires_at)}` : '') + ')' : ''}`]));
  const until = new Map<string, string>();
  for (const s of subscriptions ?? []) if (!until.has(s.user_id) || until.get(s.user_id)! < s.expires_at) until.set(s.user_id, s.expires_at);

  return (
    <main className={pageClass}>
      <header>
        <Link href="/admin" className="text-sm text-neutral-500 dark:text-neutral-400">← Administración</Link>
        <h1 className="text-2xl font-semibold">Usuarios</h1>
      </header>
      {ok && <div role="status" className={okBox}>{ok}</div>}
      {(error || loadError) && <div role="alert" className={errorBox}>{error ?? loadError!.message}</div>}
      <section className={cardClass}>
        <h2 className="font-semibold">Tope de cuentas gratis</h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Hoy hay <strong>{freeStatus?.count ?? '—'}</strong> cuentas gratis{freeStatus?.max != null ? <> de un máximo de <strong>{freeStatus.max}</strong></> : ' (sin tope)'}.
          {freeStatus?.open === false && <strong className="text-amber-700 dark:text-amber-400"> El registro gratis está cerrado.</strong>}
          {' '}Cuando se llena, nadie más puede crear una cuenta gratis; quien quiere comprar la Edición Personal o contratar Personal Plus pasa igual. Dejalo vacío para no tener tope.
        </p>
        <form action={setMaxFreeAccounts} className="mt-3 flex flex-wrap gap-2">
          <input name="max" inputMode="numeric" defaultValue={freeStatus?.max ?? ''} placeholder="Sin tope" className={`${inputClass} max-w-[10rem]`} />
          <SubmitButton className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">Guardar</SubmitButton>
        </form>
      </section>
      <form method="get" className="flex gap-2"><input name="q" defaultValue={q ?? ''} placeholder="Buscar por email" className={inputClass} /><SubmitButton className="rounded-xl border border-neutral-300 px-4 text-sm dark:border-neutral-700">Buscar</SubmitButton></form>

      <section className="grid gap-3">
        {(users ?? []).map((u) => (
          <article key={u.id} className={cardClass}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-medium">{u.full_name || u.email}</h2>
                <p className="text-sm text-neutral-500">{u.email}{u.role === 'admin' ? ' · administradora' : ''}{u.is_tester ? ' · cuenta de prueba' : ''}</p>
                <p className="mt-1 text-sm">Licencia: {plan.get(u.id) ?? 'sin licencia'} · Personal Plus: {until.has(u.id) ? `hasta ${dateOnly(until.get(u.id)!)}` : 'no'} · alta {dateOnly(u.created_at)}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs ${u.account_status === 'active' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200'}`}>{STATUS[u.account_status] ?? u.account_status}</span>
            </div>
            {u.id !== userId && (
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-neutral-500">Acciones</summary>
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <form action={setAccountStatus}>
                    <input type="hidden" name="user_id" value={u.id} />
                    <input type="hidden" name="status" value={u.account_status === 'active' ? 'suspended' : 'active'} />
                    <SubmitButton className="rounded-lg border border-neutral-300 px-3 py-1.5 dark:border-neutral-700">{u.account_status === 'active' ? 'Suspender cuenta' : 'Reactivar cuenta'}</SubmitButton>
                  </form>
                  {!plan.has(u.id) && (
                    <form action={grantLicense} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="user_id" value={u.id} />
                      <input type="hidden" name="plan" value="ADVANCED" />
                      <label className="grid gap-0.5 text-xs text-neutral-500">Duración
                        <select name="months" defaultValue="1" className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"><option value="1">1 mes</option><option value="2">2 meses</option><option value="0">Sin vencimiento</option></select>
                      </label>
                      <input name="reason" placeholder="Motivo" maxLength={120} className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-950" />
                      <SubmitButton className="rounded-lg border border-neutral-300 px-3 py-1.5 dark:border-neutral-700">Dar Edición Personal gratis</SubmitButton>
                    </form>
                  )}
                </div>
                <p className="mt-1 text-xs text-neutral-500">Suspender no borra datos: la cuenta pierde el acceso a las funciones hasta que la reactives.</p>
              </details>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
