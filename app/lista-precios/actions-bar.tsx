'use client';

import { useState } from 'react';
import { Copy, MessageCircle, Printer } from 'lucide-react';

const button = 'inline-flex items-center gap-2 rounded-2xl px-4 py-3 font-semibold';

export function PriceListActions({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className={`${button} bg-[#25D366] text-[#0b3d1f]`}><MessageCircle size={20} aria-hidden="true" />Mandar por WhatsApp</a>
      <button type="button" onClick={() => window.print()} className={`${button} bg-white dark:bg-neutral-900`}><Printer size={20} aria-hidden="true" />Guardar en PDF o imprimir</button>
      <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); } catch { setCopied(false); } }} className={`${button} bg-white dark:bg-neutral-900`}><Copy size={20} aria-hidden="true" />{copied ? 'Copiada' : 'Copiar texto'}</button>
    </div>
  );
}
