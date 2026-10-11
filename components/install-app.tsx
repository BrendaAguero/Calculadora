"use client";

import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// Botón «Instalar la app»: en Android y computadora usa el aviso del navegador; en iPhone explica los pasos.
export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [state, setState] = useState<"unknown" | "installed" | "ios" | "other">("unknown");

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- depende del aparato, solo se sabe en el navegador
    setState(standalone ? "installed" : ios ? "ios" : "other");
    const onPrompt = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    const onInstalled = () => { setState("installed"); setPrompt(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  if (state === "unknown" || state === "installed") return null;

  return (
    <div className="flex gap-4 rounded-3xl bg-white p-5 text-sm dark:bg-neutral-900">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300"><Smartphone size={22} aria-hidden="true" /></span>
      <div>
      <p className="font-semibold">Instalá la app</p>
      {prompt ? (
        <>
          <p className="mt-1 text-neutral-600 dark:text-neutral-300">Queda con su ícono, se abre en su propia ventana y más rápido.</p>
          <button type="button" onClick={async () => { await prompt.prompt(); setPrompt(null); }} className="mt-3 rounded-xl bg-orange-800 px-4 py-2 font-semibold text-white">Instalar</button>
        </>
      ) : state === "ios" ? (
        <p className="mt-1 text-neutral-600 dark:text-neutral-300">En Safari tocá <strong>Compartir</strong> (el cuadrado con la flecha) y después <strong>«Agregar a inicio»</strong>.</p>
      ) : (
        <p className="mt-1 text-neutral-600 dark:text-neutral-300">En Chrome o Edge, abrí el menú del navegador (⋮) y elegí <strong>«Instalar Calculadora Emprender»</strong> o <strong>«Agregar a la pantalla principal»</strong>.</p>
      )}
      </div>
    </div>
  );
}
