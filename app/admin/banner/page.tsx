import Link from 'next/link';
import { SubmitButton } from '@/components/submit-button';
import { requireAdmin } from '@/lib/admin';
import { getBanner } from '@/lib/banner';
import { cardClass, errorBox, inputClass, labelClass, okBox, pageClass, primaryButton } from '@/lib/ui';
import { saveBanner } from '../actions';

export default async function AdminBannerPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  await requireAdmin();
  const banner = await getBanner();

  return (
    <main className={pageClass}>
      <header>
        <Link href="/admin" className="text-sm text-neutral-500 dark:text-neutral-400">← Administración</Link>
        <h1 className="text-2xl font-semibold">Banner de la versión gratis</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Lo ven solo las cuentas gratis, arriba de cada pantalla. Puede promocionar tus planes o a un sponsor.</p>
      </header>
      {ok && <div role="status" className={okBox}>{ok}</div>}
      {error && <div role="alert" className={errorBox}>{error}</div>}
      <form action={saveBanner} className={`${cardClass} grid gap-3`}>
        <label className={labelClass}>Título<input name="title" required maxLength={120} defaultValue={banner.title} className={inputClass} /></label>
        <label className={labelClass}>Texto (opcional)<textarea name="text" rows={2} maxLength={300} defaultValue={banner.text} className={inputClass} /></label>
        <label className={labelClass}>Enlace (opcional): una página de la app, como /access#planes, o una dirección https://<input name="link" maxLength={500} defaultValue={banner.link ?? ''} className={inputClass} /></label>
        <label className={labelClass}>Texto del botón (opcional)<input name="button" maxLength={40} defaultValue={banner.button} className={inputClass} /></label>
        <label className={labelClass}>Imagen (opcional): dirección https:// de una imagen cuadrada<input name="image" maxLength={500} defaultValue={banner.image ?? ''} className={inputClass} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={banner.active} /> Mostrar el banner</label>
        <div><SubmitButton className={primaryButton}>Guardar</SubmitButton></div>
      </form>
    </main>
  );
}
