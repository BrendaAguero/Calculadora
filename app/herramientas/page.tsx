import { AppShell } from '@/components/app-shell';
import { Tools } from './tools';

// Herramientas rápidas de la calculadora: no hace falta tener nada cargado.
export default async function ToolsPage({ searchParams }: { searchParams: Promise<{ neto?: string; costo?: string }> }) {
  const { neto, costo } = await searchParams;
  return (
    <AppShell>
      <h1 className="text-3xl">Herramientas</h1>
      <p className="mt-1 text-neutral-600 dark:text-neutral-300">Cuentas rápidas para el día a día. No hace falta tener nada cargado.</p>
      <Tools net={neto ?? ''} cost={costo ?? ''} />
    </AppShell>
  );
}
