import Link from 'next/link';

const PACK_NOTE = 'El pack trae ventas, resumen, stock, producción, compras y proveedores. También viene con Personal Plus.';

// Aviso para una función que requiere la Edición Personal, un extra o Personal Plus.
export function FeatureLocked({ title, children, note = PACK_NOTE, linkLabel = 'Ver el pack' }: { title: string; children: React.ReactNode; note?: string; linkLabel?: string }) {
  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
      <p className="font-medium">{title}</p>
      <p className="mt-1">{children}</p>
      <p className="mt-1">{note}</p>
      <Link href="/access#planes" className="mt-3 inline-block underline">{linkLabel}</Link>
    </div>
  );
}
