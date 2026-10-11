import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Store, Users } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { SubmitButton } from '@/components/submit-button';
import { createClient } from '@/lib/supabase/server';
import { getAccessSnapshot } from '@/lib/access/permissions';
import { dateOnly, errorBox, inputClass, okBox } from '@/lib/ui';
import { addClient, becomeReseller, buyPack, cancelClient } from './actions';

const pesos = (value: number) => value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const card = 'rounded-3xl bg-white p-5 dark:bg-neutral-900';
const PACKS = [5, 10, 20];
const STATUS: Record<string, string> = { pending: 'Esperando aprobación', approved: 'Aprobada · ya tiene su clave', rejected: 'No aprobada' };

export default async function ResellerPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const [snapshot, { data: account }, { data: price }, { data: retail }] = await Promise.all([
    getAccessSnapshot(),
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
            `Comprás licencias en paquetes de 5, 10 o 20 a ${pesos(unit)} cada una (el precio al público es ${pesos(retailPrice)}).`,
            'Cobrás a tus clientas como quieras y cargás su email acá.',
            'La administradora aprueba cada email y tu clienta recibe su clave de acceso por correo.',
          ].map((text, i) => <li key={i} className={`${card} flex gap-3`}><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-orange-100 text-sm font-bold text-orange-800 dark:bg-orange-950 dark:text-orange-300">{i + 1}</span>{text}</li>)}
        </ol>
        {snapshot?.baseLicenseActive || snapshot?.isAdmin
          ? <form action={becomeReseller} className="mt-5"><SubmitButton className="rounded-2xl bg-resina px-5 py-3 font-bold text-resina-dark">Activar el modo revendedora (gratis)</SubmitButton></form>
          : <p className="mt-5"><Link href="/comprar" className="underline">Primero necesitás la Edición Personal.</Link></p>}
      </AppShell>
    );
  }

  const [{ data: balance }, { data: clients }, { data: orders }] = await Promise.all([
    supabase.rpc('my_reseller_balance'),
    supabase.from('reseller_clients').select('id,email,full_name,status,note,created_at').eq('reseller_id', user.id).order('created_at', { ascending: false }).limit(200),
    supabase.from('reseller_orders').select('id,quantity,total,status,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
  ]);
  const left = Number(balance ?? 0);

  return (
    <AppShell>
      <header className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-resina text-resina-dark"><Store size={24} aria-hidden="true" /></span>
        <div><h1 className="text-3xl">Revendedora</h1><p className="text-sm text-neutral-500 dark:text-neutral-400">Tus licencias y tus clientas</p></div>
      </header>
      {messages}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <section className="terrazo-borde rounded-4xl bg-orange-800 p-6 text-white dark:bg-orange-900">
          <p className="text-sm text-white/75">Licencias disponibles</p>
          <p className="mt-1 font-display text-6xl font-bold">{left}</p>
          <p className="mt-2 text-sm text-white/75">Cada clienta que cargás usa una. Si no se aprueba o la cancelás, vuelve a tu saldo.</p>
        </section>
        <section className={card}>
          <h2 className="text-lg">Comprar licencias</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{pesos(unit)} cada una (al público: {pesos(retailPrice)}).</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {PACKS.map((q) => (
              <form key={q} action={buyPack}>
                <input type="hidden" name="quantity" value={q} />
                <SubmitButton className="w-full rounded-2xl border border-neutral-200 p-3 text-center hover:border-orange-600 dark:border-neutral-700">
                  <span className="block font-display text-2xl font-bold">{q}</span>
                  <span className="block text-xs text-neutral-500 dark:text-neutral-400">{pesos(unit * q)}</span>
                </SubmitButton>
              </form>
            ))}
          </div>
        </section>
      </div>

      <section className={`mt-4 ${card}`}>
        <h2 className="flex items-center gap-2 text-lg"><Users size={20} aria-hidden="true" />Cargar una clienta</h2>
        <form action={addClient} className="mt-3 grid gap-3 sm:grid-cols-[1.3fr_1fr_auto]">
          <label className="text-sm font-medium">Email de la clienta<input name="email" type="email" required className={`mt-1 ${inputClass}`} placeholder="clienta@email.com" /></label>
          <label className="text-sm font-medium">Nombre (opcional)<input name="full_name" maxLength={120} className={`mt-1 ${inputClass}`} /></label>
          <div className="flex items-end"><SubmitButton className="w-full rounded-xl bg-orange-800 px-4 py-2.5 font-semibold text-white disabled:opacity-60">Cargar</SubmitButton></div>
        </form>
        {left <= 0 && <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">No te quedan licencias: comprá un paquete para cargar más clientas.</p>}
      </section>

      <section className="mt-4">
        <h2 className="mb-2 px-1 text-lg">Mis clientas</h2>
        <div className="divide-y divide-neutral-100 rounded-3xl bg-white px-5 dark:divide-neutral-800 dark:bg-neutral-900">
          {(clients ?? []).map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <div><p className="font-medium">{c.full_name ? `${c.full_name} · ` : ''}{c.email}</p><p className="text-xs text-neutral-500 dark:text-neutral-400">{dateOnly(c.created_at)} · {STATUS[c.status] ?? c.status}{c.note ? ` · ${c.note}` : ''}</p></div>
              {c.status === 'pending' && <form action={cancelClient}><input type="hidden" name="id" value={c.id} /><SubmitButton className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs dark:border-neutral-700">Cancelar</SubmitButton></form>}
            </div>
          ))}
          {!clients?.length && <p className="py-5 text-sm text-neutral-500 dark:text-neutral-400">Todavía no cargaste clientas.</p>}
        </div>
      </section>

      {(orders ?? []).length > 0 && (
        <section className="mt-4">
          <h2 className="mb-2 px-1 text-lg">Mis compras</h2>
          <div className="divide-y divide-neutral-100 rounded-3xl bg-white px-5 text-sm dark:divide-neutral-800 dark:bg-neutral-900">
            {orders!.map((o) => <p key={o.id} className="py-3">{o.quantity} licencias · {pesos(Number(o.total))} · {o.status === 'approved' ? 'Pagado' : o.status === 'pending' ? 'Sin pagar' : o.status === 'refunded' ? 'Devuelto' : 'Cancelado'} · {dateOnly(o.created_at)}</p>)}
          </div>
        </section>
      )}
    </AppShell>
  );
}
