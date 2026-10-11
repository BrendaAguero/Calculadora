"use client";

import { useActionState, useState } from "react";
import { requestCode, requestPasswordReset, signInWithPassword, type ActionState } from "./actions";

const initialState: ActionState = {};
type Mode = "login" | "register" | "forgot";

const inputClass = "mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white";
const primaryButton = "w-full rounded-md bg-orange-800 px-4 py-2 text-white disabled:opacity-50";

function EmailSent({ text, onBack }: { text: string; onBack: () => void }) {
  return (
    <div role="status" className="space-y-4 text-center">
      <h2 className="text-lg font-semibold">Revisá tu correo</h2>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">{text}</p>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">Abrí el enlace en este mismo navegador. Si no llega en unos minutos, revisá la carpeta de spam.</p>
      <button type="button" onClick={onBack} className="w-full rounded-md border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700">Volver</button>
    </div>
  );
}

export function LoginForm({ linkError }: { linkError: string | null }) {
  const [mode, setMode] = useState<Mode>("login");
  // La clave reinicia los formularios (y sus mensajes) al volver atrás.
  const [round, setRound] = useState(0);
  const back = () => { setMode("login"); setRound(r => r + 1); };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-neutral-50 px-6 text-neutral-900 dark:bg-neutral-950 dark:text-white">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-center text-2xl font-semibold text-orange-800 dark:text-orange-300">Calculadora Emprender</h1>

        {linkError && <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{linkError}</p>}

        {mode !== "forgot" && (
          <div className="grid grid-cols-2 rounded-lg border border-neutral-200 p-1 dark:border-neutral-800">
            <button type="button" aria-pressed={mode === "login"} onClick={() => setMode("login")} className={`rounded-md px-3 py-2 text-sm ${mode === "login" ? "bg-orange-800 text-white" : ""}`}>Iniciar sesión</button>
            <button type="button" aria-pressed={mode === "register"} onClick={() => setMode("register")} className={`rounded-md px-3 py-2 text-sm ${mode === "register" ? "bg-orange-800 text-white" : ""}`}>Crear cuenta</button>
          </div>
        )}

        {mode === "login" && <LoginPanel key={`login-${round}`} onForgot={() => setMode("forgot")} />}
        {mode === "register" && <RegisterPanel key={`register-${round}`} onBack={back} />}
        {mode === "forgot" && <ForgotPanel key={`forgot-${round}`} onBack={back} />}
      </div>
    </main>
  );
}

function LoginPanel({ onForgot }: { onForgot: () => void }) {
  const [state, action, pending] = useActionState(signInWithPassword, initialState);
  return (
    <form action={action} className="space-y-4">
      <div><label className="block text-sm font-medium" htmlFor="login_email">Email</label><input id="login_email" name="email" type="email" autoComplete="email" required className={inputClass} placeholder="tu@email.com" /></div>
      <div><label className="block text-sm font-medium" htmlFor="login_password">Contraseña</label><input id="login_password" name="password" type="password" autoComplete="current-password" required className={inputClass} placeholder="Tu contraseña" /></div>
      {state.error && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{state.error}</p>}
      <button type="submit" disabled={pending} className={primaryButton}>{pending ? "Ingresando..." : "Iniciar sesión"}</button>
      <button type="button" onClick={onForgot} className="w-full text-center text-sm text-orange-800 underline dark:text-orange-300">¿Olvidaste tu contraseña o no la creaste todavía?</button>
      <p className="text-center text-xs text-neutral-500 dark:text-neutral-400">¿Es tu primer ingreso? Creá tu cuenta con el botón de arriba.</p>
    </form>
  );
}

function RegisterPanel({ onBack }: { onBack: () => void }) {
  const [state, action, pending] = useActionState(requestCode, initialState);
  if (state.success) return <EmailSent text="Te enviamos un enlace seguro. Al abrirlo vas a crear tu contraseña." onBack={onBack} />;
  return (
    <form action={action} className="space-y-4">
      <div><label className="block text-sm font-medium" htmlFor="full_name">Nombre</label><input id="full_name" name="full_name" type="text" autoComplete="name" required className={inputClass} placeholder="Tu nombre" /></div>
      <div><label className="block text-sm font-medium" htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required className={inputClass} placeholder="tu@email.com" /></div>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="terms_accepted" className="mt-1" required /><span>Acepto los términos y condiciones.</span></label>
      {state.error && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{state.error}</p>}
      <button type="submit" disabled={pending} className={primaryButton}>{pending ? "Enviando..." : "Crear cuenta"}</button>
    </form>
  );
}

function ForgotPanel({ onBack }: { onBack: () => void }) {
  const [state, action, pending] = useActionState(requestPasswordReset, initialState);
  if (state.success) return <EmailSent text="Si hay una cuenta con ese email, te enviamos un enlace para crear una contraseña nueva." onBack={onBack} />;
  return (
    <form action={action} className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Crear una contraseña nueva</h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Te mandamos un enlace por correo. Al abrirlo vas a poder elegir tu contraseña.</p>
      </div>
      <div><label className="block text-sm font-medium" htmlFor="forgot_email">Email</label><input id="forgot_email" name="email" type="email" autoComplete="email" required className={inputClass} placeholder="tu@email.com" /></div>
      {state.error && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{state.error}</p>}
      <button type="submit" disabled={pending} className={primaryButton}>{pending ? "Enviando..." : "Enviar enlace"}</button>
      <button type="button" onClick={onBack} className="w-full text-center text-sm underline">Volver a iniciar sesión</button>
    </form>
  );
}
