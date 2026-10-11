"use client";

import { useActionState, useState } from "react";
import { Calculator, Check } from "lucide-react";
import { LegalLinks } from "@/components/legal-links";
import { redeemAccessKey, requestPasswordReset, signInWithPassword, type ActionState } from "./actions";

const initialState: ActionState = {};
type Mode = "code" | "password" | "forgot";

const inputClass = "mt-1.5 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 focus:border-orange-600 focus:bg-white dark:border-neutral-700 dark:bg-neutral-950 dark:text-white";
const primaryButton = "w-full rounded-2xl bg-resina px-4 py-3.5 text-base font-bold text-resina-dark hover:brightness-105 disabled:opacity-60";

function EmailSent({ text, onBack }: { text: string; onBack: () => void }) {
  return (
    <div role="status" className="space-y-4 text-center">
      <h2 className="text-lg font-semibold">Revisá tu correo</h2>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">{text}</p>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">Abrí el enlace en este mismo navegador. Si no llega en unos minutos, revisá la carpeta de spam.</p>
      <button type="button" onClick={onBack} className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm dark:border-neutral-700">Volver</button>
    </div>
  );
}

export function LoginForm({ linkError, okMessage }: { linkError: string | null; okMessage?: string | null }) {
  const [mode, setMode] = useState<Mode>("code");
  // La clave reinicia los formularios (y sus mensajes) al volver atrás.
  const [round, setRound] = useState(0);
  const back = () => { setMode("code"); setRound(r => r + 1); };

  return (
    <main className="min-h-screen text-neutral-900 dark:text-white lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* Marca: arriba en el celular, panel verde a la izquierda en la computadora. */}
      <section className="terrazo-borde relative bg-orange-800 px-6 pb-20 pt-12 text-white dark:bg-orange-900 lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-14">
        <div className="mx-auto max-w-sm lg:mx-0">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-resina text-resina-dark"><Calculator size={28} aria-hidden="true" /></span>
          <h1 className="mt-5 text-[34px] leading-[1.05] text-white lg:text-5xl">Calculadora<br />Emprender</h1>
          <p className="mt-3 max-w-xs text-white/80 lg:text-lg">Calculá, vendé y ordená tu taller de yeso, resina y más.</p>
        </div>
        <ul className="mt-10 hidden max-w-sm space-y-3 text-white/85 lg:block">
          {["Costos y precio de venta en segundos", "Stock, producción y ventas en un solo lugar", "Tu ganancia del mes siempre a la vista"].map((text) => (
            <li key={text} className="flex items-center gap-3"><span className="grid h-7 w-7 place-items-center rounded-full bg-white/15"><Check size={16} aria-hidden="true" /></span>{text}</li>
          ))}
        </ul>
      </section>

      <section className="relative -mt-12 px-4 pb-10 lg:mt-0 lg:flex lg:items-center lg:justify-center lg:px-10">
        <div className="mx-auto w-full max-w-md space-y-5 rounded-4xl bg-white p-6 dark:bg-neutral-900 lg:p-8">
          <div>
            <h2 className="text-2xl">{mode === "code" ? "Entrá a tu taller" : mode === "password" ? "Entrar con contraseña" : "Contraseña nueva"}</h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Edición Personal</p>
          </div>
          {okMessage && <p role="status" className="rounded-2xl bg-orange-50 px-4 py-3 text-sm text-orange-900 dark:bg-orange-950/50 dark:text-orange-100">{okMessage}</p>}
          {linkError && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">{linkError}</p>}

          {mode === "code" && <KeyPanel key={`code-${round}`} onPassword={() => setMode("password")} />}
          {mode === "password" && <PasswordPanel key={`password-${round}`} onForgot={() => setMode("forgot")} onBack={back} />}
          {mode === "forgot" && <ForgotPanel key={`forgot-${round}`} onBack={back} />}
        </div>
        <div className="mx-auto mt-6 w-full max-w-md space-y-5 lg:absolute lg:bottom-8 lg:left-1/2 lg:-translate-x-1/2 lg:px-10">
          <p className="text-center text-sm">¿Todavía no la tenés? <a href="/comprar" className="font-semibold text-orange-800 underline underline-offset-4 dark:text-orange-300">Comprá la Edición Personal</a></p>
          <LegalLinks className="justify-center" />
        </div>
      </section>
    </main>
  );
}

// Ingreso con la clave de acceso que llega por correo al comprar (o que manda la administración).
// Se pide una sola vez por aparato: después la sesión queda abierta.
function KeyPanel({ onPassword }: { onPassword: () => void }) {
  const [state, action, pending] = useActionState(redeemAccessKey, initialState);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="block text-sm font-medium" htmlFor="access_key">Tu clave de acceso</label>
        <input id="access_key" name="key" required autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={20} className={`${inputClass} text-center font-mono text-2xl uppercase tracking-[0.18em]`} placeholder="XXXX-XXXX-XXXX" />
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Te llegó por correo cuando compraste. Solo la escribís la primera vez en cada aparato.</p>
      </div>
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="terms_accepted" className="mt-0.5 h-5 w-5 shrink-0 accent-orange-800" required /><span>Acepto los <a href="/legal/terminos" target="_blank" className="underline">términos y condiciones</a> y la <a href="/legal/privacidad" target="_blank" className="underline">política de privacidad</a>.</span></label>
      {state.error && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{state.error}</p>}
      <button type="submit" disabled={pending} className={primaryButton}>{pending ? "Entrando..." : "Entrar"}</button>
      <p className="text-center text-xs text-neutral-500 dark:text-neutral-400">¿Perdiste tu clave? Escribinos a calculadoraemprender.app@gmail.com</p>
      <button type="button" onClick={onPassword} className="w-full text-center text-xs text-neutral-400 underline">Entrar con email y contraseña</button>
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
      <button type="button" onClick={onBack} className="w-full text-center text-sm underline">Entrar con mi clave</button>
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
