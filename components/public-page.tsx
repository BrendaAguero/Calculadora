import Link from 'next/link';
import { LegalLinks } from '@/components/legal-links';

// Contenedor para páginas que se pueden abrir sin sesión (ayuda, legales, arrepentimiento).
export function PublicPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <Link href="/" className="text-sm font-medium text-orange-800 dark:text-orange-300">Calculadora Emprender</Link>
        <div className="mt-4">{children}</div>
        <LegalLinks className="mt-10 border-t border-neutral-200 pt-6 dark:border-neutral-800" />
      </main>
    </div>
  );
}

// Estilos para textos largos (títulos, párrafos, listas y enlaces dentro del contenido).
export const proseClass = 'space-y-3 text-sm leading-6 text-neutral-700 dark:text-neutral-300 [&_a]:text-orange-800 [&_a]:underline dark:[&_a]:text-orange-300 [&_h2]:pt-3 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-neutral-900 dark:[&_h2]:text-white [&_h3]:font-semibold [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:text-neutral-900 dark:[&_strong]:text-white [&_ul]:list-disc [&_ul]:pl-5';
