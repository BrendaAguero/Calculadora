'use client';

import { useState } from 'react';
import Link from 'next/link';
import { HOME_WIDGETS, WIDGET_PRESETS, type HomeWidget } from '@/lib/home-widgets';
import { MENU_SECTIONS, MENU_SECTION_LABELS } from '@/lib/nav';
import { SubmitButton } from '@/components/submit-button';
import { saveSetup } from './actions';

const MODES = [
  { value: 'simple', title: 'Fácil', text: 'Lo esencial, con botones y letras grandes: cuánto preparar, el precio y tus productos.' },
  { value: 'completo', title: 'Completo', text: 'Todo a mano: tus datos, herramientas, temporizadores y más. Con el Pack Ventas y Stock, también ventas, stock, producción y compras.' },
] as const;
const box = 'flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900';

// Sin el Pack Ventas y Stock no se ofrecen las partes de ventas, stock, producción y compras.
const PACK_WIDGETS = ['acciones', 'ganancias'];
const PACK_SECTIONS = ['produccion', 'compras', 'proveedores', 'resumen'];

export function SetupForm({ initialMode, initialWidgets, initialSections, firstTime, pack = true }: { initialMode: 'simple' | 'completo'; initialWidgets: HomeWidget[] | null; initialSections: Record<string, boolean>; firstTime: boolean; pack?: boolean }) {
  const [mode, setMode] = useState(initialMode);
  const [custom, setCustom] = useState(!firstTime);
  const [widgets, setWidgets] = useState<HomeWidget[]>(initialWidgets ?? WIDGET_PRESETS[initialMode]);
  const chooseMode = (value: 'simple' | 'completo') => { setMode(value); if (!initialWidgets) setWidgets(WIDGET_PRESETS[value]); };

  return (
    <form action={saveSetup} className="mt-6 grid gap-6">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="custom" value={custom ? '1' : '0'} />
      <fieldset className="grid gap-3">
        <legend className="mb-2 text-lg font-semibold">1. ¿Cómo la querés usar?</legend>
        {MODES.map((m) => (
          <button key={m.value} type="button" aria-pressed={mode === m.value} onClick={() => chooseMode(m.value)}
            className={`rounded-3xl border-2 p-5 text-left ${mode === m.value ? 'border-orange-700 bg-orange-50 dark:bg-orange-950/40' : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900'}`}>
            <span className="block text-xl font-bold">{m.title}{m.value === 'simple' ? ' (recomendado para empezar)' : ''}</span>
            <span className="mt-1 block text-neutral-600 dark:text-neutral-300">{m.text}</span>
          </button>
        ))}
      </fieldset>

      {!custom ? (
        <div className="grid gap-3">
          <SubmitButton className="rounded-2xl bg-resina px-5 py-4 text-lg font-bold text-resina-dark">Listo, empezar</SubmitButton>
          <button type="button" onClick={() => setCustom(true)} className="text-sm font-semibold text-orange-800 underline dark:text-orange-300">Prefiero elegir qué ver</button>
        </div>
      ) : (
        <>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-lg font-semibold">2. ¿Qué querés ver en Inicio?</legend>
            {HOME_WIDGETS.filter((w) => pack || !PACK_WIDGETS.includes(w.key)).map((w) => (
              <label key={w.key} className={box}>
                <input type="checkbox" name={`w_${w.key}`} checked={widgets.includes(w.key)} onChange={(e) => setWidgets(e.target.checked ? [...widgets, w.key] : widgets.filter((k) => k !== w.key))} className="mt-1 h-5 w-5 accent-orange-800" />
                <span><span className="block font-semibold">{w.label}</span><span className="block text-sm text-neutral-500 dark:text-neutral-400">{w.hint}</span></span>
              </label>
            ))}
          </fieldset>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-lg font-semibold">3. ¿Qué más hacés?</legend>
            <p className="mb-1 text-sm text-neutral-500 dark:text-neutral-400">Marcá lo que te interesa y aparece en el menú. Lo demás aparece solo cuando lo uses.</p>
            {MENU_SECTIONS.filter((s) => pack || !PACK_SECTIONS.includes(s)).map((s) => (
              <label key={s} className={box}>
                <input type="checkbox" name={`s_${s}`} defaultChecked={initialSections[s]} className="mt-1 h-5 w-5 accent-orange-800" />
                <span className="font-semibold">{MENU_SECTION_LABELS[s]}</span>
              </label>
            ))}
          </fieldset>
          <div className="flex flex-wrap items-center gap-4">
            <SubmitButton className="rounded-2xl bg-resina px-5 py-4 text-lg font-bold text-resina-dark">Guardar</SubmitButton>
            {!firstTime && <Link href="/mas" className="text-sm underline">Cancelar</Link>}
          </div>
        </>
      )}
    </form>
  );
}
