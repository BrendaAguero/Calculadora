import Link from "next/link";
import { getAccessSnapshot, showsAds } from "@/lib/access/permissions";
import { getBanner } from "@/lib/banner";

// Banner fijo de la Edición Personal. Lo ocultan Mensualidad Plus, la administración y la cuenta de prueba. Sin cookies ni anuncios de terceros.
export async function FreeBanner() {
  const snapshot = await getAccessSnapshot();
  if (!snapshot || !showsAds(snapshot)) return null;
  const banner = await getBanner();
  if (!banner.active) return null;

  const body = (
    <div className="flex items-center gap-3">
      {banner.image && (
        // eslint-disable-next-line @next/next/no-img-element -- imagen externa elegida por la administración
        <img src={banner.image} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{banner.title}</p>
        {banner.text && <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-300">{banner.text}</p>}
      </div>
      {banner.link && banner.button && <span className="shrink-0 rounded-lg bg-orange-700 px-3 py-1.5 text-xs font-semibold text-white">{banner.button}</span>}
    </div>
  );
  const box = "mb-4 block rounded-2xl border border-orange-200 bg-orange-50 p-3 dark:border-orange-900 dark:bg-orange-950/30";

  return (
    <aside aria-label="Publicidad">
      <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-400">Publicidad</p>
      {banner.link?.startsWith("/") ? <Link href={banner.link} className={box}>{body}</Link>
        : banner.link ? <a href={banner.link} target="_blank" rel="noopener noreferrer sponsored" className={box}>{body}</a>
        : <div className={box}>{body}</div>}
    </aside>
  );
}
