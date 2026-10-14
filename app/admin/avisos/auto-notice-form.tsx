import { SubmitButton } from '@/components/submit-button';
import { AUTO_RULES, KINDS } from '@/lib/announcements';
import { inputClass, labelClass, primaryButton } from '@/lib/ui';
import { saveAutoNotice } from '../actions';

export type AutoRow = { code: string; active: boolean; kind: string; title: string; body: string; button_label: string | null; button_link: string | null; days: number; discount_pct: number; offer_days: number; repeat_days: number };

export function AutoNoticeForm({ row }: { row: AutoRow }) {
  const rule = AUTO_RULES[row.code];
  return (
    <form action={saveAutoNotice} className="grid gap-3">
      <input type="hidden" name="code" value={row.code} />
      <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="active" defaultChecked={row.active} className="h-5 w-5 accent-orange-800" />Encendido</label>
      <div className="grid gap-3 sm:grid-cols-3">
        {rule?.daysLabel ? <label className={labelClass}>{rule.daysLabel}<input name="days" inputMode="numeric" defaultValue={row.days} className={inputClass} /></label> : <input type="hidden" name="days" value={row.days} />}
        {rule?.discount && <>
          <label className={labelClass}>Descuento (%; 0 = sin descuento)<input name="discount_pct" inputMode="numeric" defaultValue={row.discount_pct} className={inputClass} /></label>
          <label className={labelClass}>El descuento dura (días)<input name="offer_days" inputMode="numeric" defaultValue={row.offer_days} className={inputClass} /></label>
        </>}
        {!rule?.discount && <><input type="hidden" name="discount_pct" value="0" /><input type="hidden" name="offer_days" value={row.offer_days} /></>}
        <label className={labelClass}>Repetir cada (días; 0 = una sola vez)<input name="repeat_days" inputMode="numeric" defaultValue={row.repeat_days} className={inputClass} /></label>
      </div>
      <label className={labelClass}>Tipo
        <select name="kind" defaultValue={row.kind} className={inputClass}>{KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select>
      </label>
      <label className={labelClass}>Título<input name="title" required minLength={2} maxLength={100} defaultValue={row.title} className={inputClass} /></label>
      <label className={labelClass}>Texto{rule?.vars ? ` (podés usar ${rule.vars})` : ''}<textarea name="body" required maxLength={1500} rows={3} defaultValue={row.body} className={inputClass} /></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>Texto del botón<input name="button_label" maxLength={40} defaultValue={row.button_label ?? ''} className={inputClass} /></label>
        <label className={labelClass}>A dónde lleva<input name="button_link" maxLength={500} defaultValue={row.button_link ?? ''} placeholder="/comprar" className={inputClass} /></label>
      </div>
      <div><SubmitButton className={primaryButton}>Guardar</SubmitButton></div>
    </form>
  );
}
