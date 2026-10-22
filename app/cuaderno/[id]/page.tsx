import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { SubmitButton } from '@/components/submit-button';
import { getAccessSnapshot, hasFeature } from '@/lib/access/permissions';
import { PROBLEMS } from '@/lib/problems';
import { createClient } from '@/lib/supabase/server';
import { photoUrls } from '@/lib/photos';
import { dateAR, resultInfo, todayAR } from '@/lib/test-logs';
import { cardClass, errorBox, okBox, pageClass } from '@/lib/ui';
import { deleteLog, updateLog } from '../actions';
import { LogForm } from '../log-form';

export default async function TestLogPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) {
  const [{ id }, { error, ok }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const [{ data: log }, { data: colors }, snapshot] = await Promise.all([
    supabase.from('test_logs').select('id,made_on,title,material,mix,color_recipe_id,temperature,cure_hours,result,problems,notes,photo,color_recipes(id,name)').eq('id', id).eq('user_id', user.id).maybeSingle(),
    supabase.from('color_recipes').select('id,name').eq('user_id', user.id).order('name'),
    getAccessSnapshot(),
  ]);
  if (!log) notFound();
  const photoSrc = (await photoUrls([log.photo])).get(log.photo ?? '') ?? null;
  const allowed = Boolean(snapshot && hasFeature(snapshot, 'CUADERNO'));
  const info = resultInfo(log.result);
  const color = (Array.isArray(log.color_recipes) ? log.color_recipes[0] : log.color_recipes) as { id: string; name: string } | null;
  const problems = PROBLEMS.filter((p) => log.problems?.includes(p.id));
  const rows: [string, React.ReactNode][] = [
    ['Material', log.material],
    ['Proporción o receta', log.mix],
    ['Color', color ? <Link href={`/colores/${color.id}`} className="underline">{color.name}</Link> : null],
    ['Temperatura', log.temperature != null ? `${Number(log.temperature).toLocaleString('es-AR')} °C` : null],
    ['Desmolde', log.cure_hours != null ? `${Number(log.cure_hours).toLocaleString('es-AR')} h` : null],
  ];

  return (
    <main className={pageClass}>
      <header>
        <Link href="/cuaderno" className="text-sm text-neutral-500 dark:text-neutral-400">← Cuaderno de pruebas</Link>
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold">{log.title || log.material || 'Prueba'}<span className={`rounded-full px-2.5 py-0.5 text-sm font-medium ${info.badge}`}>{info.emoji} {info.label}</span></h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{dateAR(log.made_on)}</p>
      </header>
      {ok && <div role="status" className={okBox}>{ok}</div>}
      {error && <div role="alert" className={errorBox}>{error}</div>}

      <section className={`${cardClass} grid gap-4 sm:grid-cols-[auto_1fr]`}>
        {log.photo && photoSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoSrc} alt="Foto de la prueba" className="h-48 w-48 rounded-2xl object-cover" />
        )}
        <dl className="grid gap-2 text-sm">
          {rows.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="text-xs text-neutral-500">{k}</dt><dd className="font-medium">{v}</dd></div>)}
          {log.notes && <div><dt className="text-xs text-neutral-500">Notas</dt><dd className="whitespace-pre-line">{log.notes}</dd></div>}
        </dl>
      </section>

      {problems.length > 0 && (
        <section className={cardClass}>
          <h2 className="font-semibold">Problemas que tuvo</h2>
          <ul className="mt-2 grid gap-2 text-sm">
            {problems.map((p) => <li key={p.id}><strong>{p.label}:</strong> {p.fix[0]} <Link href={`/ayuda/problemas#${p.id}`} className="underline">Ver más</Link></li>)}
          </ul>
        </section>
      )}

      {allowed && (
        <details className={cardClass}>
          <summary className="cursor-pointer font-semibold">Editar</summary>
          <div className="mt-3"><LogForm action={updateLog} initial={{ ...log, temperature: log.temperature == null ? null : Number(log.temperature), cure_hours: log.cure_hours == null ? null : Number(log.cure_hours), photoSrc }} colors={colors ?? []} today={todayAR()} submitLabel="Guardar cambios" /></div>
        </details>
      )}
      <form action={deleteLog} className="flex flex-wrap items-center gap-3 text-sm">
        <input type="hidden" name="log_id" value={log.id} />
        <label className="flex items-center gap-2"><input type="checkbox" required /> Quiero borrar esta prueba</label>
        <SubmitButton className="rounded-xl border border-red-300 px-3 py-1.5 text-red-700 dark:border-red-900 dark:text-red-300" pendingText="Borrando…">Borrar</SubmitButton>
      </form>
    </main>
  );
}
