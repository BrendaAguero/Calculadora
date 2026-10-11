import Link from 'next/link';
import { PublicPage } from '@/components/public-page';
import { SubmitButton } from '@/components/submit-button';
import { CONTACT_EMAIL } from '@/lib/legal';
import { createClient } from '@/lib/supabase/server';
import { cardClass, errorBox, inputClass, labelClass, okBox, primaryButton } from '@/lib/ui';
import { cancelMySubscriptions, submitCancellation } from './actions';

export const metadata = { title: 'Botón de baja · Calculadora Emprender' };

const date = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { dateStyle: 'long', timeZone: 'America/Argentina/Buenos_Aires' });

// Botón de baja (Res. 316/2018): dar de baja la suscripción tan fácil como se contrató.
export default async function CancellationPage({ searchParams }: { searchParams: Promise<{ codigo?: string; error?: string }> }) {
  const { codigo, error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: renewing } = user
    ? await supabase.from('subscriptions').select('id,expires_at,status').eq('user_id', user.id).eq('auto_renew', true).in('status', ['active', 'pending']).order('expires_at', { ascending: false })
    : { data: null };

  return (
    <PublicPage>
      <h1 className="text-2xl font-bold">Botón de baja</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        Desde acá das de baja la Mensualidad Plus: no se te vuelve a cobrar. Lo que ya pagaste sigue activo hasta que vence.
        La Edición Personal y los extras son de pago único, así que no tienen nada que dar de baja.
      </p>

      {codigo && (
        <div role="status" className={`mt-6 ${okBox}`}>
          <p className="font-semibold">Listo, recibimos tu baja.</p>
          <p className="mt-1">Tu código de baja es <strong className="font-mono text-base">{codigo}</strong>. Guardalo.</p>
          <p className="mt-1">Consultas: <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
        </div>
      )}
      {error && <div role="alert" className={`mt-6 ${errorBox}`}>{error}</div>}

      {!codigo && user && (
        <section className={`mt-6 ${cardClass}`}>
          {renewing?.length ? (
            <>
              <p className="text-sm">Tenés la suscripción mensual con renovación automática{renewing[0].status === 'active' ? `; Plus sigue activo hasta el ${date(renewing[0].expires_at)}` : ''}.</p>
              <form action={cancelMySubscriptions} className="mt-4">
                <SubmitButton className={primaryButton} pendingText="Dando de baja…">Dar de baja mi suscripción</SubmitButton>
              </form>
            </>
          ) : (
            <p className="text-sm">No tenés ninguna suscripción que se renueve sola: no hay nada para dar de baja. Si querés eliminar tu cuenta, podés pedirlo desde <Link href="/profile" className="underline">Mi perfil</Link>.</p>
          )}
        </section>
      )}

      {!codigo && !user && (
        <>
          <p className="mt-6 text-sm">Lo más rápido es <Link href="/login" className="underline">iniciar sesión</Link> y volver a esta página: la baja es inmediata. Si no podés entrar, completá esto y la procesamos nosotros:</p>
          <form action={submitCancellation} className={`mt-4 grid gap-3 ${cardClass}`}>
            <label className={labelClass}>Nombre y apellido<input name="full_name" required minLength={2} maxLength={120} autoComplete="name" className={inputClass} /></label>
            <label className={labelClass}>Email de tu cuenta<input name="email" type="email" required maxLength={200} autoComplete="email" className={inputClass} /></label>
            <label className={labelClass}>Comentario (opcional)<textarea name="details" rows={3} maxLength={1000} className={inputClass} /></label>
            <div><SubmitButton className={primaryButton} pendingText="Enviando…">Pedir la baja</SubmitButton></div>
          </form>
        </>
      )}
    </PublicPage>
  );
}
