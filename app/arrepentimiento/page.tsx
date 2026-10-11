import { PublicPage } from '@/components/public-page';
import { SubmitButton } from '@/components/submit-button';
import { CONTACT_EMAIL } from '@/lib/legal';
import { createClient } from '@/lib/supabase/server';
import { cardClass, errorBox, inputClass, labelClass, okBox, primaryButton } from '@/lib/ui';
import { submitRegret } from './actions';

export const metadata = { title: 'Botón de arrepentimiento · Calculadora Emprender' };

export default async function RegretPage({ searchParams }: { searchParams: Promise<{ codigo?: string; error?: string }> }) {
  const { codigo, error } = await searchParams;
  // No hace falta sesión; si la hay, se completan nombre y email.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user ? await supabase.from('profiles').select('full_name,email').eq('id', user.id).maybeSingle() : { data: null };

  return (
    <PublicPage>
      <h1 className="text-2xl font-bold">Botón de arrepentimiento</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        Podés revocar una compra dentro de los <strong>10 días corridos</strong> desde que la hiciste, sin dar motivos y sin costo (art. 34, Ley 24.240).
        No hace falta iniciar sesión. Te devolvemos el total por el mismo medio de pago.
      </p>

      {codigo ? (
        <div role="status" className={`mt-6 ${okBox}`}>
          <p className="font-semibold">Recibimos tu pedido.</p>
          <p className="mt-1">Tu código de trámite es <strong className="font-mono text-base">{codigo}</strong>. Guardalo.</p>
          <p className="mt-1">Vamos a revisar la compra y procesar la devolución. Si necesitamos algo, te escribimos al email que dejaste. Consultas: <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
        </div>
      ) : (
        <form action={submitRegret} className={`mt-6 grid gap-3 ${cardClass}`}>
          {error && <div role="alert" className={errorBox}>{error}</div>}
          <label className={labelClass}>Nombre y apellido<input name="full_name" required minLength={2} maxLength={120} autoComplete="name" defaultValue={profile?.full_name ?? ''} className={inputClass} /></label>
          <label className={labelClass}>Email de la cuenta o con el que pagaste<input name="email" type="email" required maxLength={200} autoComplete="email" defaultValue={profile?.email ?? user?.email ?? ''} className={inputClass} /></label>
          <label className={labelClass}>Fecha de la compra (opcional)<input name="purchase_date" type="date" className={inputClass} /></label>
          <label className={labelClass}>Número de operación de Mercado Pago o qué compraste (opcional)<input name="purchase_reference" maxLength={120} className={inputClass} placeholder="Ej.: 183629276202 o Emprendedor 6 meses" /></label>
          <label className={labelClass}>Comentario (opcional)<textarea name="details" rows={3} maxLength={1000} className={inputClass} /></label>
          <div><SubmitButton className={primaryButton} pendingText="Enviando…">Revocar mi compra</SubmitButton></div>
          <p className="text-xs text-neutral-500">También podés pedirlo escribiendo a <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
        </form>
      )}
    </PublicPage>
  );
}
