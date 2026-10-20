'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Calculator } from 'lucide-react';
import { signUpFree, type SignUpState } from './actions';

const input = 'mt-1.5 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 focus:border-orange-600 focus:bg-white dark:border-neutral-700 dark:bg-neutral-950 dark:text-white';

export function SignUpForm() {
  const [state, action, pending] = useActionState<SignUpState, FormData>(signUpFree, {});
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10 text-neutral-900 dark:text-white">
      <div className="w-full max-w-md">
        <Link href="/conocer" className="mb-6 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-resina text-resina-dark"><Calculator size={22} aria-hidden="true" /></span>
          <span className="font-display text-xl font-bold">Calculadora Emprender</span>
        </Link>
        <form action={action} className="space-y-4 rounded-4xl bg-white p-6 dark:bg-neutral-900 lg:p-8">
          <div>
            <h1 className="text-2xl">Probá gratis</h1>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Sin tarjeta y sin vencimiento. Cuando quieras más, pasás a la Edición Personal.</p>
          </div>
          <label className="block text-sm font-medium">Tu nombre (opcional)<input name="full_name" maxLength={80} autoComplete="name" className={input} /></label>
          <label className="block text-sm font-medium">Email<input name="email" type="email" required maxLength={200} autoComplete="email" defaultValue={state.email} className={input} placeholder="tu@email.com" /></label>
          <label className="block text-sm font-medium">Contraseña<input name="password" type="password" required minLength={8} autoComplete="new-password" className={input} /></label>
          <label className="block text-sm font-medium">Repetir contraseña<input name="password_confirmation" type="password" required minLength={8} autoComplete="new-password" className={input} /></label>
          <p className="text-xs text-neutral-500">Mínimo 8 caracteres. Usá una que no uses en otros sitios.</p>
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="terms_accepted" required className="mt-0.5 h-5 w-5 shrink-0 accent-orange-800" /><span>Acepto los <a href="/legal/terminos" target="_blank" className="underline">términos y condiciones</a> y la <a href="/legal/privacidad" target="_blank" className="underline">política de privacidad</a>.</span></label>
          {state.error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">{state.error}</p>}
          <button disabled={pending} className="w-full rounded-2xl bg-resina px-4 py-3.5 text-base font-bold text-resina-dark hover:brightness-105 disabled:opacity-60">{pending ? 'Creando tu cuenta…' : 'Crear mi cuenta gratis'}</button>
          <p className="text-center text-sm">¿Ya tenés cuenta? <Link href="/login" className="font-semibold text-orange-800 underline dark:text-orange-300">Entrá</Link></p>
        </form>
      </div>
    </main>
  );
}
