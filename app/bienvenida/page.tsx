import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Check, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getOwnedActivities } from '@/lib/access/activities';
import { getAccessSnapshot } from '@/lib/access/permissions';
import { SubmitButton } from '@/components/submit-button';
import { buyActivity } from '@/app/access/actions';
import { choosePrimary } from './actions';

const pesos = (value: number) => value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const ACTIVITIES = [
  { code: 'YESO', name: 'Yeso', text: 'Macetas, portavelas, bandejas y figuras de yeso cerámico o piedra.' },
  { code: 'RESINA', name: 'Resina', text: 'Piezas de resina epoxi: bandejas, posavasos, llaveros, bijou.' },
  { code: 'JESMONITE', name: 'Jesmonite', text: 'Terrazo, bandejas y objetos con Jesmonite (AC100).' },
  { code: 'CEMENTO_DECORATIVO', name: 'Cemento', text: 'Macetas y objetos de cemento decorativo.' },
];

// Primera entrada a la Edición Personal: elegir la actividad principal y, si quiere, una secundaria con descuento.
export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const [{ activities }, snapshot] = await Promise.all([getOwnedActivities(supabase, user.id), getAccessSnapshot()]);
  if (!snapshot?.baseLicenseActive && !snapshot?.isAdmin && !snapshot?.isTester) redirect('/access');
  const primary = activities.find(a => a.isPrimary) ?? activities[0];

  // Paso 2: ya eligió la principal. Ofrecer una secundaria con descuento (solo si todavía tiene una sola).
  let offer: { price: number; regular: number } | null = null;
  if (primary && activities.length === 1) {
    const [{ data: price }, { data: regular }] = await Promise.all([
      supabase.rpc('my_activity_price'),
      supabase.from('pricing_config').select('value_numeric').eq('key', 'activity_price_extra').maybeSingle(),
    ]);
    if (price != null && regular && Number(price) < Number(regular.value_numeric)) offer = { price: Number(price), regular: Number(regular.value_numeric) };
  }
  if (primary && !offer) redirect('/');

  return (
    <main className="min-h-screen px-4 py-10 text-neutral-900 dark:text-white">
      <div className="mx-auto max-w-3xl">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-resina text-resina-dark"><Sparkles size={24} aria-hidden="true" /></span>
        {!primary ? (
          <>
            <h1 className="mt-4 text-3xl lg:text-4xl">¿Con qué material trabajás?</h1>
            <p className="mt-2 text-neutral-600 dark:text-neutral-300">Elegí tu actividad principal: viene incluida en tu Edición Personal. Después podés sumar otras.</p>
            {error && <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">{error}</p>}
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {ACTIVITIES.map(a => (
                <form key={a.code} action={choosePrimary}>
                  <input type="hidden" name="activity" value={a.code} />
                  <SubmitButton className="h-full w-full rounded-3xl bg-white p-5 text-left ring-orange-600 transition hover:ring-2 dark:bg-neutral-900">
                    <span className="block font-display text-xl font-bold">{a.name}</span>
                    <span className="mt-1 block text-sm text-neutral-600 dark:text-neutral-300">{a.text}</span>
                  </SubmitButton>
                </form>
              ))}
            </div>
            <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">La elección es definitiva para la actividad incluida. Con Personal Plus tenés todas.</p>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-3xl lg:text-4xl">¡Listo! Tu actividad principal es {primary.name}</h1>
            <p className="mt-2 text-neutral-600 dark:text-neutral-300">¿Trabajás también con otro material? Sumá una actividad secundaria a <strong>mitad de precio: {pesos(offer!.price)}</strong> en lugar de {pesos(offer!.regular)}.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {ACTIVITIES.filter(a => a.code !== activities[0].code).map(a => (
                <form key={a.code} action={buyActivity} className="flex flex-col rounded-3xl bg-white p-5 dark:bg-neutral-900">
                  <input type="hidden" name="activity" value={a.code} />
                  <input type="hidden" name="name" value={a.name} />
                  <span className="font-display text-xl font-bold">{a.name}</span>
                  <span className="mt-1 flex-1 text-sm text-neutral-600 dark:text-neutral-300">{a.text}</span>
                  <SubmitButton className="mt-4 rounded-2xl bg-resina px-4 py-2.5 font-bold text-resina-dark">Sumar por {pesos(offer!.price)}</SubmitButton>
                </form>
              ))}
            </div>
            <Link href="/" className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-orange-800 px-5 py-3 font-semibold text-white"><Check size={18} aria-hidden="true" />Ahora no, ir a mi taller</Link>
            <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">Si preferís, la sumás más adelante desde «Mi acceso»: tu segunda actividad siempre sale a mitad de precio.</p>
          </>
        )}
      </div>
    </main>
  );
}
