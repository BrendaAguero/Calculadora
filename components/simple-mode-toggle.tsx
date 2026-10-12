"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SIMPLE_COOKIE } from "@/lib/simple-mode";

export const SIMPLE_EVENT = "calculadora-modo-simple";

// Interruptor del Modo simple. Recarga la pantalla para mostrarla con el modo elegido.
export function SimpleModeToggle({ initial, compact = false }: { initial: boolean; compact?: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const toggle = () => {
    const next = !on;
    setOn(next);
    document.cookie = `${SIMPLE_COOKIE}=${next ? "1" : "0"}; path=/; max-age=${60 * 60 * 24 * 365 * 2}; samesite=lax`;
    window.dispatchEvent(new Event(SIMPLE_EVENT));
    router.refresh();
  };
  return (
    <button type="button" role="switch" aria-checked={on} onClick={toggle}
      className={`flex items-center gap-3 rounded-2xl bg-white text-left dark:bg-neutral-900 ${compact ? "px-3 py-2" : "w-full p-4"}`}>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? "bg-orange-800 dark:bg-orange-600" : "bg-neutral-300 dark:bg-neutral-700"}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-6" : "left-1"}`} />
      </span>
      <span>
        <span className="block text-sm font-semibold">Modo simple: {on ? "sí" : "no"}</span>
        {!compact && <span className="block text-xs text-neutral-500 dark:text-neutral-400">{on ? "Ves lo esencial, con botones grandes. Apagalo para ver todas las opciones." : "Ves todas las opciones. Prendelo para ver solo lo esencial."}</span>}
      </span>
    </button>
  );
}
