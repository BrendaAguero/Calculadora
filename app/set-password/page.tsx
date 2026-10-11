"use client";

import { useActionState } from "react";
import { setPassword, type ActionState } from "../login/actions";

const initialState: ActionState = {};

export default function SetPasswordPage() {
  const [state, action, pending] = useActionState(setPassword, initialState);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 text-neutral-900 dark:text-white">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Creá tu contraseña</h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Este paso es necesario para que después puedas ingresar con tu email y contraseña.
          </p>
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            Mínimo 8 caracteres. Usá una que no uses en otros sitios: revisamos que no haya aparecido en filtraciones conocidas, sin enviarla a nadie.
          </p>
        </div>
        <form action={action} className="space-y-4">
          <div>
            <label className="block text-sm font-medium" htmlFor="password">Contraseña</label>
            <input id="password" name="password" type="password" minLength={8} required className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="password_confirmation">Repetir contraseña</label>
            <input id="password_confirmation" name="password_confirmation" type="password" minLength={8} required className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white" />
          </div>
          {state.error && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{state.error}</p>}
          <button type="submit" disabled={pending} className="w-full rounded-md bg-orange-800 px-4 py-2 text-white disabled:opacity-50">
            {pending ? "Guardando..." : "Guardar contraseña"}
          </button>
        </form>
      </div>
    </main>
  );
}
