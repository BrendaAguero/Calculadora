import { PhotoInput } from '@/components/photo-input';
import { SubmitButton } from '@/components/submit-button';
import { AUDIENCES, KINDS, toLocalAR } from '@/lib/announcements';
import { inputClass, labelClass, primaryButton } from '@/lib/ui';
import { saveAnnouncement } from '../actions';

type Row = { id: string; kind: string; title: string; body: string; image: string | null; button_label: string | null; button_link: string | null; audience: string; starts_at: string; ends_at: string | null; active: boolean };

export function AnnouncementForm({ row }: { row?: Row }) {
  return (
    <form action={saveAnnouncement} className="grid gap-3">
      {row && <input type="hidden" name="id" value={row.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>Tipo
          <select name="kind" defaultValue={row?.kind ?? 'novedad'} className={inputClass}>{KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select>
        </label>
        <label className={labelClass}>Quién lo ve
          <select name="audience" defaultValue={row?.audience ?? 'all'} className={inputClass}>{AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</select>
        </label>
      </div>
      <label className={labelClass}>Título<input name="title" required minLength={2} maxLength={100} defaultValue={row?.title} placeholder="Ej.: ¡Nueva Comunidad!" className={inputClass} /></label>
      <label className={labelClass}>Texto<textarea name="body" required maxLength={1500} rows={4} defaultValue={row?.body} placeholder="Contá en pocas palabras qué hay de nuevo." className={inputClass} /></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>Texto del botón (opcional)<input name="button_label" maxLength={40} defaultValue={row?.button_label ?? ''} placeholder="Ej.: Ver la promo" className={inputClass} /></label>
        <label className={labelClass}>A dónde lleva<input name="button_link" maxLength={500} defaultValue={row?.button_link ?? ''} placeholder="/access o https://…" className={inputClass} /></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>Desde (vacío = ahora)<input type="datetime-local" name="starts_at" defaultValue={row ? toLocalAR(row.starts_at) : ''} className={inputClass} /></label>
        <label className={labelClass}>Hasta (vacío = sin fin)<input type="datetime-local" name="ends_at" defaultValue={toLocalAR(row?.ends_at ?? null)} className={inputClass} /></label>
      </div>
      {row?.image && (
        <label className={labelClass}>Imagen
          <select name="image_action" defaultValue="keep" className={inputClass}><option value="keep">Dejar la imagen que tiene</option><option value="replace">Cambiarla o sacarla (usa la de abajo)</option></select>
        </label>
      )}
      <PhotoInput name="image" />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={row?.active ?? true} className="h-5 w-5 accent-orange-800" />Activo (se muestra)</label>
      <div><SubmitButton className={primaryButton}>{row ? 'Guardar cambios' : 'Crear aviso'}</SubmitButton></div>
    </form>
  );
}
