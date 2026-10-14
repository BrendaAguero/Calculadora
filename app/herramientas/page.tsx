import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { CalendarHeart, ClipboardCheck, FileText, Sparkles } from 'lucide-react';
import { Tools } from './tools';

const SELL_TOOLS = [
  { href: '/presupuesto', label: 'Presupuesto para encargos', hint: 'Armalo e imprimilo o mandalo por WhatsApp.', icon: FileText },
  { href: '/feria', label: 'Lista para ferias', hint: 'Qué llevar y planilla de ventas del día, para imprimir.', icon: ClipboardCheck },
  { href: '/cuidados', label: 'Tarjeta de cuidados', hint: 'Cómo cuidar la pieza, para imprimir y regalar con cada venta.', icon: Sparkles },
  { href: '/fechas', label: 'Fechas para vender', hint: 'Día de la Madre, Navidad y más: cuándo preparar.', icon: CalendarHeart },
];

// Herramientas rápidas de la calculadora: no hace falta tener nada cargado.
export default async function ToolsPage({ searchParams }: { searchParams: Promise<{ neto?: string; costo?: string }> }) {
  const { neto, costo } = await searchParams;
  return (
    <AppShell>
      <h1 className="text-3xl">Herramientas</h1>
      <p className="mt-1 text-neutral-600 dark:text-neutral-300">Cuentas rápidas para el día a día. No hace falta tener nada cargado.</p>
      <Tools net={neto ?? ''} cost={costo ?? ''} />
      <h2 className="mt-8 text-xl font-semibold">Para vender</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {SELL_TOOLS.map(({ href, label, hint, icon: Icon }) => (
          <Link key={href} href={href} className="flex items-start gap-3 rounded-3xl bg-white p-4 transition hover:ring-2 hover:ring-orange-200 dark:bg-neutral-900">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300"><Icon size={20} aria-hidden="true" /></span>
            <span><span className="block font-semibold">{label}</span><span className="text-sm text-neutral-600 dark:text-neutral-300">{hint}</span></span>
          </Link>
        ))}
      </div>
      <p className="mt-6 text-sm text-neutral-600 dark:text-neutral-300">¿Te salió mal una pieza? Mirá <Link href="/ayuda/problemas" className="font-medium underline">¿Qué le pasó a mi pieza?</Link>: burbujas, resina pegajosa, fisuras y más.</p>
    </AppShell>
  );
}
