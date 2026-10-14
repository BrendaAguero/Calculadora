import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { createClient } from '@/lib/supabase/server';
import { CareCards } from './care-cards';

export const metadata = { title: 'Tarjeta de cuidados · Calculadora Emprender' };

export default async function CarePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
  return (
    <AppShell>
      <div className="no-print">
        <h1 className="text-3xl">Tarjeta de cuidados</h1>
        <p className="mt-1 text-neutral-600 dark:text-neutral-300">Una tarjetita para entregar con cada pieza: cómo cuidarla y dónde encontrarte. Salen 8 por hoja A4 (tamaño tarjeta personal).</p>
      </div>
      <CareCards defaultBusiness={profile?.full_name ?? ''} />
    </AppShell>
  );
}
