"use client";

import { useState } from "react";
import { useActionState } from "react";
import { requestCode, signInWithPassword, type ActionState } from "./actions";

const initialState: ActionState = {};

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loginState, loginAction, loginPending] = useActionState(signInWithPassword, initialState);
  const [requestState, requestAction, requestPending] = useActionState(requestCode, initialState);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-neutral-50 px-6 dark:bg-neutral-950">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-center text-2xl font-semibold text-orange-800 dark:text-orange-300">
          Calculadora Emprender
        </h1>

        <div className="grid grid-cols-2 rounded-lg border border-neutral-200 p-1 dark:border-neutral-800">
          <button type="button" onClick={() => setMode("login")} className={`rounded-md px-3 py-2 text-sm ${mode === "login" ? "bg-orange-800 text-white" : ""}`}>
            Iniciar sesión
          </button>
          <button type="button" onClick={() => setMode("register")} className={`rounded-md px-3 py-2 text-sm ${mode === "register" ? "bg-orange-800 text-white" : ""}`}>
            Crear cuenta
          </button>
        </div>

        {mode === "login" ? (
          <form action={loginAction} className="space-y-4">
            <div>
              <label className="block text-sm font-medium" htmlFor="login_email">Email</label>
              <input id="login_email" name="email" type="email" required className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2" placeholder="tu@email.com" />
            </div>
            <div>
              <label className="block text-sm font-medium" htmlFor="login_password">Contraseña</label>
              <input id="login_password" name="password" type="password" required className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2" placeholder="Tu contraseña" />
            </div>
            {loginState.error && <p className="text-sm text-red-600">{loginState.error}</p>}
            <button type="submit" disabled={loginPending} className="w-full rounded-md bg-orange-800 px-4 py-2 text-white disabled:opacity-50">
              {loginPending ? "Ingresando..." : "Iniciar sesión"}
            </button>
            <p className="text-center text-xs text-neutral-500">¿Es tu primer ingreso? Creá tu cuenta con el botón de arriba.</p>
          </form>
        ) : requestState.success ? (
          <div className="space-y-4 text-center">
            <h2 className="text-lg font-semibold">Revisá tu correo</h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">Te enviamos un enlace seguro. Al entrar por primera vez vas a poder crear tu contraseña.</p>
            <button type="button" onClick={() => window.location.reload()} className="w-full rounded-md border border-neutral-300 px-4 py-2 text-sm">Usar otro email</button>
          </div>
        ) : (
          <form action={requestAction} className="space-y-4">
            <div>
              <label className="block text-sm font-medium" htmlFor="full_name">Nombre</label>
              <input id="full_name" name="full_name" type="text" required className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2" placeholder="Tu nombre" />
            </div>
            <div>
              <label className="block text-sm font-medium" htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2" placeholder="tu@email.com" />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="terms_accepted" className="mt-1" required />
              <span>Acepto los términos y condiciones.</span>
            </label>
            {requestState.error && <p className="text-sm text-red-600">{requestState.error}</p>}
            <button type="submit" disabled={requestPending} className="w-full rounded-md bg-orange-800 px-4 py-2 text-white disabled:opacity-50">
              {requestPending ? "Enviando..." : "Crear cuenta"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
