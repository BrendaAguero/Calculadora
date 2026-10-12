"use client";

import { useRouter } from "next/navigation";
import { PROFIT_COOKIE } from "@/lib/profit";

// Mostrar u ocultar las ganancias en Inicio (queda guardado en el aparato).
export function ProfitToggle({ visible }: { visible: boolean }) {
  const router = useRouter();
  const set = (show: boolean) => {
    document.cookie = `${PROFIT_COOKIE}=${show ? "1" : "0"}; path=/; max-age=${60 * 60 * 24 * 365 * 2}; samesite=lax`;
    router.refresh();
  };
  return visible
    ? <button type="button" onClick={() => set(false)} className="shrink-0 text-sm text-neutral-500 underline dark:text-neutral-400">Ocultar</button>
    : <button type="button" onClick={() => set(true)} className="rounded-2xl bg-white px-3 py-2 text-sm font-semibold dark:bg-neutral-900">Mostrar mis ganancias</button>;
}
