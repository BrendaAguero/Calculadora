"use client";

import { useEffect, useState } from "react";
import { biometricAvailable, createBiometricLock, createPinLock, readLock, saveLock } from "@/lib/app-lock";

// Configurar el bloqueo de la app en este aparato: sin bloqueo, PIN o huella/cara.
export function AppLockSettings({ name }: { name: string }) {
  const [current, setCurrent] = useState<"none" | "pin" | "bio">("none");
  const [canBio, setCanBio] = useState(false);
  const [choosingPin, setChoosingPin] = useState(false);
  const [pin, setPin] = useState("");
  const [repeat, setRepeat] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lee lo guardado en este navegador al montar
    setCurrent(readLock()?.type ?? "none");
    void biometricAvailable().then(setCanBio);
  }, []);

  const savePin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\d{4,6}$/.test(pin)) return setMessage({ ok: false, text: "El PIN tiene que tener de 4 a 6 números." });
    if (pin !== repeat) return setMessage({ ok: false, text: "Los dos PIN no coinciden." });
    saveLock(await createPinLock(pin));
    setCurrent("pin"); setChoosingPin(false); setPin(""); setRepeat("");
    setMessage({ ok: true, text: "Listo: la app te va a pedir el PIN al abrirla en este aparato." });
  };

  const saveBio = async () => {
    try {
      saveLock(await createBiometricLock(name));
      setCurrent("bio"); setChoosingPin(false);
      setMessage({ ok: true, text: "Listo: la app te va a pedir la huella o la cara al abrirla en este aparato." });
    } catch {
      setMessage({ ok: false, text: "No se pudo activar. Probá de nuevo o usá un PIN." });
    }
  };

  const remove = () => { saveLock(null); setCurrent("none"); setMessage({ ok: true, text: "Bloqueo quitado en este aparato." }); };
  const button = "rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700";

  return (
    <section className="mt-8 rounded-lg border border-neutral-200 p-4 text-sm dark:border-neutral-800">
      <h2 className="font-semibold">Bloqueo de la app en este aparato</h2>
      <p className="mt-1 text-neutral-600 dark:text-neutral-400">
        Opcional. Al abrir la app (o volver después de 5 minutos) te pide {canBio ? "tu huella, tu cara o un PIN" : "un PIN"}, para que nadie más la abra en tu aparato.
        Ahora: <strong>{current === "pin" ? "con PIN" : current === "bio" ? "con huella o cara" : "sin bloqueo"}</strong>.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {canBio && <button type="button" onClick={() => void saveBio()} className={button}>Usar huella o cara</button>}
        <button type="button" onClick={() => setChoosingPin(true)} className={button}>{current === "pin" ? "Cambiar PIN" : "Usar un PIN"}</button>
        {current !== "none" && <button type="button" onClick={remove} className={button}>Quitar bloqueo</button>}
      </div>
      {choosingPin && (
        <form onSubmit={savePin} className="mt-3 grid gap-2 sm:grid-cols-3">
          <input aria-label="PIN nuevo" placeholder="PIN (4 a 6 números)" inputMode="numeric" type="password" autoComplete="new-password" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} className="rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900" />
          <input aria-label="Repetí el PIN" placeholder="Repetilo" inputMode="numeric" type="password" autoComplete="new-password" maxLength={6} value={repeat} onChange={(e) => setRepeat(e.target.value.replace(/\D/g, ""))} className="rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900" />
          <button className="rounded-md bg-orange-800 px-4 py-2 text-white">Guardar PIN</button>
        </form>
      )}
      {message && <p role="status" className={`mt-2 ${message.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-300"}`}>{message.text}</p>}
      <p className="mt-2 text-xs text-neutral-500">Si olvidás el PIN, entrás de nuevo con tu clave de acceso. Tu huella o tu cara nunca salen de tu aparato.</p>
    </section>
  );
}
