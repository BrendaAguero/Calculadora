import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { activateSubscription } from './actions';

type Request = { subscription_id: string; user_email: string; user_name: string | null; months: number; price: number; discount_pct: number; final_price: number; base_plan: string; requested_at: string };

const money = (value: number | string) => Number(value).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

export default async function AdminEntrepreneurPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) notFound();

  const { data, error: loadError } = await supabase.rpc('admin_list_entrepreneur_requests');
  const requests = (data ?? []) as Request[];

  return (
    <main className="min-h-screen bg-neutral-50 px-5 py-8 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <Link href="/access" className="text-sm underline">← Licencia y acceso</Link>
          <h1 className="mt-3 text-3xl font-semibold">Pedidos de Emprendedor</h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">Todavía no hay cobro automático. Activá un pedido cuando hayas recibido el pago. Si la persona ya tiene Emprendedor, el tiempo se suma al final.</p>
        </div>

        {ok && <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">{ok}</div>}
        {(error || loadError) && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{error ?? `No se pudieron cargar los pedidos: ${loadError!.message}`}</div>}

        {!requests.length && !loadError ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">No hay pedidos pendientes.</div>
        ) : (
          <section className="grid gap-3">
            {requests.map((request) => (
              <div key={request.subscription_id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                <p className="font-medium">{request.user_name || request.user_email}</p>
                {request.user_name && <p className="text-sm text-neutral-500">{request.user_email}</p>}
                <p className="mt-2 text-sm">
                  {request.months === 1 ? '1 mes' : `${request.months} meses`} · plan base {request.base_plan === 'ADVANCED' ? 'Avanzado' : 'Básico'} · <strong>{money(request.final_price)}</strong>
                  {Number(request.discount_pct) > 0 && <span className="text-neutral-500"> (precio {money(request.price)}, {Number(request.discount_pct)} % de descuento)</span>}
                </p>
                <p className="text-xs text-neutral-500">Pedido el {new Date(request.requested_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</p>
                <form action={activateSubscription} className="mt-3">
                  <input type="hidden" name="subscription_id" value={request.subscription_id} />
                  <button type="submit" className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">Activar (pago recibido)</button>
                </form>
              </div>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
