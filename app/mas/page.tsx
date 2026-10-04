import { AppShell } from "@/components/app-shell";
import { ThemeToggle } from "@/components/theme-toggle";

export default function MasPage() {
  return <AppShell><h1 className="text-3xl font-bold">Más</h1><p className="mt-2 text-sm text-neutral-500">Configuración y herramientas de la aplicación.</p><div className="mt-8 space-y-3"><div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"><ThemeToggle /></div><a href="/profile" className="block rounded-2xl border border-neutral-200 bg-white p-5 font-semibold dark:border-neutral-800 dark:bg-neutral-900">Mi perfil</a><a href="/preferences" className="block rounded-2xl border border-neutral-200 bg-white p-5 font-semibold dark:border-neutral-800 dark:bg-neutral-900">Preferencias</a><a href="/access" className="block rounded-2xl border border-neutral-200 bg-white p-5 font-semibold dark:border-neutral-800 dark:bg-neutral-900">Licencia y acceso</a></div></AppShell>;
}
