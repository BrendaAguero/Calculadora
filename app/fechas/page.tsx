import Link from 'next/link';
import { CalendarHeart } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { upcomingSaleDates } from '@/lib/sale-dates';
import { todayAR } from '@/lib/test-logs';

export const metadata = { title: 'Fechas para vender · Calculadora Emprender' };

const longDate = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const shortDate = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const left = (days: number) => (days === 0 ? 'Es hoy' : days === 1 ? 'Es mañana' : `Faltan ${days} días`);

// Calendario de fechas comerciales: cuándo caen y desde cuándo conviene preparar el stock.
export default function SaleDatesPage() {
  const dates = upcomingSaleDates(todayAR());
  return (
    <AppShell>
      <h1 className="text-3xl">Fechas para vender</h1>
      <p className="mt-1 text-neutral-600 dark:text-neutral-300">Las fechas fuertes del año y desde cuándo conviene empezar a producir y publicar. Te avisamos en Inicio cuando se acerca una.</p>
      <ol className="mt-5 grid gap-3">
        {dates.map((d) => (
          <li key={`${d.id}-${d.date}`} className={`rounded-3xl p-5 ${d.preparing ? 'bg-orange-800 text-white dark:bg-orange-900' : 'bg-white dark:bg-neutral-900'}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold"><CalendarHeart size={20} aria-hidden="true" />{d.name}</h2>
                <p className={`text-sm first-letter:uppercase ${d.preparing ? 'text-white/85' : 'text-neutral-500 dark:text-neutral-400'}`}>{longDate(d.date)}{d.approx ? ' (fecha aproximada)' : ''}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-sm font-semibold ${d.preparing ? 'bg-white/15' : 'bg-neutral-100 dark:bg-neutral-800'}`}>{left(d.daysLeft)}</span>
            </div>
            <p className={`mt-2 text-sm ${d.preparing ? 'text-white/90' : 'text-neutral-600 dark:text-neutral-300'}`}>{d.ideas}</p>
            <p className={`mt-1 text-xs ${d.preparing ? 'font-semibold' : 'text-neutral-500'}`}>{d.preparing ? '¡Es momento de preparar! ' : ''}Conviene empezar {d.prepWeeks} semanas antes: desde el {shortDate(d.prepFrom)}.</p>
          </li>
        ))}
      </ol>
      <p className="mt-6 text-sm text-neutral-600 dark:text-neutral-300">Para calcular cuánto producir, usá <Link href="/calcular" className="font-medium underline">Calcular</Link>. Para los encargos, armá un <Link href="/presupuesto" className="font-medium underline">presupuesto</Link>.</p>
    </AppShell>
  );
}
