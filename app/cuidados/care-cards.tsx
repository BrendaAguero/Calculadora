'use client';

import { useEffect, useState } from 'react';
import { MessageCircle, Printer } from 'lucide-react';
import { CARE_TEXTS } from '@/lib/care';
import { cardClass, inputClass } from '@/lib/ui';

const STORE_KEY = 'tarjeta-cuidados';
const label = 'grid gap-1 text-sm font-medium';

export function CareCards({ defaultBusiness }: { defaultBusiness: string }) {
  const [business, setBusiness] = useState(defaultBusiness);
  const [contact, setContact] = useState('');
  const [material, setMaterial] = useState(CARE_TEXTS[0].id);
  const [title, setTitle] = useState(CARE_TEXTS[0].title);
  const [tips, setTips] = useState(CARE_TEXTS[0].tips.join('\n'));
  const [thanks, setThanks] = useState('¡Gracias por elegir algo hecho a mano!');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let saved: { business?: string; contact?: string; thanks?: string } = {};
    try { saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}'); } catch { /* sin almacenamiento */ }
    queueMicrotask(() => {
      if (saved.business) setBusiness(saved.business);
      if (saved.contact) setContact(saved.contact);
      if (saved.thanks) setThanks(saved.thanks);
      setLoaded(true);
    });
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ business, contact, thanks })); } catch { /* sin almacenamiento */ }
  }, [business, contact, thanks, loaded]);

  const pick = (id: string) => {
    const text = CARE_TEXTS.find((c) => c.id === id) ?? CARE_TEXTS[0];
    setMaterial(id);
    setTitle(text.title);
    setTips(text.tips.join('\n'));
  };
  const lines = tips.split('\n').map((t) => t.trim()).filter(Boolean).slice(0, 6);
  const whatsapp = [`*${title}*`, ...lines.map((t) => `• ${t}`), '', thanks, business && `${business}${contact ? ` · ${contact}` : ''}`].filter(Boolean).join('\n');

  const card = (
    <div className="avoid-break flex h-[55mm] w-[85mm] flex-col justify-between overflow-hidden rounded-[3mm] border border-dashed border-neutral-400 bg-white px-[4mm] py-[3.5mm] text-neutral-900">
      <div>
        <p className="text-[10.5pt] font-bold leading-tight">{title}</p>
        <ul className="mt-[1.5mm] grid gap-[0.6mm] text-[7.5pt] leading-snug">
          {lines.map((t) => <li key={t} className="flex gap-[1.5mm]"><span aria-hidden="true">•</span><span>{t}</span></li>)}
        </ul>
      </div>
      <div className="border-t border-neutral-300 pt-[1.2mm] text-[7pt] leading-tight">
        {thanks && <p className="italic">{thanks}</p>}
        {(business || contact) && <p className="font-semibold">{business}{business && contact ? ' · ' : ''}{contact}</p>}
      </div>
    </div>
  );

  return (
    <>
      <div className="no-print mt-5 grid gap-4">
        <section className={cardClass}>
          <label className={label}>Material
            <select value={material} onChange={(e) => pick(e.target.value)} className={inputClass}>
              {CARE_TEXTS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <div className="mt-3 grid gap-3">
            <label className={label}>Título<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={50} className={inputClass} /></label>
            <label className={label}>Cuidados (uno por renglón, hasta 6)<textarea value={tips} onChange={(e) => setTips(e.target.value)} rows={5} maxLength={600} className={inputClass} /></label>
            <label className={label}>Mensaje final<input value={thanks} onChange={(e) => setThanks(e.target.value)} maxLength={80} className={inputClass} /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={label}>Tu emprendimiento<input value={business} onChange={(e) => setBusiness(e.target.value)} maxLength={50} className={inputClass} /></label>
              <label className={label}>Instagram o WhatsApp<input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={50} placeholder="@tu.taller" className={inputClass} /></label>
            </div>
          </div>
        </section>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-2xl bg-orange-800 px-4 py-3 font-semibold text-white dark:bg-orange-600"><Printer size={20} aria-hidden="true" />Imprimir 8 tarjetas</button>
          <a href={`https://wa.me/?text=${encodeURIComponent(whatsapp)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-2xl bg-[#25D366] px-4 py-3 font-semibold text-[#0b3d1f]"><MessageCircle size={20} aria-hidden="true" />Mandar por WhatsApp</a>
        </div>
        <p className="text-sm text-neutral-500">Así queda cada tarjeta (recortá por la línea punteada). Si el texto no entra, acortá los cuidados.</p>
        <div className="overflow-x-auto">{card}</div>
      </div>

      {/* Hoja para imprimir: 8 tarjetas iguales. */}
      <div className="hidden print:grid print:grid-cols-[85mm_85mm] print:justify-center print:gap-[3mm]">
        {Array.from({ length: 8 }, (_, i) => <div key={i}>{card}</div>)}
      </div>
    </>
  );
}
