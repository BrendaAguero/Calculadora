import Link from 'next/link';
import { SubmitButton } from '@/components/submit-button';
import { CopyButton } from '@/components/copy-button';
import { requireAdmin } from '@/lib/admin';
import { money } from '@/app/stock/constants';
import { siteOrigin } from '@/lib/origin';
import { SCOPE_LABELS, upcomingSuggestions, type DiscountScope } from '@/lib/discount-suggestions';
import { cardClass, dateOnly, errorBox, inputClass, labelClass, okBox, pageClass, primaryButton } from '@/lib/ui';
import { createDiscountCodes, setDiscountCodeActive } from '../actions';

type Row = {
  id: string; code: string; kind: 'percent' | 'amount'; value: number; applies_to: DiscountScope[];
  starts_at: string; expires_at: string | null; max_uses: number | null; once_per_person: boolean; first_purchase_only: boolean;
  only_email: string | null; note: string | null; batch: string | null; active: boolean; created_at: string;
  uses: number; paid_uses: number; amount_off: number;
};

const btn = 'rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium dark:border-neutral-700';
const SCOPES = Object.keys(SCOPE_LABELS) as DiscountScope[];
const fmtDay = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function status(row: Row, now: number): [string, string] {
  if (!row.active) return ['Pausado', 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'];
  if (row.expires_at && new Date(row.expires_at).getTime() <= now) return ['Vencido', 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'];
  if (row.max_uses != null && Number(row.uses) >= row.max_uses) return ['Agotado', 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'];
  if (new Date(row.starts_at).getTime() > now) return ['Programado', 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200'];
  return ['Vigente', 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'];
}

const discountText = (row: Pick<Row, 'kind' | 'value'>) => (row.kind === 'percent' ? `${Number(row.value)} %` : money(row.value));

function details(row: Row, now: number) {
  const parts = [row.applies_to.map((s) => SCOPE_LABELS[s]).join(', ')];
  parts.push(row.expires_at ? `${new Date(row.starts_at).getTime() > now ? `del ${dateOnly(row.starts_at)} ` : ''}hasta el ${dateOnly(row.expires_at)}` : 'sin vencimiento');
  if (row.max_uses != null) parts.push(`máx. ${row.max_uses} ${row.max_uses === 1 ? 'uso' : 'usos'}`);
  if (row.first_purchase_only) parts.push('solo primera compra');
  if (row.only_email) parts.push(`solo para ${row.only_email}`);
  return parts.join(' · ');
}

export default async function AdminDiscountsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; sugerencia?: string; nuevos?: string }> }) {
  const { ok, error, sugerencia, nuevos } = await searchParams;
  const { supabase } = await requireAdmin();
  const [{ data }, origin] = await Promise.all([supabase.rpc('admin_discount_codes'), siteOrigin()]);
  const rows = (data ?? []) as Row[];
  const now = new Date().getTime();
  const suggestions = upcomingSuggestions(new Date(), 120);
  const picked = suggestions.find((s) => s.key === sugerencia);
  const created = (nuevos ?? '').split(',').filter(Boolean);

  // Los lotes se muestran juntos; los códigos sueltos, uno por fila.
  const singles = rows.filter((r) => !r.batch);
  const batches = new Map<string, Row[]>();
  for (const r of rows.filter((r) => r.batch)) batches.set(r.batch!, [...(batches.get(r.batch!) ?? []), r]);
  const totalOff = rows.reduce((sum, r) => sum + Number(r.amount_off), 0);
  const totalPaid = rows.reduce((sum, r) => sum + Number(r.paid_uses), 0);

  return (
    <main className={pageClass}>
      <header>
        <Link href="/admin" className="text-sm text-neutral-500 dark:text-neutral-400">← Administración</Link>
        <h1 className="text-2xl font-semibold">Códigos de descuento</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Se escriben al comprar o llegan con un enlace. El descuento se aplica antes de pagar en Mercado Pago. Se usa un solo descuento por compra: si la persona ya tiene uno mayor (antigüedad, oferta o afiliada), queda ese.</p>
      </header>
      {ok && <div role="status" className={okBox}>{ok}</div>}
      {error && <div role="alert" className={errorBox}>{error}</div>}

      {created.length > 0 && (
        <section id="nuevos" className={cardClass}>
          <h2 className="font-semibold">Listo: {created.length} códigos nuevos</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Cada uno sirve una sola vez. Copialos y repartilos como quieras (por ejemplo, uno por clienta o en un sorteo).</p>
          <textarea readOnly rows={Math.min(10, created.length)} className={`${inputClass} mt-3 font-mono`} defaultValue={created.join('\n')} />
          <div className="mt-2"><CopyButton text={created.join('\n')} label="Copiar todos" /></div>
        </section>
      )}

      <section className={cardClass}>
        <h2 className="font-semibold">Sugerencias para las próximas fechas</h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Tocá una para completar el formulario. Podés cambiar todo antes de crearla.</p>
        {!suggestions.length ? <p className="mt-2 text-sm text-neutral-500">No hay fechas especiales en los próximos meses.</p> : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">{suggestions.map((s) => {
            const exists = rows.some((r) => r.code === s.code);
            return (
              <li key={s.key} className="rounded-2xl border border-neutral-200 p-3 text-sm dark:border-neutral-800">
                <p className="font-semibold">{s.name} <span className="font-normal text-neutral-500">· {fmtDay(s.eventDay)}</span></p>
                <p className="mt-1"><span className="font-mono font-semibold">{s.code}</span> · {s.pct} % · del {fmtDay(s.start)} al {fmtDay(s.end)}</p>
                <p className="mt-1 text-xs text-neutral-500">{s.why}{s.estimated ? ' Fecha estimada: confirmala con la oficial.' : ''}</p>
                {exists ? <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">✓ Ya lo creaste</p>
                  : <Link href={`/admin/descuentos?sugerencia=${s.key}#crear`} className={`${btn} mt-2 inline-block`}>Usar esta sugerencia</Link>}
              </li>
            );
          })}</ul>
        )}
      </section>

      <form id="crear" action={createDiscountCodes} className={`${cardClass} grid gap-3 sm:grid-cols-2`} key={picked?.key ?? 'nuevo'}>
        <h2 className="font-semibold sm:col-span-2">{picked ? `Crear código: ${picked.name}` : 'Crear códigos'}</h2>
        <fieldset className="flex flex-wrap gap-4 text-sm sm:col-span-2">
          <label className="flex items-center gap-2"><input type="radio" name="mode" value="single" defaultChecked />Un código (el texto lo elegís vos)</label>
          <label className="flex items-center gap-2"><input type="radio" name="mode" value="batch" />Varios códigos únicos (de un solo uso cada uno)</label>
        </fieldset>
        <label className={labelClass}>Código o prefijo<input name="code" required maxLength={20} defaultValue={picked?.code ?? ''} placeholder="Ej.: NAVIDAD26 o VIP" autoCapitalize="characters" className={`${inputClass} uppercase`} /><span>Solo letras y números. Con «varios», se agregan 6 letras al azar: VIP → VIPK7M2QA.</span></label>
        <label className={labelClass}>Cantidad (solo para «varios»)<input name="count" inputMode="numeric" defaultValue="10" className={inputClass} /><span>De 2 a 200.</span></label>
        <label className={labelClass}>Tipo de descuento
          <select name="kind" defaultValue="percent" className={inputClass}><option value="percent">Porcentaje (%)</option><option value="amount">Monto fijo ($)</option></select>
        </label>
        <label className={labelClass}>Descuento<input name="value" required inputMode="decimal" defaultValue={picked?.pct ?? 10} className={inputClass} /><span>Hasta 90 %. El precio nunca baja del 10 % del original.</span></label>
        <fieldset className="grid gap-1 text-sm sm:col-span-2">
          <legend className="mb-1 text-xs text-neutral-500 dark:text-neutral-400">Sirve para</legend>
          <div className="flex flex-wrap gap-4">{SCOPES.map((s) => (
            <label key={s} className="flex items-center gap-2"><input type="checkbox" name="applies_to" value={s} defaultChecked={picked ? picked.appliesTo.includes(s) : s !== 'plus_6'} />{SCOPE_LABELS[s]}</label>
          ))}</div>
          <span className="text-xs text-neutral-500">Personal Plus mensual no lleva códigos: Mercado Pago cobra el mismo monto todos los meses.</span>
        </fieldset>
        <label className={labelClass}>Desde (opcional)<input type="date" name="starts_on" defaultValue={picked?.start ?? ''} className={inputClass} /></label>
        <label className={labelClass}>Vence (opcional)<input type="date" name="expires_on" defaultValue={picked?.end ?? ''} className={inputClass} /><span>Vale hasta las 23:59 de ese día.</span></label>
        <label className={labelClass}>Usos máximos en total (opcional)<input name="max_uses" inputMode="numeric" placeholder="Sin límite" className={inputClass} /><span>Ej.: 50 para «las primeras 50». En «varios», cada código se usa una vez.</span></label>
        <label className={labelClass}>Nota interna (opcional)<input name="note" maxLength={200} defaultValue={picked ? `Sugerencia: ${picked.name}` : ''} placeholder="Ej.: sorteo de Instagram" className={inputClass} /></label>
        <fieldset className="grid gap-2 rounded-2xl border border-neutral-200 p-3 text-sm dark:border-neutral-800 sm:col-span-2">
          <legend className="px-1 text-xs font-semibold text-neutral-600 dark:text-neutral-300">Opciones especiales</legend>
          <label className="flex items-start gap-2"><input type="checkbox" name="once_per_person" defaultChecked className="mt-1" /><span>Una vez por persona</span></label>
          <label className="flex items-start gap-2"><input type="checkbox" name="first_purchase_only" className="mt-1" /><span>Solo para la primera compra (quien nunca compró)</span></label>
          <label className={labelClass}>Código personal: solo para este email (opcional)<input name="only_email" type="email" maxLength={200} placeholder="clienta@ejemplo.com" className={inputClass} /><span>Por ejemplo, un regalo de cumpleaños o una disculpa por un problema.</span></label>
        </fieldset>
        <div className="sm:col-span-2"><SubmitButton className={primaryButton}>Crear</SubmitButton></div>
      </form>

      <section className={cardClass}>
        <h2 className="font-semibold">Tus códigos</h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Compras pagadas con código: {totalPaid} · descontado en total: {money(totalOff)}. Los códigos no se borran: se pausan, así queda el historial.</p>
        {!rows.length ? <p className="mt-2 text-sm text-neutral-500">Todavía no creaste códigos.</p> : (
          <ul className="mt-3 divide-y divide-neutral-100 text-sm dark:divide-neutral-800">
            {singles.map((r) => {
              const [label, tone] = status(r, now);
              const link = `${origin}/codigo/${r.code}`;
              return (
                <li key={r.id} className="py-3">
                  <p className="flex flex-wrap items-center gap-2"><strong className="font-mono">{r.code}</strong> <span>{discountText(r)}</span><span className={`rounded-full px-2 py-0.5 text-xs ${tone}`}>{label}</span></p>
                  <p className="mt-1 text-xs text-neutral-500">{details(r, now)}{r.note ? ` · ${r.note}` : ''}</p>
                  <p className="mt-1 text-xs">Usado {Number(r.paid_uses)} {Number(r.paid_uses) === 1 ? 'vez' : 'veces'}{Number(r.uses) > Number(r.paid_uses) ? ` (+${Number(r.uses) - Number(r.paid_uses)} pago en curso)` : ''} · descontado {money(r.amount_off)}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {r.active && label !== 'Vencido' && <CopyButton text={link} label="Copiar enlace" />}
                    <form action={setDiscountCodeActive}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="active" value={r.active ? '0' : '1'} /><SubmitButton className={btn}>{r.active ? 'Pausar' : 'Activar'}</SubmitButton></form>
                  </div>
                </li>
              );
            })}
            {[...batches.entries()].map(([batch, list]) => {
              const first = list[0];
              const used = list.filter((r) => Number(r.paid_uses) > 0).length;
              const anyActive = list.some((r) => r.active);
              return (
                <li key={batch} className="py-3">
                  <p className="flex flex-wrap items-center gap-2"><strong>Lote {batch}</strong> <span>{discountText(first)}</span><span className="text-xs text-neutral-500">{list.length} códigos · {used} usados</span></p>
                  <p className="mt-1 text-xs text-neutral-500">{details(first, now)}{first.note ? ` · ${first.note}` : ''} · descontado {money(list.reduce((s, r) => s + Number(r.amount_off), 0))}</p>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-medium">Ver los códigos</summary>
                    <p className="mt-2 font-mono text-xs leading-6">{list.map((r) => <span key={r.id} className={`mr-3 ${Number(r.paid_uses) > 0 || !r.active ? 'text-neutral-400 line-through' : ''}`}>{r.code}</span>)}</p>
                    <div className="mt-2"><CopyButton text={list.filter((r) => r.active && Number(r.uses) === 0).map((r) => r.code).join('\n')} label="Copiar los sin usar" /></div>
                  </details>
                  <form action={setDiscountCodeActive} className="mt-2"><input type="hidden" name="batch" value={batch} /><input type="hidden" name="active" value={anyActive ? '0' : '1'} /><SubmitButton className={btn}>{anyActive ? 'Pausar el lote' : 'Activar el lote'}</SubmitButton></form>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
