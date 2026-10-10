import Link from 'next/link';
import { createMold } from '../actions';
import { MoldForm } from '../mold-form';

export default function NewMoldPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-5 bg-white px-4 py-6 pb-24 text-neutral-900 dark:bg-neutral-950 dark:text-white">
      <header>
        <Link href="/gestion/moldes" className="text-sm text-neutral-500 dark:text-neutral-400">← Volver a moldes</Link>
        <h1 className="mt-3 text-2xl font-semibold">Nuevo molde</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Por ahora lo registramos para la actividad Yeso.</p>
      </header>
      <MoldForm action={createMold} submitLabel="Guardar molde" />
    </main>
  );
}
