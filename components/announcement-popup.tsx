'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Megaphone, RefreshCw, Sparkles, Tag, X } from 'lucide-react';
import { markAnnouncementRead } from '@/app/novedades/actions';
import { kindLabel, type Announcement } from '@/lib/announcements';
import { publicPhotoUrl } from '@/lib/photo';
import { NO_NAV_PATHS } from '@/lib/nav';

const ICONS = { novedad: Sparkles, cambio: RefreshCw, promocion: Tag, aviso: Megaphone } as const;

// Ventanita con el aviso. Al cerrarla (o tocar el botón) queda marcada como vista y no vuelve a aparecer.
export function AnnouncementPopup({ announcement }: { announcement: Announcement }) {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const [closed, setClosed] = useState(false);
  const hiddenHere = NO_NAV_PATHS.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (closed || hiddenHere) return;
    const el = dialog.current;
    // Un instante después de abrir la pantalla, para no tapar la carga.
    const timer = setTimeout(() => { if (el && !el.open) el.showModal(); }, 900);
    return () => clearTimeout(timer);
  }, [closed, hiddenHere]);

  const close = () => {
    dialog.current?.close();
    setClosed(true);
    void markAnnouncementRead(announcement.id);
  };
  if (closed || hiddenHere) return null;
  const Icon = ICONS[announcement.kind as keyof typeof ICONS] ?? Sparkles;
  const external = announcement.button_link?.startsWith('https://');

  return (
    <dialog ref={dialog} onCancel={(e) => { e.preventDefault(); close(); }} aria-labelledby="aviso-titulo"
      className="m-auto w-[min(92vw,26rem)] overflow-hidden rounded-3xl bg-white p-0 text-neutral-900 shadow-2xl backdrop:bg-black/50 dark:bg-neutral-900 dark:text-white">
      {announcement.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={publicPhotoUrl(announcement.image) ?? ''} alt="" className="max-h-56 w-full object-cover" />
      )}
      <div className="p-6">
        <div className="flex items-start justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-800 dark:bg-orange-950 dark:text-orange-300"><Icon size={14} aria-hidden="true" />{kindLabel(announcement.kind)}</span>
          <button type="button" onClick={close} aria-label="Cerrar" className="-mr-2 -mt-2 grid h-9 w-9 place-items-center rounded-full text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"><X size={18} aria-hidden="true" /></button>
        </div>
        <h2 id="aviso-titulo" className="mt-3 text-xl font-semibold">{announcement.title}</h2>
        <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-neutral-700 dark:text-neutral-300">{announcement.body}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {announcement.button_link && announcement.button_label && (external
            ? <a href={announcement.button_link} target="_blank" rel="noopener noreferrer" onClick={close} className="rounded-2xl bg-orange-800 px-4 py-3 font-semibold text-white dark:bg-orange-600">{announcement.button_label}</a>
            : <Link href={announcement.button_link} onClick={close} className="rounded-2xl bg-orange-800 px-4 py-3 font-semibold text-white dark:bg-orange-600">{announcement.button_label}</Link>)}
          <button type="button" onClick={close} className="rounded-2xl bg-neutral-100 px-4 py-3 font-semibold dark:bg-neutral-800">Entendido</button>
        </div>
      </div>
    </dialog>
  );
}
