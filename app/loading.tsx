import { cardClass, pageClass } from '@/lib/ui';

// Pantalla de carga: se ve al instante mientras el servidor arma la página.
export default function Loading() {
  return (
    <main className={pageClass} aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando…</span>
      <div className="h-8 w-48 animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-800" />
      {[0, 1, 2].map((i) => (
        <div key={i} className={`${cardClass} grid gap-3`}>
          <div className="h-5 w-1/3 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-4 w-full animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800/60" />
          <div className="h-4 w-2/3 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800/60" />
        </div>
      ))}
    </main>
  );
}
