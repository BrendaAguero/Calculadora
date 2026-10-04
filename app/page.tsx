import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <AppShell>
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-orange-700 dark:text-orange-300">Calculadora Emprender</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Hola{user?.email ? " 👋" : ""}</h1>
        </div>
        <ThemeToggle />
      </header>

      <section className="mt-8 rounded-3xl bg-orange-700 p-6 text-white shadow-sm dark:bg-orange-900">
        <p className="text-sm opacity-90">Tu próxima tarea</p>
        <h2 className="mt-2 text-2xl font-semibold">¿Qué querés calcular?</h2>
        <p className="mt-2 max-w-sm text-sm opacity-90">Prepará una cantidad, estimá costos y conocé tu precio y ganancia.</p>
        <a href="/calcular" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-white px-5 font-semibold text-orange-800">Empezar a calcular</a>
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3">
        {[['/mis-datos','Mis datos','Materiales, moldes y fórmulas'], ['/gestion','Gestión','Productos y organización'], ['/access','Mi acceso','Plan, módulos y límites'], ['/mas','Más','Perfil, preferencias y ayuda']].map(([href,title,description]) => (
          <a key={href} href={href} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{description}</p>
          </a>
        ))}
      </section>
    </AppShell>
  );
}
