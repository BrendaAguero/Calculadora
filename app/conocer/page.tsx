import Link from 'next/link';
import type { Metadata } from 'next';
import { Calculator, CalendarHeart, Check, ClipboardList, FileText, FlaskConical, Palette, Smartphone, Timer, Users, Wallet } from 'lucide-react';
import { LegalLinks } from '@/components/legal-links';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Calculadora Emprender · Precios y costos para tu taller de yeso, resina y más',
  description: 'Calculá cuánto material preparar, cuánto te cuesta cada pieza y a cuánto venderla. Para emprendedoras de yeso, resina, Jesmonite y cemento. Probá gratis.',
  openGraph: {
    title: 'Calculadora Emprender',
    description: 'Cuánto preparar, cuánto cuesta y a cuánto vender cada pieza. Para talleres de yeso, resina, Jesmonite y cemento.',
    images: ['/icons/icon-512.png'],
    locale: 'es_AR',
    type: 'website',
  },
};

const money = (value: number) => value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

const FEATURES = [
  { icon: Calculator, title: 'Cuánto preparar', text: 'Poné cuántas piezas y el molde: te dice cuánto yeso y agua (o resina, Jesmonite o cemento) preparar.' },
  { icon: Wallet, title: 'Costo y precio', text: 'Cuánto te cuesta cada pieza con materiales, packaging y tu tiempo, y a cuánto venderla para ganar.' },
  { icon: Timer, title: 'Temporizadores', text: 'Te avisan cuándo desmoldar y cuándo está curada la pieza, aunque tengas el celular bloqueado.' },
  { icon: FileText, title: 'Para vender', text: 'Presupuestos para encargos, lista para ferias y tarjetas de cuidados para imprimir.' },
  { icon: CalendarHeart, title: 'Fechas para vender', text: 'Día de la Madre, Navidad y más: te avisa cuándo empezar a preparar.' },
  { icon: Users, title: 'Comunidad', text: 'Consejos y tutoriales para mejorar tus piezas y tu emprendimiento.' },
];
const EXTRAS = [
  { icon: ClipboardList, title: 'Pack Ventas y Stock', text: 'Ventas, ganancia del mes, stock, producción, compras y proveedores.' },
  { icon: Palette, title: 'Recetas de color', text: 'Guardá cuánto pigmento lleva cada color y escalalo a cualquier cantidad.' },
  { icon: FlaskConical, title: 'Cuaderno de pruebas', text: 'Anotá cada colada con foto y repetí lo que te salió perfecto.' },
];
const FAQ = [
  { q: '¿Tengo que pagar para probarla?', a: 'No. La versión gratis no vence y no pide tarjeta. Tiene límites (por ejemplo, 5 materiales y 2 productos) y un aviso de publicidad.' },
  { q: '¿La Edición Personal es un pago mensual?', a: 'No: es un pago único. Lo mensual es opcional (Mensualidad Plus) para quien quiere todo desbloqueado.' },
  { q: '¿Funciona en el celular?', a: 'Sí, en el celular y en la computadora. Podés instalarla como una app desde el navegador.' },
  { q: '¿Cómo pago?', a: 'Con Mercado Pago, por transferencia o por MercadoLibre.' },
  { q: '¿Y si me arrepiento?', a: 'Tenés 10 días para pedir la devolución con el botón de arrepentimiento, sin dar explicaciones.' },
];

// Página para quien todavía no tiene cuenta: qué hace la app, precios y cómo empezar.
export default async function LandingPage() {
  const supabase = await createClient();
  const [{ data: prices }, { data: monthly }] = await Promise.all([
    supabase.from('pricing_config').select('key,value_numeric').in('key', ['personal_price_online', 'personal_price_regular']),
    supabase.from('subscription_plans_catalog').select('price').eq('duration_months', 1).eq('active', true).maybeSingle(),
  ]);
  const price = (key: string, fallback: number) => Number(prices?.find((p) => p.key === key)?.value_numeric ?? fallback);
  const personal = price('personal_price_online', 15000);
  const regular = price('personal_price_regular', 0);

  return (
    <div className="min-h-screen text-neutral-900 dark:text-white">
      <header className="terrazo-borde relative bg-orange-800 px-5 pb-16 pt-6 text-white dark:bg-orange-900">
        <nav className="mx-auto flex max-w-5xl items-center justify-between">
          <span className="flex items-center gap-2.5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-resina text-resina-dark"><Calculator size={20} aria-hidden="true" /></span><span className="font-display text-lg font-bold">Calculadora Emprender</span></span>
          <Link href="/login" className="rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold">Entrar</Link>
        </nav>
        <div className="mx-auto mt-12 max-w-5xl">
          <h1 className="max-w-2xl text-[38px] leading-[1.05] lg:text-6xl">Ponele el precio justo a lo que hacés con tus manos</h1>
          <p className="mt-4 max-w-xl text-lg text-white/85">Calculá cuánto material preparar, cuánto te cuesta cada pieza y a cuánto venderla. Para talleres de <strong>yeso, resina, Jesmonite y cemento</strong>.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/registro" className="rounded-2xl bg-resina px-6 py-3.5 text-base font-bold text-resina-dark hover:brightness-105">Probar gratis</Link>
            <Link href="/comprar" className="rounded-2xl bg-white/15 px-6 py-3.5 text-base font-semibold">Comprar la Edición Personal</Link>
          </div>
          <p className="mt-3 text-sm text-white/70">Sin tarjeta. Funciona en el celular y en la computadora.</p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5">
        <section aria-labelledby="que-hace" className="py-14">
          <h2 id="que-hace" className="text-3xl">Todo lo que necesita tu taller</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-3xl bg-white p-5 dark:bg-neutral-900">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300"><Icon size={22} aria-hidden="true" /></span>
                <h3 className="mt-3 text-lg font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{text}</p>
              </article>
            ))}
          </div>
          <h3 className="mt-10 text-xl font-semibold">Y si querés más, sumás módulos</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {EXTRAS.map(({ icon: Icon, title, text }) => (
              <article key={title} className="flex gap-3 rounded-3xl bg-white p-4 dark:bg-neutral-900">
                <Icon size={22} aria-hidden="true" className="mt-0.5 shrink-0 text-orange-800 dark:text-orange-300" />
                <div><h4 className="font-semibold">{title}</h4><p className="text-sm text-neutral-600 dark:text-neutral-300">{text}</p></div>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="precios" className="pb-14">
          <h2 id="precios" className="text-3xl">Precios claros</h2>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <article className="rounded-3xl bg-white p-6 dark:bg-neutral-900">
              <h3 className="text-lg font-semibold">Gratis</h3>
              <p className="mt-1 text-3xl font-bold">$0</p>
              <ul className="mt-4 space-y-1.5 text-sm">
                {['Calculadora de tu actividad', 'Temporizadores y herramientas', 'Comunidad y guías', 'Hasta 5 materiales y 2 productos'].map((t) => <li key={t} className="flex gap-2"><Check size={18} aria-hidden="true" className="shrink-0 text-emerald-700" />{t}</li>)}
              </ul>
              <Link href="/registro" className="mt-5 block rounded-2xl bg-neutral-100 px-4 py-3 text-center font-semibold dark:bg-neutral-800">Probar gratis</Link>
            </article>
            <article className="rounded-3xl bg-orange-800 p-6 text-white ring-4 ring-resina dark:bg-orange-900">
              <h3 className="text-lg font-semibold">Edición Personal</h3>
              {regular > personal && <p className="mt-1 text-sm"><span className="line-through opacity-70">{money(regular)}</span> <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">Precio de lanzamiento</span></p>}
              <p className="mt-1 text-3xl font-bold">{money(personal)}</p>
              <p className="text-sm text-white/80">pago único</p>
              <ul className="mt-4 space-y-1.5 text-sm">
                {['Todo lo de la versión gratis', 'Hasta 100 materiales y 50 productos', 'Fórmulas, moldes e historial', 'En 2 aparatos'].map((t) => <li key={t} className="flex gap-2"><Check size={18} aria-hidden="true" className="shrink-0 text-resina" />{t}</li>)}
              </ul>
              <Link href="/comprar" className="mt-5 block rounded-2xl bg-resina px-4 py-3 text-center font-bold text-resina-dark">Comprar</Link>
            </article>
            <article className="rounded-3xl bg-white p-6 dark:bg-neutral-900">
              <h3 className="text-lg font-semibold">Mensualidad Plus</h3>
              <p className="mt-1 text-3xl font-bold">{money(Number(monthly?.price ?? 4900))}<span className="text-base font-normal text-neutral-500"> /mes</span></p>
              <ul className="mt-4 space-y-1.5 text-sm">
                {['Todas las actividades', 'Pack Ventas y Stock y módulos del taller', 'Sin límites y sin publicidad', 'Modo sin conexión'].map((t) => <li key={t} className="flex gap-2"><Check size={18} aria-hidden="true" className="shrink-0 text-emerald-700" />{t}</li>)}
              </ul>
              <p className="mt-5 text-center text-sm text-neutral-500">Se suma desde la app, cuando quieras.</p>
            </article>
          </div>
        </section>

        <section aria-labelledby="preguntas" className="pb-14">
          <h2 id="preguntas" className="text-3xl">Preguntas frecuentes</h2>
          <div className="mt-5 grid gap-2">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="rounded-2xl bg-white p-4 dark:bg-neutral-900">
                <summary className="cursor-pointer font-semibold">{q}</summary>
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mb-14 rounded-4xl bg-white p-8 text-center dark:bg-neutral-900">
          <Smartphone size={32} aria-hidden="true" className="mx-auto text-orange-800 dark:text-orange-300" />
          <h2 className="mt-3 text-2xl">Empezá hoy, gratis</h2>
          <p className="mt-1 text-neutral-600 dark:text-neutral-300">En un minuto tenés tu cuenta y tu primer cálculo.</p>
          <Link href="/registro" className="mt-5 inline-block rounded-2xl bg-orange-800 px-6 py-3.5 font-bold text-white dark:bg-orange-600">Crear mi cuenta gratis</Link>
        </section>
      </main>
      <footer className="mx-auto max-w-5xl px-5 pb-10"><LegalLinks className="justify-center" /></footer>
    </div>
  );
}
