import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Lock } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { ActivityTabs } from '@/components/activity-tabs';
import { createClient } from '@/lib/supabase/server';
import { canUseActivity, getOwnedActivities } from '@/lib/access/activities';
import { getAccessSnapshot, hasFeature } from '@/lib/access/permissions';
import { mergeSettings, mixBySlug, MIXES } from '@/lib/mixes';
import { MixCalculator } from './mix-calculator';

export default async function MixPage({ params }: { params: Promise<{ actividad: string }> }) {
  const { actividad } = await params;
  const def = mixBySlug(actividad);
  if (!def) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [access, { activities }, snapshot, { data: saved }] = await Promise.all([
    canUseActivity(supabase, user.id, def.code),
    getOwnedActivities(supabase, user.id),
    getAccessSnapshot(),
    supabase.from('activity_settings').select('settings').eq('user_id', user.id).eq('activity_code', def.code).maybeSingle(),
  ]);
  const plus = Boolean(snapshot && (snapshot.entrepreneurActive || snapshot.isAdmin || snapshot.isTester));
  const available = plus ? ['YESO', ...MIXES.map(m => m.code)] : activities.map(a => a.code);
  if (activities.length === 0 && snapshot?.baseLicenseActive && !plus) redirect('/bienvenida');

  return (
    <AppShell>
      <ActivityTabs current={def.code} available={available} />
      {access.allowed ? (
        <MixCalculator code={def.code} initialSettings={mergeSettings(def, saved?.settings)} hasSaved={Boolean(saved)} canSell={!snapshot || hasFeature(snapshot, 'VENTAS')} />
      ) : (
        <section className="rounded-4xl bg-white p-6 dark:bg-neutral-900">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300"><Lock size={22} aria-hidden="true" /></span>
          <h1 className="mt-4 text-2xl">Calculadora de {def.name}</h1>
          <p className="mt-2 text-neutral-600 dark:text-neutral-300">{def.intro} Calcula cuánto preparar de cada componente, el costo de cada pieza y el precio de venta.</p>
          <p className="mt-2 text-neutral-600 dark:text-neutral-300">Sumala desde «Mi acceso» o tenela con la <strong>Mensualidad Plus</strong>, que incluye todas las actividades.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/access#actividades" className="rounded-2xl bg-resina px-5 py-3 font-bold text-resina-dark">Sumar {def.name}</Link>
            <Link href="/calcular" className="rounded-2xl border border-neutral-300 px-5 py-3 font-semibold dark:border-neutral-700">Volver a Yeso</Link>
          </div>
        </section>
      )}
    </AppShell>
  );
}
