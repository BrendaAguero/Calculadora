'use client';

import { useEffect, useState } from 'react';
import { Plus, Printer, RotateCcw, X } from 'lucide-react';
import { cardClass, inputClass } from '@/lib/ui';

type Group = { title: string; items: string[] };
const DEFAULT_GROUPS: Group[] = [
  { title: 'Puesto', items: ['Mesa y sillas (si no las dan)', 'Mantel o tela', 'Exhibidores, cajones o estantes', 'Cartel con tu nombre o logo', 'Cartelitos de precios', 'Luz o guirnalda (ferias de noche)', 'Gazebo o sombrilla (al aire libre)'] },
  { title: 'Cobro', items: ['Cambio en billetes chicos y monedas', 'QR o posnet cargado', 'Alias o CVU escrito a la vista', 'Celular cargado y cargador portátil', 'Calculadora o la app abierta', 'Planilla de ventas (esta hoja)'] },
  { title: 'Empaque', items: ['Bolsas', 'Papel para envolver piezas frágiles', 'Cajitas', 'Tarjetas de cuidados', 'Tarjetas personales o flyer con tu Instagram', 'Cinta, tijera y stickers'] },
  { title: 'Para vos', items: ['Agua y algo para comer', 'Abrigo o protector solar', 'Paño y plumero para las piezas', 'Cinta de embalar, precintos y alfileres', 'Bolsa para la basura'] },
];
const STORE_KEY = 'lista-feria';
type Saved = { name: string; date: string; groups: Group[]; done: string[] };

export function FairPlanner() {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [groups, setGroups] = useState<Group[]>(DEFAULT_GROUPS);
  const [done, setDone] = useState<string[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [rows, setRows] = useState('18');
  const [loaded, setLoaded] = useState(false);

  // Se recuerda en este aparato: lo que marcaste y lo que sumaste.
  useEffect(() => {
    let saved: Partial<Saved> = {};
    try { saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}'); } catch { /* sin almacenamiento */ }
    queueMicrotask(() => {
      if (typeof saved.name === 'string') setName(saved.name);
      if (typeof saved.date === 'string') setDate(saved.date);
      if (Array.isArray(saved.groups) && saved.groups.length) setGroups(saved.groups);
      if (Array.isArray(saved.done)) setDone(saved.done);
      setLoaded(true);
    });
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ name, date, groups, done })); } catch { /* sin almacenamiento */ }
  }, [name, date, groups, done, loaded]);

  const key = (group: string, item: string) => `${group}::${item}`;
  const toggle = (k: string) => setDone((list) => (list.includes(k) ? list.filter((x) => x !== k) : [...list, k]));
  const add = (title: string) => {
    const text = (draft[title] ?? '').trim().slice(0, 80);
    if (!text) return;
    setGroups((list) => list.map((g) => (g.title === title && !g.items.includes(text) ? { ...g, items: [...g.items, text] } : g)));
    setDraft((d) => ({ ...d, [title]: '' }));
  };
  const remove = (title: string, item: string) => {
    setGroups((list) => list.map((g) => (g.title === title ? { ...g, items: g.items.filter((i) => i !== item) } : g)));
    setDone((list) => list.filter((x) => x !== key(title, item)));
  };
  const total = groups.reduce((acc, g) => acc + g.items.length, 0);
  const lines = Math.min(Math.max(Math.round(Number(rows) || 18), 5), 40);
  const longDate = date ? new Date(`${date}T12:00:00Z`).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }) : '';

  return (
    <>
      <div className="no-print mt-5 grid gap-4">
        <section className={`${cardClass} grid gap-3 sm:grid-cols-2`}>
          <label className="grid gap-1 text-sm font-medium">Feria<input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Ej.: Feria del Parque" className={inputClass} /></label>
          <label className="grid gap-1 text-sm font-medium">Fecha<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} /></label>
        </section>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">Listo: <strong>{done.length} de {total}</strong></p>
        {groups.map((g) => (
          <section key={g.title} className={cardClass}>
            <h2 className="font-semibold">{g.title}</h2>
            <ul className="mt-2 grid gap-1">
              {g.items.map((item) => {
                const k = key(g.title, item);
                return (
                  <li key={k} className="flex items-center gap-3">
                    <input id={k} type="checkbox" checked={done.includes(k)} onChange={() => toggle(k)} className="h-5 w-5 accent-orange-800" />
                    <label htmlFor={k} className={`flex-1 py-1 ${done.includes(k) ? 'text-neutral-400 line-through' : ''}`}>{item}</label>
                    <button type="button" onClick={() => remove(g.title, item)} aria-label={`Quitar ${item}`} className="text-neutral-300 hover:text-red-600"><X size={16} aria-hidden="true" /></button>
                  </li>
                );
              })}
            </ul>
            <form onSubmit={(e) => { e.preventDefault(); add(g.title); }} className="mt-2 flex gap-2">
              <input value={draft[g.title] ?? ''} onChange={(e) => setDraft((d) => ({ ...d, [g.title]: e.target.value }))} maxLength={80} placeholder="Sumar algo" aria-label={`Sumar a ${g.title}`} className={inputClass} />
              <button className="grid w-11 shrink-0 place-items-center rounded-xl bg-neutral-100 dark:bg-neutral-800" aria-label="Sumar"><Plus size={18} aria-hidden="true" /></button>
            </form>
          </section>
        ))}
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm font-medium">Renglones de la planilla<input value={rows} onChange={(e) => setRows(e.target.value)} inputMode="numeric" className={`${inputClass} w-24`} /></label>
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-2xl bg-orange-800 px-4 py-3 font-semibold text-white dark:bg-orange-600"><Printer size={20} aria-hidden="true" />Imprimir o guardar en PDF</button>
          <button type="button" onClick={() => { setDone([]); }} className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-medium dark:bg-neutral-900"><RotateCcw size={16} aria-hidden="true" />Desmarcar todo (nueva feria)</button>
          <button type="button" onClick={() => { setGroups(DEFAULT_GROUPS); setDone([]); }} className="text-sm text-neutral-500 underline">Volver a la lista original</button>
        </div>
        <p className="text-sm font-medium text-neutral-500">Así sale impresa:</p>
      </div>

      {/* Hoja 1: lista para tildar con birome. Hoja 2: planilla de ventas del día. */}
      <article className="paper mt-3 rounded-2xl bg-white p-6 text-neutral-900 shadow-sm ring-1 ring-neutral-200 sm:p-10 dark:ring-0">
        <header className="border-b-2 border-neutral-900 pb-3">
          <p className="text-2xl font-bold">Lista para la feria{name ? `: ${name}` : ''}</p>
          {longDate && <p className="text-sm first-letter:uppercase">{longDate}</p>}
        </header>
        <div className="mt-4 columns-1 gap-8 sm:columns-2 print:columns-2">
          {groups.map((g) => (
            <section key={g.title} className="avoid-break mb-4">
              <h3 className="font-bold uppercase tracking-wide">{g.title}</h3>
              <ul className="mt-1 grid gap-1 text-sm">
                {g.items.map((item) => (
                  <li key={item} className="flex items-start gap-2"><span className="mt-0.5 inline-block h-4 w-4 shrink-0 border-2 border-neutral-900 text-center text-[10px] leading-3">{done.includes(key(g.title, item)) ? '✓' : ''}</span>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </article>

      <article className="paper mt-4 rounded-2xl bg-white p-6 text-neutral-900 shadow-sm ring-1 ring-neutral-200 sm:p-10 dark:ring-0 print:break-before-page">
        <header className="flex flex-wrap items-end justify-between gap-2 border-b-2 border-neutral-900 pb-3">
          <p className="text-2xl font-bold">Ventas del día{name ? ` · ${name}` : ''}</p>
          <p className="text-sm">{longDate || 'Fecha: ____________'}</p>
        </header>
        <p className="mt-3 text-sm">Caja al empezar: $ ____________</p>
        <table className="mt-3 w-full border-collapse text-sm">
          <thead>
            <tr className="text-left">
              <th className="w-8 border border-neutral-400 px-1 py-1.5">#</th>
              <th className="border border-neutral-400 px-2 py-1.5">Producto</th>
              <th className="w-14 border border-neutral-400 px-2 py-1.5">Cant.</th>
              <th className="w-24 border border-neutral-400 px-2 py-1.5">Precio</th>
              <th className="w-28 border border-neutral-400 px-2 py-1.5">Pago</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: lines }, (_, i) => (
              <tr key={i}>
                <td className="border border-neutral-400 px-1 py-2.5 text-center text-xs text-neutral-500">{i + 1}</td>
                <td className="border border-neutral-400" /><td className="border border-neutral-400" /><td className="border border-neutral-400" />
                <td className="border border-neutral-400 px-1 text-[10px] text-neutral-500">Ef. · Transf. · QR</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2 print:grid-cols-2">
          <p>Total efectivo: $ ____________</p>
          <p>Total transferencia / QR: $ ____________</p>
          <p>Caja al terminar: $ ____________</p>
          <p className="font-bold">Total vendido: $ ____________</p>
        </div>
        <p className="mt-4 text-sm">Lo que más se vendió / pedidos y contactos:</p>
        <div className="mt-2 grid gap-5">{[0, 1].map((i) => <div key={i} className="border-b border-neutral-400" />)}</div>
      </article>
    </>
  );
}
