"use client";

import { useActionState, useEffect, useState } from "react";
import { requestCode, verifyCode, type ActionState } from "./actions";

const initialState: ActionState = {};

export default function LoginPage() {
  const [step, setStep] = useState<"request" | "verify">("request");
  const [email, setEmail] = useState("");

  const [requestState, requestAction, requestPending] = useActionState(
    requestCode,
    initialState
  );
  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyCode,
    initialState
  );

  useEffect(() => {
    if (requestState.success) {
      setStep("verify");
    }
  }, [requestState.success]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-neutral-50 px-6 dark:bg-neutral-950">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-center text-2xl font-semibold text-orange-800 dark:text-orange-300">
          Calculadora Emprender
        </h1>

        {step === "request" ? (
          <form
            action={(formData) => {
              setEmail(String(formData.get("email") || ""));
              requestAction(formData);
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium" htmlFor="full_name">
                Nombre
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
                placeholder="Tu nombre"
              />
            </div>
            <div>
              <label className="block text-sm font-medium" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
                placeholder="tu@email.com"
              />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="terms_accepted" className="mt-1" />
              <span>Acepto los términos y condiciones.</span>
            </label>
            {requestState.error && (
              <p className="text-sm text-red-600">{requestState.error}</p>
            )}
            <button
              type="submit"
              disabled={requestPending}
              className="w-full rounded-md bg-orange-800 px-4 py-2 text-white disabled:opacity-50"
            >
              {requestPending ? "Enviando..." : "Enviar código"}
            </button>
          </form>
        ) : (
          <form action={verifyAction} className="space-y-4">
            <input type="hidden" name="email" value={email} />
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Te enviamos un código de 6 dígitos a <strong>{email}</strong>.
            </p>
            <div>
              <label className="block text-sm font-medium" htmlFor="code">
                Código
              </label>
              <input
                id="code"
                name="code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-center text-lg tracking-widest"
                placeholder="123456"
              />
            </div>
            {verifyState.error && (
              <p className="text-sm text-red-600">{verifyState.error}</p>
            )}
            <button
              type="submit"
              disabled={verifyPending}
              className="w-full rounded-md bg-orange-800 px-4 py-2 text-white disabled:opacity-50"
            >
              {verifyPending ? "Verificando..." : "Ingresar"}
            </button>
            <button
              type="button"
              onClick={() => setStep("request")}
              className="w-full text-sm text-neutral-500 underline"
            >
              Usar otro email
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
