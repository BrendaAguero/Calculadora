'use client';

import { useEffect, useMemo, useState } from 'react';
import { MessageCircle, Plus, Printer, Trash2 } from 'lucide-react';
import { parseAR } from '@/lib/num';
import { cardClass, inputClass } from '@/lib/ui';

type Item = { description: string; qty: string; price: string };
const n = (value: string) => { const v = parseAR(value); return Number.isFinite(v) && v > 0 ? v : 0; };
const money = (value: number) => value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const label = 'grid gap-1 text-sm font-medium';
const longDate = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const addDays = (ymd: string, days: number) => new Date(Date.parse(`${ymd}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const STORE_KEY = 'presupuesto-negocio';

export function QuoteBuilder({ catalog, defaultBusiness, today }: { catalog: { name: string; price: number }[]; defaultBusiness: string; today: string }) {
  const [business, setBusiness] = useState(defaultBusiness);
  const [contact, setContact] = useState('');
  const [client, setClient] = useState('');
  const [date, setDate] = useState(today);
  const [validDays, setValidDays] = useState('7');
  const [items, setItems] = useState<Item[]>([{ description: '', qty: '1', price: '' }]);
  const [shipping, setShipping] = useState('');
  const [discount, setDiscount] = useState('');
  const [deposit, setDeposit] = useState('50');
  const [delivery, setDelivery] = useState('');
  const [notes, setNotes] = useState('');
  const [loaded, setLoaded] = useState(false);

  // Los datos del emprendimiento se recuerdan en este aparato (no hace falta escribirlos cada vez).
  useEffect(() => {
    let saved: { business?: string; contact?: string } = {};
    try { saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}'); } catch { /* sin almacenamiento */ }
    queueMicrotask(() => {
      if (saved.business) setBusiness(saved.business);
      if (saved.contact) setContact(saved.contact);
      setLoaded(true);
    });
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ business, contact })); } catch { /* sin almacenamiento */ }
  }, [business, contact, loaded]);

  const totals = useMemo(() => {
    const subtotal = items.reduce((acc, i) => acc + n(i.qty) * n(i.price), 0);
    const off = subtotal * Math.min(n(discount), 100) / 100;
    const total = subtotal - off + n(shipping);
    const sign = total * Math.min(n(deposit), 100) / 100;
    return { subtotal, off, total, sign, rest: total - sign };
  }, [items, discount, shipping, deposit]);

  const filled = items.filter((i) => i.description.trim() && n(i.qty) > 0);
  const validUntil = n(validDays) > 0 ? addDays(date, Math.round(n(validDays))) : null;
  const setItem = (index: number, key: keyof Item, value: string) => setItems((list) => list.map((item, i) => {
    if (i !== index) return item;
    const next = { ...item, [key]: value };
    // Si elige uno de sus productos, se completa el precio.
    if (key === 'description' && !item.price) {
      const product = catalog.find((p) => p.name.toLowerCase() === value.trim().toLowerCase());
      if (product?.price) next.price = String(Math.round(product.price));
    }
    return next;
  }));

  const whatsapp = [
    `*Presupuesto${business ? ` · ${business}` : ''}*`,
    client && `Para: ${client}`,
    `Fecha: ${longDate(date)}`,
    '',
    ...filled.map((i) => `• ${i.description} × ${n(i.qty)}: ${money(n(i.qty) * n(i.price))}`),
    '',
    totals.off > 0 && `Descuento: −${money(totals.off)}`,
    n(shipping) > 0 && `Envío: ${money(n(shipping))}`,
    `*Total: ${money(totals.total)}*`,
    n(deposit) > 0 && `Seña para confirmar (${n(deposit)} %): ${money(totals.sign)}`,
    delivery && `Entrega: ${delivery}`,
    validUntil && `Válido hasta el ${longDate(validUntil)}.`,
    notes,
  ].filter((line) => line !== false && line !== null && line !== undefined).join('\n').replace(/\n{3,}/g, '\n\n');

  return (
    <>
      <div className="no-print mt-5 grid gap-4">
        <section className={cardClass}>
          <h2 className="font-semibold">Tus datos</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className={label}>Tu emprendimiento<input value={business} onChange={(e) => setBusiness(e.target.value)} maxLength={80} placeholder="Ej.: Yeso & Luz" className={inputClass} /></label>
            <label className={label}>Contacto<input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={120} placeholder="WhatsApp, Instagram…" className={inputClass} /></label>
          </div>
        </section>
        <section className={cardClass}>
          <h2 className="font-semibold">El pedido</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className={label}>Cliente<input value={client} onChange={(e) => setClient(e.target.value)} maxLength={80} className={inputClass} /></label>
            <label className={label}>Fecha<input type="date" value={date} onChange={(e) => setDate(e.target.value || today)} className={inputClass} /></label>
            <label className={label}>Válido por (días)<input value={validDays} onChange={(e) => setValidDays(e.target.value)} inputMode="numeric" className={inputClass} /></label>
          </div>
          <datalist id="mis-productos">{catalog.map((p) => <option key={p.name} value={p.name} />)}</datalist>
          <div className="mt-4 grid gap-2">
            <div className="grid grid-cols-[1fr_4rem_6.5rem_2rem] gap-2 text-xs font-medium text-neutral-500"><span>Qué</span><span>Cant.</span><span>Precio c/u</span><span /></div>
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-[1fr_4rem_6.5rem_2rem] items-center gap-2">
                <input value={item.description} onChange={(e) => setItem(i, 'description', e.target.value)} list="mis-productos" maxLength={120} placeholder="Ej.: Portavela con nombre" aria-label={`Producto ${i + 1}`} className={inputClass} />
                <input value={item.qty} onChange={(e) => setItem(i, 'qty', e.target.value)} inputMode="decimal" aria-label={`Cantidad ${i + 1}`} className={inputClass} />
                <input value={item.price} onChange={(e) => setItem(i, 'price', e.target.value)} inputMode="decimal" placeholder="$" aria-label={`Precio ${i + 1}`} className={inputClass} />
                <button type="button" onClick={() => setItems((list) => (list.length > 1 ? list.filter((_, j) => j !== i) : [{ description: '', qty: '1', price: '' }]))} aria-label={`Quitar ${i + 1}`} className="grid h-9 w-8 place-items-center text-neutral-400 hover:text-red-600"><Trash2 size={16} aria-hidden="true" /></button>
              </div>
            ))}
            {items.length < 30 && <button type="button" onClick={() => setItems((list) => [...list, { description: '', qty: '1', price: '' }])} className="flex w-fit items-center gap-1.5 rounded-xl bg-neutral-100 px-3 py-2 text-sm font-medium dark:bg-neutral-800"><Plus size={16} aria-hidden="true" />Sumar otro</button>}
            {catalog.length > 0 && <p className="text-xs text-neutral-500">Si escribís el nombre de uno de tus productos, se completa su precio.</p>}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className={label}>Descuento (%)<input value={discount} onChange={(e) => setDiscount(e.target.value)} inputMode="decimal" placeholder="0" className={inputClass} /></label>
            <label className={label}>Envío ($)<input value={shipping} onChange={(e) => setShipping(e.target.value)} inputMode="decimal" placeholder="0" className={inputClass} /></label>
            <label className={label}>Seña (%)<input value={deposit} onChange={(e) => setDeposit(e.target.value)} inputMode="decimal" className={inputClass} /></label>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className={label}>Entrega<input value={delivery} onChange={(e) => setDelivery(e.target.value)} maxLength={120} placeholder="Ej.: 10 días después de la seña" className={inputClass} /></label>
            <label className={label}>Notas<input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} placeholder="Colores, medidas, forma de pago…" className={inputClass} /></label>
          </div>
        </section>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-2xl bg-orange-800 px-4 py-3 font-semibold text-white dark:bg-orange-600"><Printer size={20} aria-hidden="true" />Imprimir o guardar en PDF</button>
          <a href={`https://wa.me/?text=${encodeURIComponent(whatsapp)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-2xl bg-[#25D366] px-4 py-3 font-semibold text-[#0b3d1f]"><MessageCircle size={20} aria-hidden="true" />Mandar por WhatsApp</a>
        </div>
        <p className="text-sm font-medium text-neutral-500">Así queda:</p>
      </div>

      {/* La hoja: se ve en pantalla como vista previa y es lo único que sale al imprimir. */}
      <article className="paper mt-3 rounded-2xl bg-white p-6 text-neutral-900 shadow-sm ring-1 ring-neutral-200 sm:p-10 dark:ring-0">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-neutral-900 pb-4">
          <div>
            <p className="text-2xl font-bold">{business || 'Tu emprendimiento'}</p>
            {contact && <p className="text-sm">{contact}</p>}
          </div>
          <div className="text-right">
            <p className="text-xl font-semibold uppercase tracking-wide">Presupuesto</p>
            <p className="text-sm">{longDate(date)}</p>
          </div>
        </header>
        {client && <p className="mt-4 text-sm">Para: <strong>{client}</strong></p>}
        <table className="mt-4 w-full text-sm">
          <thead><tr className="border-b border-neutral-300 text-left"><th className="py-2 font-semibold">Detalle</th><th className="py-2 text-right font-semibold">Cant.</th><th className="py-2 text-right font-semibold">Precio c/u</th><th className="py-2 text-right font-semibold">Subtotal</th></tr></thead>
          <tbody>
            {filled.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-neutral-400">Sumá lo que lleva el pedido.</td></tr>}
            {filled.map((item, i) => (
              <tr key={i} className="border-b border-neutral-100"><td className="py-2">{item.description}</td><td className="py-2 text-right">{n(item.qty).toLocaleString('es-AR')}</td><td className="py-2 text-right">{money(n(item.price))}</td><td className="py-2 text-right">{money(n(item.qty) * n(item.price))}</td></tr>
            ))}
          </tbody>
        </table>
        <dl className="ml-auto mt-4 grid w-full max-w-xs gap-1 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(totals.subtotal)}</dd></div>
          {totals.off > 0 && <div className="flex justify-between"><dt>Descuento ({n(discount)} %)</dt><dd>−{money(totals.off)}</dd></div>}
          {n(shipping) > 0 && <div className="flex justify-between"><dt>Envío</dt><dd>{money(n(shipping))}</dd></div>}
          <div className="mt-1 flex justify-between border-t-2 border-neutral-900 pt-2 text-lg font-bold"><dt>Total</dt><dd>{money(totals.total)}</dd></div>
          {n(deposit) > 0 && totals.total > 0 && <>
            <div className="flex justify-between"><dt>Seña para confirmar ({n(deposit)} %)</dt><dd>{money(totals.sign)}</dd></div>
            <div className="flex justify-between"><dt>Saldo a la entrega</dt><dd>{money(totals.rest)}</dd></div>
          </>}
        </dl>
        <div className="mt-6 grid gap-1 text-sm">
          {delivery && <p><strong>Entrega:</strong> {delivery}</p>}
          {notes && <p><strong>Notas:</strong> {notes}</p>}
          {validUntil && <p className="text-neutral-600">Presupuesto válido hasta el {longDate(validUntil)}.</p>}
        </div>
      </article>
    </>
  );
}
