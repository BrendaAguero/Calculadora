import Link from 'next/link';
import { SubmitButton } from '@/components/submit-button';
import { requireAdmin } from '@/lib/admin';
import { STAFF_LOGIN_PATH } from '@/lib/staff';
import { siteOrigin } from '@/lib/origin';
import { cardClass, errorBox, inputClass, okBox, pageClass, primaryButton } from '@/lib/ui';
import { setModerator } from '../actions';

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const { supabase } = await requireAdmin();
  const [{ data: team }, origin] = await Promise.all([
    supabase.from('profiles').select('id,email,full_name,role').in('role', ['admin', 'moderator']).order('role'),
    siteOrigin(),
  ]);

  return (
    <main className={pageClass}>
      <header>
        <Link href="/admin" className="text-sm text-neutral-500 dark:text-neutral-400">← Administración</Link>
        <h1 className="text-2xl font-semibold">Equipo</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Las moderadoras solo moderan la Comunidad: ocultan publicaciones o comentarios, revisan denuncias, destacan y pausan a alguien por unos días. No ven ventas, precios ni cuentas, y no pueden cambiar nada más.</p>
      </header>
      {ok && <div role="status" className={okBox}>{ok}</div>}
      {error && <div role="alert" className={errorBox}>{error}</div>}

      <section className={cardClass}>
        <h2 className="font-semibold">Sumar una moderadora</h2>
        <p className="mt-1 text-sm text-neutral-500">La persona tiene que haber entrado a la app al menos una vez con ese email.</p>
        <form action={setModerator} className="mt-3 flex flex-wrap gap-2">
          <input type="hidden" name="moderator" value="1" />
          <input name="email" type="email" required placeholder="email@ejemplo.com" className={`${inputClass} max-w-xs`} />
          <SubmitButton className={primaryButton}>Hacerla moderadora</SubmitButton>
        </form>
      </section>

      <section className={cardClass}>
        <h2 className="font-semibold">Ingreso del equipo</h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">No aparece en ningún menú. Pasáselo solo a tu equipo. Se entra con email y contraseña, y la sesión dura 12 horas:</p>
        <p className="mt-2 break-all rounded-xl bg-neutral-100 px-3 py-2 font-mono text-sm dark:bg-neutral-800">{origin}{STAFF_LOGIN_PATH}</p>
        <p className="mt-2 text-xs text-neutral-500">Si alguien no tiene contraseña, entra a la app como siempre y la crea desde ese mismo ingreso («crear contraseña»).</p>
      </section>

      <section className="grid gap-2">
        <h2 className="font-semibold">Quiénes están</h2>
        {(team ?? []).map((p) => (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-neutral-200 bg-white p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div><p className="font-medium">{p.full_name || p.email}</p><p className="text-xs text-neutral-500">{p.email} · {p.role === 'admin' ? 'Administración' : 'Moderadora'}</p></div>
            {p.role === 'moderator' && (
              <form action={setModerator}>
                <input type="hidden" name="moderator" value="0" /><input type="hidden" name="email" value={p.email ?? ''} />
                <SubmitButton className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs dark:border-neutral-700">Sacar de moderación</SubmitButton>
              </form>
            )}
          </div>
        ))}
      </section>
    </main>
  );
}
