import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { createClient } from '@/lib/supabase/server';
import { todayAR } from '@/lib/test-logs';
import { QuoteBuilder } from './quote-builder';

export const metadata = { title: 'Presupuesto · Calculadora Emprender' };

type Price = { price_type: string; quantity_min: number; price: number; valid_from: string; valid_until: string | null };

// Presupuesto para encargos: se arma en pantalla y se imprime, se guarda en PDF o se manda por WhatsApp.
export default async function QuotePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const [{ data: products }, { data: profile }] = await Promise.all([
    supabase.from('products').select('name,product_prices(price_type,quantity_min,price,valid_from,valid_until)').eq('user_id', user.id).eq('status', 'active').order('name').limit(300),
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
  ]);
  const now = new Date();
  // Para sumar productos propios con su precio minorista vigente.
  const catalog = (products ?? []).flatMap((p) => {
    const current = ((p.product_prices ?? []) as Price[]).filter((x) => new Date(x.valid_from) <= now && (!x.valid_until || new Date(x.valid_until) > now) && Number(x.quantity_min) <= 1);
    const retail = current.find((x) => x.price_type === 'retail') ?? current.find((x) => x.price_type === 'manual') ?? current.find((x) => x.price_type === 'promotional');
    return retail ? [{ name: p.name, price: Number(retail.price) }] : [{ name: p.name, price: 0 }];
  });
  return (
    <AppShell>
      <div className="no-print">
        <h1 className="text-3xl">Presupuesto</h1>
        <p className="mt-1 text-neutral-600 dark:text-neutral-300">Para encargos y pedidos personalizados. Completalo y abajo ves cómo queda: imprimilo, guardalo en PDF o mandalo por WhatsApp.</p>
      </div>
      <QuoteBuilder catalog={catalog} defaultBusiness={profile?.full_name ?? ''} today={todayAR()} />
    </AppShell>
  );
}
