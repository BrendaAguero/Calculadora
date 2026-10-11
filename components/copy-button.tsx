'use client';

import { useState } from 'react';

// Copia un texto al portapapeles y avisa por unos segundos.
export function CopyButton({ text, label = 'Copiar' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium dark:border-neutral-700"
    >
      <span aria-live="polite">{copied ? 'Copiado ✓' : label}</span>
    </button>
  );
}
