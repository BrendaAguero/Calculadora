import { TimersBoard } from '../temporizadores/board';
import { HomeTimers } from '@/components/home-timers';
import { pageClass } from '@/lib/ui';

const at = (ms: number) => new Date(Date.now() + ms).toISOString();

export default function Prueba() {
  const timers = [
    { id: 'a', label: 'Macetas · Desmoldar', created_at: at(-30 * 60_000), ends_at: at(13 * 60_000), done_at: null },
    { id: 'b', label: 'Resina · Curado completo', created_at: at(-24 * 3600_000), ends_at: at(5 * 86400_000), done_at: null },
    { id: 'c', label: 'Jesmonite · Desmoldar', created_at: at(-60 * 60_000), ends_at: at(-60_000), done_at: null },
  ];
  return (
    <main className={pageClass}>
      <HomeTimers timers={timers} />
      <TimersBoard timers={timers} />
    </main>
  );
}
