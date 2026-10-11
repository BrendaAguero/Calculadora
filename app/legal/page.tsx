import Link from 'next/link';
import { PublicPage } from '@/components/public-page';
import { cardClass } from '@/lib/ui';
import { LEGAL_DOCS } from './content';

export const metadata = { title: 'Legales · Calculadora Emprender' };

export default function LegalIndex() {
  return (
    <PublicPage>
      <h1 className="text-2xl font-bold">Legales</h1>
      <div className="mt-6 grid gap-3">
        {Object.entries(LEGAL_DOCS).map(([slug, doc]) => (
          <Link key={slug} href={`/legal/${slug}`} className={cardClass}>
            <h2 className="font-semibold">{doc.title}</h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{doc.summary}</p>
          </Link>
        ))}
        <Link href="/arrepentimiento" className={cardClass}>
          <h2 className="font-semibold">Botón de arrepentimiento</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Revocá una compra dentro de los 10 días.</p>
        </Link>
      </div>
    </PublicPage>
  );
}
