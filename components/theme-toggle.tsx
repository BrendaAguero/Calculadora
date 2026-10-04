"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const saved = localStorage.getItem("calculadora-theme") as Theme | null;
    if (saved === "light" || saved === "dark" || saved === "system") setTheme(saved);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark");
    if (theme === "dark") root.classList.add("dark");
    if (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches) root.classList.add("dark");
    localStorage.setItem("calculadora-theme", theme);
  }, [theme]);

  return (
    <label className="flex items-center gap-2 text-sm">
      <span>Tema</span>
      <select
        value={theme}
        onChange={(event) => setTheme(event.target.value as Theme)}
        className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        aria-label="Tema de la aplicación"
      >
        <option value="system">Sistema</option>
        <option value="light">Claro</option>
        <option value="dark">Oscuro</option>
      </select>
    </label>
  );
}
