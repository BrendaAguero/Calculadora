"use client";

import { useEffect, useSyncExternalStore } from "react";
import { applyTheme, readTheme, THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

const THEME_EVENT = "calculadora-theme-change";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(THEME_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(THEME_EVENT, onChange);
  };
}

export function ThemeToggle() {
  // El servidor no conoce la preferencia guardada; React reemplaza "system" por el valor real al hidratar.
  const theme = useSyncExternalStore(subscribe, readTheme, () => "system" as Theme);

  useEffect(() => {
    if (theme !== "system") return;
    // En modo Sistema, seguir los cambios del sistema operativo sin recargar.
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => applyTheme(readTheme());
    media.addEventListener("change", onSystemChange);
    return () => media.removeEventListener("change", onSystemChange);
  }, [theme]);

  function changeTheme(next: Theme) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {}
    applyTheme(next);
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span>Tema</span>
      <select
        value={theme}
        onChange={(event) => changeTheme(event.target.value as Theme)}
        className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        aria-label="Tema de la aplicación"
      >
        <option value="system">Sistema</option>
        <option value="light">Claro</option>
        <option value="dark">Oscuro</option>
      </select>
    </label>
  );
}
