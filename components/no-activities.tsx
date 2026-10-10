import Link from "next/link";

// Aviso cuando la cuenta todavía no tiene ninguna actividad (Yeso, Resina, etc.) asignada.
export function NoActivities() {
  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
      <p className="font-medium">Tu cuenta todavía no tiene ninguna actividad.</p>
      <p className="mt-1">Las actividades (Yeso, Resina, Jesmonite, Cemento decorativo) se eligen al comprar la aplicación.</p>
      <Link href="/access" className="mt-3 inline-block underline">Ver mi licencia y actividades</Link>
    </div>
  );
}
