import Link from 'next/link';

// Aviso para una función que requiere un módulo o Emprendedor.
export function FeatureLocked({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
      <p className="font-medium">{title}</p>
      <p className="mt-1">{children}</p>
      <Link href="/access#emprendedor" className="mt-3 inline-block underline">Ver Emprendedor y módulos</Link>
    </div>
  );
}
