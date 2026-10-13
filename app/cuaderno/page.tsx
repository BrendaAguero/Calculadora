import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FeatureLocked } from '@/components/feature-locked';
import { getAccessSnapshot, hasFeature } from '@/lib/access/permissions';
import { problemLabel } from '@/lib/problems';
import { createClient } from '@/lib/supabase/server';
import { dateAR, RESULTS, resultInfo, todayAR } from '@/lib/test-logs';
import { cardClass, errorBox, okBox, pageClass } from '@/lib/ui';
import { createLog } from './actions';
import { LogForm } from './log-form';

export const metadata = { title: 'Cuaderno de pruebas · Calculadora Emprender' };

export default async function NotebookPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string; resultado?: string }> }) {
  const { error, ok, resultado } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const filter = RESULTS.some((r) => r.value === resultado) ? resultado! : null;
  let query = supabase.from('test_logs').select('id,made_on,title,material,mix,result,problems,photo,color_recipes(name)').eq('user_id', user.id).order('made_on', { ascending: false }).order('created_at', { ascending: false }).limit(200);
  if (filter) query = query.eq('result', filter);
  const [snapshot, { data: logs, error: loadError }, { data: colors }] = await Promise.all([
    getAccessSnapshot(),
    query,
    supabase.from('color_recipes').select('id,name').eq('user_id', user.id).order('name'),
  ]);
  const allowed = Boolean(snapshot && hasFeature(snapshot, 'CUADERNO'));

  return (
    <main className={pageClass}>
      <header>
        <Link href="/" className="text-sm text-neutral-500 dark:text-neutral-400">← Inicio</Link>
        <h1 className="text-2xl font-semibold">Cuaderno de pruebas</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Anotá cada colada y cómo salió. Así repetís lo que funciona y evitás lo que no.</p>
      </header>
      {ok && <div role="status" className={okBox}>{ok}</div>}
      {(error || loadError) && <div role="alert" className={errorBox}>{error ?? 'No se pudieron cargar tus pruebas.'}</div>}

      {!allowed && <FeatureLocked title="Cuaderno de pruebas es un módulo extra." note="También viene con la Mensualidad Plus." linkLabel="Ver el módulo">Anotá material, proporción, color, temperatura y cómo salió cada pieza, con foto.</FeatureLocked>}

      {allowed && (
        <details className={cardClass} open={!logs?.length}>
          <summary className="cursor-pointer font-semibold">Anotar una prueba</summary>
          <div className="mt-3"><LogForm action={createLog} colors={colors ?? []} today={todayAR()} submitLabel="Guardar en el cuaderno" /></div>
        </details>
      )}

      <nav aria-label="Filtrar por resultado" className="flex flex-wrap gap-2 text-sm">
        <Link href="/cuaderno" className={`rounded-full px-3 py-1.5 ${!filter ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-neutral-100 dark:bg-neutral-800'}`}>Todas</Link>
        {RESULTS.map((r) => <Link key={r.value} href={`/cuaderno?resultado=${r.value}`} className={`rounded-full px-3 py-1.5 ${filter === r.value ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-neutral-100 dark:bg-neutral-800'}`}>{r.emoji} {r.label}</Link>)}
      </nav>

      <section className="grid gap-3">
        {!logs?.length && <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">{filter ? 'No hay pruebas con ese resultado.' : 'Tu cuaderno está vacío.'}</div>}
        {(logs ?? []).map((log) => {
          const info = resultInfo(log.result);
          const color = (Array.isArray(log.color_recipes) ? log.color_recipes[0] : log.color_recipes) as { name: string } | null;
          return (
            <Link key={log.id} href={`/cuaderno/${log.id}`} className="flex gap-3 rounded-2xl border border-neutral-200 bg-white p-3 transition hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900">
              {log.photo
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={log.photo} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                : <span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-neutral-100 text-2xl dark:bg-neutral-800" aria-hidden="true">{info.emoji}</span>}
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2"><span className="font-semibold">{log.title || log.material || 'Prueba'}</span><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${info.badge}`}>{info.label}</span></span>
                <span className="block text-xs text-neutral-500">{[dateAR(log.made_on), log.material, color?.name].filter(Boolean).join(' · ')}</span>
                {log.mix && <span className="block truncate text-sm text-neutral-600 dark:text-neutral-400">{log.mix}</span>}
                {log.problems?.length > 0 && <span className="mt-1 block text-xs text-red-700 dark:text-red-300">{log.problems.map(problemLabel).join(' · ')}</span>}
              </span>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
