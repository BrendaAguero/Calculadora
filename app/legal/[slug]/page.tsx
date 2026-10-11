import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PublicPage, proseClass } from '@/components/public-page';
import { LEGAL_UPDATED } from '@/lib/legal';
import { LEGAL_DOCS } from '../content';

export function generateStaticParams() {
  return Object.keys(LEGAL_DOCS).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const doc = LEGAL_DOCS[(await params).slug];
  return { title: doc ? `${doc.title} · Calculadora Emprender` : 'Calculadora Emprender' };
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = LEGAL_DOCS[slug];
  if (!doc) notFound();
  return (
    <PublicPage>
      <Link href="/legal" className="text-sm text-neutral-500 dark:text-neutral-400">← Legales</Link>
      <h1 className="mt-2 text-2xl font-bold">{doc.title}</h1>
      <p className="mt-1 text-xs text-neutral-500">Última actualización: {LEGAL_UPDATED}</p>
      <article className={`mt-6 ${proseClass}`}>{doc.body}</article>
    </PublicPage>
  );
}
