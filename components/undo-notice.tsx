import { Undo2 } from 'lucide-react';
import { SubmitButton } from '@/components/submit-button';

// Aviso después de anular o archivar algo, con un botón para deshacerlo.
export function UndoNotice({ message, action, field, id }: { message: string; action: (formData: FormData) => Promise<void>; field: string; id: string }) {
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-2xl bg-neutral-900 px-4 py-3 text-sm text-white dark:bg-neutral-800">
      <span className="flex-1">{message}</span>
      <form action={action}>
        <input type="hidden" name={field} value={id} />
        <SubmitButton className="inline-flex items-center gap-1.5 rounded-xl bg-resina px-3 py-1.5 font-bold text-resina-dark"><Undo2 size={16} aria-hidden="true" />Deshacer</SubmitButton>
      </form>
    </div>
  );
}
