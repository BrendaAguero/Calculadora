'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { CONTACT_EMAIL } from '@/lib/legal';

// Pantalla para errores inesperados. Muestra un código que coincide con los registros del servidor
// (el «digest» de Next), así la persona lo puede mandar y se encuentra el problema rápido.
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const pathname = usePathname();
  useEffect(() => { console.error(error); }, [error]);
  const code = `E-${(error.digest ?? 'CLIENTE').slice(0, 12).toUpperCase()}`;
  const mail = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Error ${code}`)}&body=${encodeURIComponent(`Hola, me apareció el error ${code} en ${pathname}.\n\nQué estaba haciendo: `)}`;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 text-neutral-900 dark:text-neutral-100">
      <div role="alert" className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h1 className="text-lg font-semibold">Algo salió mal</h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">No se perdió nada de lo que tenías guardado. Probá de nuevo; si sigue pasando, mandanos este código.</p>
        <p className="mt-4 rounded-lg bg-neutral-100 px-3 py-2 font-mono text-sm dark:bg-neutral-800">Código: {code}</p>
        <div className="mt-5 grid gap-2">
          <button type="button" onClick={() => retry()} className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">Probar de nuevo</button>
          <a href={mail} className="rounded-xl border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700">Avisar por email</a>
          <Link href="/" className="text-sm underline">Volver al inicio</Link>
        </div>
      </div>
    </main>
  );
}
