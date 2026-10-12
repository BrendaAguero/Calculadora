import Link from 'next/link';
import { Plus, TriangleAlert } from 'lucide-react';
import { redirect } from 'next/navigation';
import { HelpTip } from '@/components/help-tip';
import { AppShell } from '@/components/app-shell';
import { SubmitButton } from '@/components/submit-button';
import { UndoNotice } from '@/components/undo-notice';
import { createClient } from '@/lib/supabase/server';
import { cardClass, errorBox, inputClass, okBox, primaryButton } from '@/lib/ui';
import { OLD_PRICE_DAYS, ageLabel, daysSince } from '@/lib/price-age';
import { raiseMaterialPrices, restoreMaterial } from './actions';

const nowMs = () => Date.now();
const money = (value: number) => value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: value < 10 ? 4 : 2 });

export default async function MaterialsPage({ searchParams }: { searchParams: Promise<{ archivado?: string; ok?: string; error?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: materials } = await supabase
    .from('materials')
    .select('id,name,default_unit,status,current_price_id')
    .eq('user_id', user.id)
    .order('status', { ascending: true })
    .order('name', { ascending: true });

  const priceIds = (materials ?? []).map(m => m.current_price_id).filter(Boolean) as string[];
  const { data: prices } = priceIds.length
    ? await supabase.from('material_prices').select('id,unit_cost,valid_from,is_estimated').in('id', priceIds)
    : { data: [] as { id: string; unit_cost: number; valid_from: string; is_estimated: boolean }[] };
  const priceMap = new Map((prices ?? []).map(price => [price.id, price]));
  const now = nowMs();
  const active = (materials ?? []).filter(m => m.status === 'active');
  const archived = (materials ?? []).filter(m => m.status !== 'active');
  const old = active.filter(m => {
    const price = m.current_price_id ? priceMap.get(m.current_price_id) : null;
    return price && daysSince(price.valid_from, now) >= OLD_PRICE_DAYS;
  });

  const row = (material: (typeof active)[number]) => {
    const price = material.current_price_id ? priceMap.get(material.current_price_id) : null;
    const days = price ? daysSince(price.valid_from, now) : null;
    return (
      <Link key={material.id} href={`/materials/${material.id}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-neutral-50 dark:hover:bg-neutral-800">
        <div className="min-w-0">
          <p className="truncate font-semibold">{material.name}</p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {price ? <>Precio de {ageLabel(days!)}{price.is_estimated ? ' (estimado)' : ''}</> : 'Sin precio'}
            {days !== null && days >= OLD_PRICE_DAYS && material.status === 'active' && <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200"><TriangleAlert size={12} aria-hidden="true" />revisar</span>}
          </p>
        </div>
        <p className="shrink-0 text-right font-display font-bold">{price ? money(Number(price.unit_cost)) : '—'}<span className="block text-xs font-normal text-neutral-500">por {material.default_unit}</span></p>
      </Link>
    );
  };

  return (
    <AppShell>
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl">Mis materiales</h1>
          <p className="mt-1 text-neutral-600 dark:text-neutral-300">Lo que usás para hacer tus piezas, con lo que te cuesta cada gramo o unidad.</p>
        </div>
        <Link href="/materials/new" className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-resina px-4 py-2.5 font-bold text-resina-dark"><Plus size={18} aria-hidden="true" />Nuevo</Link>
      </header>

      <div className="mt-5 space-y-4">
        {params.archivado && <UndoNotice message="Material archivado. Ya no aparece en la calculadora." action={restoreMaterial} field="material_id" id={params.archivado} />}
        {params.ok && <div role="status" className={okBox}>{params.ok}</div>}
        {params.error && <div role="alert" className={errorBox}>{params.error}</div>}
        <HelpTip guide="empezar"><p>Cargá cada material con lo que pagaste y la cantidad: la aplicación calcula el costo por gramo, mililitro o unidad.</p><p>Si cambia el precio, actualizalo: el anterior queda en el historial y los cálculos guardados no cambian.</p></HelpTip>

        {old.length > 0 && (
          <section className="rounded-3xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/40">
            <h2 className="flex items-center gap-2 text-lg"><TriangleAlert size={20} aria-hidden="true" className="text-amber-700" />{old.length === 1 ? '1 precio para revisar' : `${old.length} precios para revisar`}</h2>
            <p className="mt-1 text-sm">Hace más de {OLD_PRICE_DAYS / 30} meses que no {old.length === 1 ? 'cambia' : 'cambian'}. Si aumentaron, tus cálculos dan menos costo del real. Actualizá cada uno con lo que pagaste, o subilos todos de una vez:</p>
            <RaiseForm withOld />
          </section>
        )}

        <section className={`${cardClass} overflow-hidden p-0`}>
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">{active.map(row)}</div>
          {!active.length && <p className="p-6 text-center text-sm text-neutral-500">Todavía no tenés materiales. <Link href="/materials/new" className="font-semibold underline">Cargá el primero</Link>.</p>}
        </section>

        {old.length === 0 && active.length > 0 && (
          <details className={cardClass}>
            <summary className="cursor-pointer font-semibold">Subir todos los precios un porcentaje</summary>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">Útil cuando todo aumentó parecido y no tenés las facturas a mano.</p>
            <RaiseForm />
          </details>
        )}

        {archived.length > 0 && (
          <details className={`${cardClass} overflow-hidden p-0`}>
            <summary className="cursor-pointer px-5 py-4 font-semibold">Archivados ({archived.length})</summary>
            <div className="divide-y divide-neutral-100 border-t border-neutral-100 opacity-70 dark:divide-neutral-800 dark:border-neutral-800">{archived.map(row)}</div>
          </details>
        )}
      </div>
    </AppShell>
  );
}

function RaiseForm({ withOld = false }: { withOld?: boolean }) {
  return (
    <form action={raiseMaterialPrices} className="mt-3 flex flex-wrap items-end gap-2">
      <label className="grid gap-1 text-sm font-medium">Aumento (%)<input name="percent" inputMode="decimal" required placeholder="Ej.: 10" className={`${inputClass} w-28`} /></label>
      {withOld && <label className="flex items-center gap-2 pb-2.5 text-sm"><input type="checkbox" name="only_old" defaultChecked /> Solo los de hace más de {OLD_PRICE_DAYS / 30} meses</label>}
      <SubmitButton className={primaryButton}>Subir precios</SubmitButton>
    </form>
  );
}
