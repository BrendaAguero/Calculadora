'use client';

import { useFormStatus } from 'react-dom';

// Botón de envío que se desactiva mientras se guarda, para que un doble toque no repita la acción.
export function SubmitButton({ children, className, pendingText = 'Procesando…', name, value }: { children: React.ReactNode; className?: string; pendingText?: string; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={pending} aria-busy={pending} className={`${className ?? ''} disabled:cursor-wait disabled:opacity-50`}>
      {pending ? pendingText : children}
    </button>
  );
}
