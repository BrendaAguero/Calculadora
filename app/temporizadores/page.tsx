import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FeatureLocked } from '@/components/feature-locked';
import { SubmitButton } from '@/components/submit-button';
import { getAccessSnapshot, hasFeature } from '@/lib/access/permissions';
import { createClient } from '@/lib/supabase/server';
import { cardClass, errorBox, okBox, pageClass } from '@/lib/ui';
import { clearFinished, startTimers } from './actions';
import { TimersBoard } from './board';
import { NewTimers } from './new-timers';

export const metadata = { title: 'Temporizadores · Calculadora Emprender' };

export default async function TimersPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { error, ok } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const [snapshot, { data: timers }] = await Promise.all([
    getAccessSnapshot(),
    supabase.from('cure_timers').select('id,label,ends_at,done_at').eq('user_id', user.id).order('ends_at').limit(100),
  ]);
  const allowed = Boolean(snapshot && hasFeature(snapshot, 'TEMPORIZADORES'));
  const finished = (timers ?? []).filter((t) => t.done_at).length;

  return (
    <main className={pageClass}>
      <header>
        <Link href="/" className="text-sm text-neutral-500 dark:text-neutral-400">← Inicio</Link>
        <h1 className="text-2xl font-semibold">Temporizadores de curado</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">La app te avisa cuándo desmoldar y cuándo está curada cada pieza.</p>
      </header>
      {ok && <div role="status" className={okBox}>{ok}</div>}
      {error && <div role="alert" className={errorBox}>{error}</div>}

      {!allowed && <FeatureLocked title="Temporizadores es un módulo extra." note="También viene con la Mensualidad Plus." linkLabel="Ver el módulo">Avisos para no desmoldar antes de tiempo, con los tiempos típicos de yeso, resina, jesmonite y cemento.</FeatureLocked>}

      <TimersBoard timers={timers ?? []} />
      {finished > 0 && <form action={clearFinished}><SubmitButton className="text-sm text-neutral-500 underline" pendingText="Limpiando…">Borrar los {finished} ya terminados</SubmitButton></form>}

      {allowed && (
        <section className={cardClass}>
          <h2 className="mb-3 font-semibold">Nuevo temporizador</h2>
          <NewTimers action={startTimers} />
        </section>
      )}
      <p className="text-xs text-neutral-500">El aviso suena mientras la app esté abierta (en cualquier pantalla). Con el celular bloqueado o la app cerrada puede no sonar: fijate la hora de cada aviso.</p>
    </main>
  );
}
