'use client';

import { useActionState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { staffSignIn, type StaffState } from './actions';

const input = 'mt-1.5 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 focus:border-orange-600 focus:bg-white dark:border-neutral-700 dark:bg-neutral-950 dark:text-white';

export function StaffForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<StaffState, FormData>(staffSignIn, {});
  return (
    <main className="grid min-h-screen place-items-center bg-neutral-100 px-4 py-10 text-neutral-900 dark:bg-neutral-950 dark:text-white">
      <form action={action} className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-6 shadow-sm dark:bg-neutral-900">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"><ShieldCheck size={22} aria-hidden="true" /></span>
          <div><h1 className="text-xl font-semibold">Ingreso del equipo</h1><p className="text-xs text-neutral-500">Administración y moderación</p></div>
        </div>
        <input type="hidden" name="next" value={next} />
        <label className="block text-sm font-medium">Email<input name="email" type="email" autoComplete="username" required className={input} /></label>
        <label className="block text-sm font-medium">Contraseña<input name="password" type="password" autoComplete="current-password" required className={input} /></label>
        {state.error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">{state.error}</p>}
        <button disabled={pending} className="w-full rounded-2xl bg-neutral-900 px-4 py-3 font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900">{pending ? 'Entrando…' : 'Entrar'}</button>
        <p className="text-xs text-neutral-500">¿No tenés contraseña? Entrá a la app como siempre y después tocá <a href="/set-password" className="font-semibold underline">crear contraseña</a>. La sesión del equipo dura 12 horas.</p>
      </form>
    </main>
  );
}
