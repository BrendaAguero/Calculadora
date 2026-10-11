"use client";

import { useActionState, useState } from "react";
import { LegalLinks } from "@/components/legal-links";
import { requestLoginCode, requestPasswordReset, signInWithPassword, verifyLoginCode, type ActionState } from "./actions";

const initialState: ActionState = {};
type Mode = "code" | "password" | "forgot";

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

export function LoginForm({ linkError, okMessage }: { linkError: string | null; okMessage?: string | null }) {
  const [mode, setMode] = useState<Mode>("code");
  // La clave reinicia los formularios (y sus mensajes) al volver atrás.
  const [round, setRound] = useState(0);
  const back = () => { setMode("code"); setRound(r => r + 1); };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-neutral-50 px-6 text-neutral-900 dark:bg-neutral-950 dark:text-white">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-orange-800 dark:text-orange-300">Calculadora Emprender</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Edición Personal</p>
        </div>

        {okMessage && <p role="status" className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">{okMessage}</p>}
        {linkError && <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{linkError}</p>}

        {mode === "code" && <CodePanel key={`code-${round}`} onPassword={() => setMode("password")} />}
        {mode === "password" && <PasswordPanel key={`password-${round}`} onForgot={() => setMode("forgot")} onBack={back} />}
        {mode === "forgot" && <ForgotPanel key={`forgot-${round}`} onBack={back} />}
        <p className="text-center text-sm">¿Todavía no la tenés? <a href="/comprar" className="font-medium text-orange-800 underline dark:text-orange-300">Comprá la Edición Personal</a></p>
        <LegalLinks className="justify-center pt-4" />
      </div>
    </main>
  );
}

// Ingreso sin contraseña: email → código de 6 dígitos por correo.
function CodePanel({ onPassword }: { onPassword: () => void }) {
  const [sent, sendAction, sending] = useActionState(requestLoginCode, initialState);
  const [verified, verifyAction, verifying] = useActionState(verifyLoginCode, initialState);
  const email = verified.email ?? sent.email;

  if (sent.success || verified.error) {
    return (
      <form action={verifyAction} className="space-y-4">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">Te mandamos un código de 6 dígitos a <strong>{email}</strong>. Si no llega en unos minutos, revisá spam.</p>
        <input type="hidden" name="email" value={email ?? ""} />
        <div><label className="block text-sm font-medium" htmlFor="code">Código</label><input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={10} required autoFocus className={`${inputClass} text-center text-2xl tracking-[0.4em]`} placeholder="••••••" /></div>
        {verified.error && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{verified.error}</p>}
        <button type="submit" disabled={verifying} className={primaryButton}>{verifying ? "Entrando..." : "Entrar"}</button>
        <button type="button" onClick={() => location.reload()} className="w-full text-center text-sm underline">Usar otro email o pedir otro código</button>
      </form>
    );
  }

  return (
    <form action={sendAction} className="space-y-4">
      <div><label className="block text-sm font-medium" htmlFor="login_email">Tu email</label><input id="login_email" name="email" type="email" autoComplete="email" required className={inputClass} placeholder="tu@email.com" /></div>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="terms_accepted" className="mt-1" required /><span>Acepto los <a href="/legal/terminos" target="_blank" className="underline">términos y condiciones</a> y la <a href="/legal/privacidad" target="_blank" className="underline">política de privacidad</a>.</span></label>
      {sent.error && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{sent.error}</p>}
      <button type="submit" disabled={sending} className={primaryButton}>{sending ? "Enviando..." : "Recibir código"}</button>
      <button type="button" onClick={onPassword} className="w-full text-center text-sm text-neutral-500 underline dark:text-neutral-400">Entrar con contraseña</button>
    </form>
  );
}

function PasswordPanel({ onForgot, onBack }: { onForgot: () => void; onBack: () => void }) {
  const [state, action, pending] = useActionState(signInWithPassword, initialState);
  return (
    <form action={action} className="space-y-4">
      <div><label className="block text-sm font-medium" htmlFor="login_email_pw">Email</label><input id="login_email_pw" name="email" type="email" autoComplete="email" required className={inputClass} placeholder="tu@email.com" /></div>
      <div><label className="block text-sm font-medium" htmlFor="login_password">Contraseña</label><input id="login_password" name="password" type="password" autoComplete="current-password" required className={inputClass} placeholder="Tu contraseña" /></div>
      {state.error && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{state.error}</p>}
      <button type="submit" disabled={pending} className={primaryButton}>{pending ? "Ingresando..." : "Iniciar sesión"}</button>
      <button type="button" onClick={onForgot} className="w-full text-center text-sm text-orange-800 underline dark:text-orange-300">¿Olvidaste tu contraseña?</button>
      <button type="button" onClick={onBack} className="w-full text-center text-sm underline">Entrar con código por email</button>
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
