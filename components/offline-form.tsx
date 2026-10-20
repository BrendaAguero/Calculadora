'use client';

import { useState, type ComponentProps } from 'react';
import Link from 'next/link';
import { CloudOff } from 'lucide-react';
import { enqueue, isOffline, offlineEnabled, type FormType } from '@/lib/outbox';

type Props = Omit<ComponentProps<'form'>, 'onSubmit'> & {
  kind: FormType;
  // Texto para la lista de pendientes. Puede usar el valor de un campo: «Material {name}».
  label: string;
  // Sin conexión: renombra campos o agrega otros (por ejemplo, el formulario de producción).
  rename?: Record<string, string>;
  extra?: Record<string, string>;
  again?: string;
};

// Formulario que, sin conexión (Personal Plus), se guarda en el aparato y se sube solo al volver internet.
export function OfflineForm({ kind, label, rename, extra, again, children, ...props }: Props) {
  const [queued, setQueued] = useState<string | null>(null);
  if (queued) {
    return (
      <div role="status" className="rounded-3xl bg-orange-50 p-5 text-sm dark:bg-orange-950/40">
        <p className="flex items-center gap-2 font-semibold"><CloudOff size={18} aria-hidden="true" />Guardado sin conexión</p>
        <p className="mt-1">«{queued}» quedó en este aparato y se sube solo cuando vuelva internet.</p>
        {again ? <Link href={again} className="mt-3 inline-block font-semibold underline">Cargar otro</Link>
          : <button type="button" onClick={() => setQueued(null)} className="mt-3 font-semibold underline">Cargar otro</button>}
      </div>
    );
  }
  return (
    <form {...props} onSubmit={async (event) => {
      if (!isOffline() || !offlineEnabled()) return;
      event.preventDefault();
      // Incluye el botón tocado (por ejemplo «Registrar sin descontar»).
      const data = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
      const fields: [string, string][] = [];
      data.forEach((value, key) => { if (typeof value === 'string' && !key.startsWith('$ACTION')) fields.push([rename?.[key] ?? key, value]); });
      for (const [key, value] of Object.entries(extra ?? {})) fields.push([key, value]);
      const text = label.replace(/\{(\w+)\}/g, (_, key: string) => String(data.get(key) ?? '').trim()).trim();
      await enqueue(kind, { fields }, text);
      setQueued(text);
    }}>
      {children}
    </form>
  );
}
