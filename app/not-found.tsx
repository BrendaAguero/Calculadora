import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 text-neutral-900 dark:text-neutral-100">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <p className="font-mono text-sm text-neutral-500">Código: 404</p>
        <h1 className="mt-1 text-lg font-semibold">No encontramos esta página</h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">Puede que el enlace esté mal o que eso ya no exista.</p>
        <div className="mt-5 grid gap-2">
          <Link href="/" className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">Ir al inicio</Link>
          <Link href="/ayuda" className="text-sm underline">Ver la ayuda</Link>
        </div>
      </div>
    </main>
  );
}
