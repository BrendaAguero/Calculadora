import Link from 'next/link';

// Ayuda contextual plegable: una explicación corta en la pantalla y el enlace a la guía completa.
export function HelpTip({ guide, children }: { guide: string; children: React.ReactNode }) {
  return (
    <details className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-100">
      <summary className="cursor-pointer font-medium">¿Cómo funciona?</summary>
      <div className="mt-2 space-y-1 pb-1">{children}</div>
      <Link href={`/ayuda#${guide}`} className="mt-1 inline-block pb-1 text-xs underline">Ver la guía completa</Link>
    </details>
  );
}
