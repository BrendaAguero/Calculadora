import Link from 'next/link';
import { PublicPage } from '@/components/public-page';
import { CONTACT_EMAIL } from '@/lib/legal';
import { PROBLEMS } from '@/lib/problems';

export const metadata = {
  title: '¿Qué le pasó a mi pieza? · Calculadora Emprender',
  description: 'Burbujas, resina pegajosa, fisuras, yeso que no fragua: por qué pasa y cómo evitarlo.',
};

// Gratis para todos (también sin cuenta): ayuda a resolver problemas comunes al colar.
export default function ProblemsPage() {
  return (
    <PublicPage>
      <Link href="/ayuda" className="text-sm text-neutral-500 dark:text-neutral-400">← Ayuda</Link>
      <h1 className="mt-2 text-2xl font-bold">¿Qué le pasó a mi pieza?</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">Elegí lo que te pasó y mirá por qué suele pasar y cómo evitarlo la próxima vez.</p>

      <nav aria-label="Problemas" className="mt-4 flex flex-wrap gap-2">
        {PROBLEMS.map((p) => <a key={p.id} href={`#${p.id}`} className="rounded-full border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:border-orange-700 dark:border-neutral-700">{p.label}</a>)}
      </nav>

      <div className="mt-6 grid gap-4">
        {PROBLEMS.map((p) => (
          <section key={p.id} id={p.id} className="scroll-mt-4 rounded-3xl bg-white p-5 dark:bg-neutral-900">
            <h2 className="text-lg font-semibold">{p.label}</h2>
            <p className="mt-0.5 text-xs text-neutral-500">{p.materials.join(' · ')}</p>
            <h3 className="mt-3 text-sm font-semibold">Por qué pasa</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-neutral-700 dark:text-neutral-300">{p.why.map((w) => <li key={w}>{w}</li>)}</ul>
            <h3 className="mt-3 text-sm font-semibold">Cómo evitarlo</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-neutral-700 dark:text-neutral-300">{p.fix.map((f) => <li key={f}>{f}</li>)}</ul>
          </section>
        ))}
      </div>

      <p className="mt-6 text-sm text-neutral-600 dark:text-neutral-400">Siempre seguí las indicaciones de la marca de tu material. ¿Te pasó algo que no está acá? Escribinos a <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
    </PublicPage>
  );
}
