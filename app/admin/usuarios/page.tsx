import Link from 'next/link';
import { SubmitButton } from '@/components/submit-button';
import { one, requireAdmin } from '@/lib/admin';
import { cardClass, dateOnly, errorBox, inputClass, okBox, pageClass } from '@/lib/ui';
import { grantLicense, setAccountStatus } from '../actions';

const STATUS: Record<string, string> = { active: 'Activa', suspended: 'Suspendida', blocked: 'Bloqueada' };

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; ok?: string; error?: string }> }) {
  const { q, ok, error } = await searchParams;
  const { supabase, userId } = await requireAdmin();

  let query = supabase.from('profiles').select('id,email,full_name,role,account_status,is_tester,created_at').order('created_at', { ascending: false }).limit(200);
  if (q) query = query.ilike('email', `%${q.replace(/[%_]/g, '')}%`);
  const { data: users, error: loadError } = await query;
  const ids = (users ?? []).map((u) => u.id);
  const now = new Date().toISOString();
  const [{ data: licenses }, { data: subscriptions }] = ids.length
    ? await Promise.all([
      supabase.from('licenses').select('user_id,plans(code),dev_grant_id').eq('status', 'active').in('user_id', ids),
      supabase.from('subscriptions').select('user_id,expires_at').eq('status', 'active').gt('expires_at', now).in('user_id', ids),
    ])
    : [{ data: [] }, { data: [] }];
  const plan = new Map((licenses ?? []).map((l) => [l.user_id, `${one(l.plans)?.code === 'ADVANCED' ? 'Avanzado' : 'Básico'}${l.dev_grant_id ? ' (cortesía)' : ''}`]));
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
      <form method="get" className="flex gap-2"><input name="q" defaultValue={q ?? ''} placeholder="Buscar por email" className={inputClass} /><SubmitButton className="rounded-xl border border-neutral-300 px-4 text-sm dark:border-neutral-700">Buscar</SubmitButton></form>

      <section className="grid gap-3">
        {(users ?? []).map((u) => (
          <article key={u.id} className={cardClass}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-medium">{u.full_name || u.email}</h2>
                <p className="text-sm text-neutral-500">{u.email}{u.role === 'admin' ? ' · administradora' : ''}{u.is_tester ? ' · cuenta de prueba' : ''}</p>
                <p className="mt-1 text-sm">Licencia: {plan.get(u.id) ?? 'sin licencia'} · Emprendedor: {until.has(u.id) ? `hasta ${dateOnly(until.get(u.id)!)}` : 'no'} · alta {dateOnly(u.created_at)}</p>
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
                      <select name="plan" className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-950"><option value="BASIC">Básico</option><option value="ADVANCED">Avanzado</option></select>
                      <input name="reason" placeholder="Motivo" maxLength={120} className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-950" />
                      <SubmitButton className="rounded-lg border border-neutral-300 px-3 py-1.5 dark:border-neutral-700">Dar licencia de cortesía</SubmitButton>
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
