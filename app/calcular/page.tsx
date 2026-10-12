import Link from 'next/link';
import { HelpTip } from '@/components/help-tip';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { ActivityTabs } from '@/components/activity-tabs';
import { MIXES } from '@/lib/mixes';
import { createClient } from '@/lib/supabase/server';
import { canUseActivity, getOwnedActivities } from '@/lib/access/activities';
import { getAccessSnapshot } from '@/lib/access/permissions';
import { getSimpleMode } from '@/lib/simple-mode-server';
import { inputsFromCalculation, loadCalculation } from '@/app/historial/data';
import { Calculator, type SavedFormula, type SavedMaterial, type SavedMold, type SavedProduct } from './calculator';

const PER_KG: Record<string, number> = { mg: 1_000_000, g: 1000, kg: 1 };

export default async function CalcularPage({ searchParams }: { searchParams: Promise<{ desde?: string }> }) {
  const { desde } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ activities, error }, access, snapshot] = await Promise.all([
    getOwnedActivities(supabase, user.id),
    canUseActivity(supabase, user.id, 'YESO'),
    getAccessSnapshot(),
  ]);
  const plus = Boolean(snapshot && (snapshot.entrepreneurActive || snapshot.isAdmin || snapshot.isTester));
  const available = plus ? ['YESO', ...MIXES.map(m => m.code)] : activities.map(a => a.code);
  // Edición Personal recién activada: primero elige su actividad principal.
  if (!error && activities.length === 0 && snapshot?.baseLicenseActive && !plus) redirect('/bienvenida');
  // Sin Yeso: se ofrece ir a su actividad.
  if (error || !access.allowed || !access.activityId) {
    const first = MIXES.find(m => available.includes(m.code));
    return (
      <AppShell>
        <ActivityTabs current="YESO" available={available} />
        <section className="rounded-4xl bg-white p-6 dark:bg-neutral-900">
          <h1 className="text-2xl">Calculadora de Yeso</h1>
          <p className="mt-2 text-neutral-600 dark:text-neutral-300">{error ? `No se pudieron cargar tus actividades: ${error}` : 'Yeso no está entre tus actividades. Podés sumarla desde «Mi acceso» o tenerla con la Mensualidad Plus.'}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            {first && <Link href={`/calcular/${first.slug}`} className="rounded-2xl bg-orange-800 px-5 py-3 font-semibold text-white">Ir a {first.name}</Link>}
            <Link href="/access#actividades" className="rounded-2xl border border-neutral-300 px-5 py-3 font-semibold dark:border-neutral-700">Sumar actividades</Link>
          </div>
        </section>
      </AppShell>
    );
  }
  const yeso = { id: access.activityId };

  const [moldsResult, formulasResult, materialsResult, productsResult] = await Promise.all([
    supabase.from('molds').select('id,name,reference_measurement_value,reference_measurement_unit,cost,estimated_uses').eq('user_id', user.id).eq('activity_id', yeso.id).eq('status', 'active').order('name'),
    supabase.from('formulas').select('id,name,current_version_id').eq('user_id', user.id).eq('activity_id', yeso.id).eq('status', 'active').order('name'),
    supabase.from('materials').select('id,name,default_unit,activity_id,current_price_id').eq('user_id', user.id).eq('status', 'active').order('name'),
    supabase.from('products').select('id,name,product_formulas(formula_id,is_default),product_molds(mold_id,is_default)').eq('user_id', user.id).eq('activity_id', yeso.id).eq('status', 'active').order('name'),
  ]);

  const versionIds = (formulasResult.data ?? []).map(f => f.current_version_id).filter((v): v is string => Boolean(v));
  const priceIds = (materialsResult.data ?? []).map(m => m.current_price_id).filter((p): p is string => Boolean(p));
  const [versionsResult, pricesResult] = await Promise.all([
    versionIds.length ? supabase.from('formula_versions').select('id,version_number,water_percentage').in('id', versionIds) : Promise.resolve({ data: [], error: null }),
    priceIds.length ? supabase.from('material_prices').select('id,unit_cost').in('id', priceIds) : Promise.resolve({ data: [], error: null }),
  ]);
  const loadError = [moldsResult.error, formulasResult.error, materialsResult.error, productsResult.error, versionsResult.error, pricesResult.error].find(Boolean)?.message ?? null;

  const versions = new Map((versionsResult.data ?? []).map(v => [v.id, v]));
  const prices = new Map((pricesResult.data ?? []).map(p => [p.id, Number(p.unit_cost)]));

  const molds: SavedMold[] = (moldsResult.data ?? []).map(m => ({ id: m.id, name: m.name, measurement: m.reference_measurement_value == null ? null : Number(m.reference_measurement_value), unit: m.reference_measurement_unit, cost: m.cost == null ? null : Number(m.cost), estimatedUses: m.estimated_uses }));
  const formulas: SavedFormula[] = (formulasResult.data ?? []).map(f => {
    const version = f.current_version_id ? versions.get(f.current_version_id) : undefined;
    return { id: f.id, name: f.name, versionNumber: version?.version_number ?? null, waterPercentage: version?.water_percentage == null ? null : Number(version.water_percentage) };
  });
  // Para el yeso sirven los materiales que se miden en peso, compartidos o de Yeso, y que tienen precio.
  const materials: SavedMaterial[] = (materialsResult.data ?? []).flatMap(m => {
    const factor = PER_KG[m.default_unit];
    const unitCost = m.current_price_id ? prices.get(m.current_price_id) : undefined;
    if (!factor || unitCost == null || (m.activity_id && m.activity_id !== yeso.id)) return [];
    return [{ id: m.id, name: m.name, pricePerKg: unitCost * factor }];
  });

  const products: SavedProduct[] = (productsResult.data ?? []).map(p => ({
    id: p.id,
    name: p.name,
    defaultFormulaId: (p.product_formulas ?? []).find(f => f.is_default)?.formula_id ?? null,
    defaultMoldId: (p.product_molds ?? []).find(m => m.is_default)?.mold_id ?? null,
  }));

  // «Duplicar y editar» desde el historial: se arranca con los datos de ese cálculo.
  const source = desde ? await loadCalculation(supabase, user.id, desde) : null;
  const initial = source?.calculation ? inputsFromCalculation(source.calculation, source.items).inputs : null;

  return (
    <AppShell>
      <ActivityTabs current="YESO" available={available} />
      {initial && <div role="status" className="mb-4 rounded-xl border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100">Copia de un cálculo del historial. Al guardar se crea uno nuevo; el original no cambia.</div>}
      {loadError && <div role="alert" className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">No se pudieron cargar todos tus datos guardados: {loadError}</div>}
      <div className="mb-4"><HelpTip guide="calcular"><p>Elegí el modo, cuántas piezas y los gramos por pieza. ¿No sabés cuánto lleva el molde? Llenalo con agua y pesala.</p><p>El precio sugerido es una referencia: vos decidís el precio final.</p></HelpTip></div>
      <Calculator molds={molds} formulas={formulas} materials={materials} products={products} initial={initial} allowPersonalized={!snapshot?.isFree} simple={await getSimpleMode()} />
    </AppShell>
  );
}
