import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { LegalLinks } from "@/components/legal-links";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Tutorial inicial: se muestra hasta que la persona completa los primeros pasos.
  const count = async (table: string) => user ? (await supabase.from(table).select("id", { count: "exact", head: true }).eq("user_id", user.id)).count ?? 0 : 0;
  const [materials, formulas, molds, calculations] = await Promise.all(["materials", "formulas", "molds", "calculations"].map(count));
  const steps: [boolean, string, string][] = [
    [materials > 0, "/materials/new", "Cargá tu primer material con su precio"],
    [formulas > 0, "/formulas/new", "Guardá tu fórmula (por ejemplo, yeso con 75 % de agua)"],
    [molds > 0, "/gestion/moldes/new", "Registrá un molde con sus gramos"],
    [calculations > 0, "/calcular", "Hacé y guardá tu primer cálculo"],
  ];
  const done = steps.filter(([ok]) => ok).length;

  return (
    <AppShell>
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-orange-700 dark:text-orange-300">Calculadora Emprender</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Hola{user?.email ? " 👋" : ""}</h1>
        </div>
        <ThemeToggle />
      </header>

      {done < steps.length && (
        <section aria-labelledby="primeros-pasos" className="mt-6 rounded-3xl border border-orange-200 bg-orange-50 p-5 dark:border-orange-900 dark:bg-orange-950/30">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="primeros-pasos" className="font-semibold">Primeros pasos</h2>
            <span className="text-xs text-neutral-600 dark:text-neutral-300">{done} de {steps.length}</span>
          </div>
          <ol className="mt-3 space-y-2 text-sm">
            {steps.map(([ok, href, label]) => (
              <li key={href} className="flex items-center gap-2">
                <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${ok ? "bg-emerald-600 text-white" : "border border-neutral-400"}`}>{ok ? "✓" : ""}</span>
                {ok ? <span className="text-neutral-500 line-through">{label}</span> : <a href={href} className="underline underline-offset-2">{label}</a>}
                <span className="sr-only">{ok ? "(hecho)" : "(pendiente)"}</span>
              </li>
            ))}
          </ol>
          <a href="/ayuda#empezar" className="mt-3 inline-block text-xs text-orange-800 underline dark:text-orange-300">Ver la guía de primeros pasos</a>
        </section>
      )}

      <section className="mt-6 rounded-3xl bg-orange-700 p-6 text-white shadow-sm dark:bg-orange-900">
        <p className="text-sm opacity-90">Tu próxima tarea</p>
        <h2 className="mt-2 text-2xl font-semibold">¿Qué querés calcular?</h2>
        <p className="mt-2 max-w-sm text-sm opacity-90">Prepará una cantidad, estimá costos y conocé tu precio y ganancia.</p>
        <a href="/calcular" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-white px-5 font-semibold text-orange-800">Empezar a calcular</a>
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3">
        {[['/resumen','Resumen','Ventas y ganancias del mes'], ['/gestion','Gestión','Productos, stock, ventas y más'], ['/mis-datos','Mis datos','Materiales, moldes y fórmulas'], ['/access','Mi acceso','Plan, módulos y límites']].map(([href,title,description]) => (
          <a key={href} href={href} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{description}</p>
          </a>
        ))}
      </section>

      <LegalLinks className="mt-8" />
    </AppShell>
  );
}
