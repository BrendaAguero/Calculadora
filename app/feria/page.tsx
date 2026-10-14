import { AppShell } from '@/components/app-shell';
import { FairPlanner } from './fair-planner';

export const metadata = { title: 'Lista para ferias · Calculadora Emprender' };

export default function FairPage() {
  return (
    <AppShell>
      <div className="no-print">
        <h1 className="text-3xl">Lista para ferias</h1>
        <p className="mt-1 text-neutral-600 dark:text-neutral-300">Marcá lo que ya preparaste, sumá lo tuyo e imprimí la lista con la planilla para anotar las ventas del día.</p>
      </div>
      <FairPlanner />
    </AppShell>
  );
}
