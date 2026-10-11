import Link from 'next/link';

// Enlaces legales. Los botones de arrepentimiento (Res. 424/2020) y de baja (Res. 316/2018) tienen que estar a la vista.
export function LegalLinks({ className = '' }: { className?: string }) {
  const link = 'underline-offset-2 hover:underline';
  return (
    <nav aria-label="Ayuda y legales" className={`flex flex-wrap gap-x-4 gap-y-2 text-xs text-neutral-500 dark:text-neutral-400 ${className}`}>
      <Link href="/arrepentimiento" className="font-semibold text-orange-800 underline dark:text-orange-300">Botón de arrepentimiento</Link>
      <Link href="/baja" className="font-semibold text-orange-800 underline dark:text-orange-300">Botón de baja</Link>
      <Link href="/ayuda" className={link}>Ayuda</Link>
      <Link href="/legal/terminos" className={link}>Términos</Link>
      <Link href="/legal/privacidad" className={link}>Privacidad</Link>
      <Link href="/legal/compras" className={link}>Compras y reembolsos</Link>
      <Link href="/legal/afiliadas" className={link}>Afiliadas</Link>
    </nav>
  );
}
