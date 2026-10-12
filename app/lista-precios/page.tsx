import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/app-shell';
import { cardClass } from '@/lib/ui';
import { PriceListActions } from './actions-bar';

const one = <T,>(value: T | T[] | null) => (Array.isArray(value) ? value[0] : value);
const pesos = (value: number) => value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

type Price = { price_type: string; quantity_min: number; price: number; valid_from: string; valid_until: string | null };

// Lista de precios para mandar a las clientas: cada producto activo con su precio minorista y mayorista vigentes.
export default async function PriceListPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: products }, { data: profile }] = await Promise.all([
    supabase.from('products').select('id,name,activities(name),product_prices(price_type,quantity_min,price,valid_from,valid_until)').eq('user_id', user.id).eq('status', 'active').order('name'),
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
  ]);

  const now = new Date();
  const rows = (products ?? []).map((p) => {
    const current = ((p.product_prices ?? []) as Price[]).filter((x) => new Date(x.valid_from) <= now && (!x.valid_until || new Date(x.valid_until) > now));
    const pick = (type: string) => current.filter((x) => x.price_type === type).sort((a, b) => Number(a.quantity_min) - Number(b.quantity_min))[0];
    const retail = pick('retail') ?? pick('manual') ?? pick('promotional');
    const wholesale = pick('wholesale');
    return {
      id: p.id, name: p.name, activity: one(p.activities as { name: string } | { name: string }[] | null)?.name ?? null,
      retail: retail ? Number(retail.price) : null,
      wholesale: wholesale ? { price: Number(wholesale.price), from: Number(wholesale.quantity_min) } : null,
    };
  });
  const priced = rows.filter((r) => r.retail !== null || r.wholesale !== null);
  const missing = rows.length - priced.length;
  const title = profile?.full_name ? `Lista de precios · ${profile.full_name}` : 'Lista de precios';
  const date = now.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' });

  // Texto para WhatsApp (con *negrita* de WhatsApp).
  const text = [`*${title}*`, date, '', ...priced.map((r) => {
    const parts = [r.retail !== null ? pesos(r.retail) : null, r.wholesale ? `mayorista ${pesos(r.wholesale.price)}${r.wholesale.from > 1 ? ` desde ${r.wholesale.from} u.` : ''}` : null].filter(Boolean);
    return `• ${r.name}: ${parts.join(' · ')}`;
  })].join('\n');

  return (
    <AppShell>
      <header className="print:hidden">
        <Link href="/gestion/productos" className="text-sm text-neutral-500 dark:text-neutral-400">← Mis productos</Link>
        <h1 className="mt-2 text-3xl">Lista de precios</h1>
        <p className="mt-1 text-neutral-600 dark:text-neutral-300">Mandala por WhatsApp o guardala en PDF para tus clientas.</p>
      </header>

      {priced.length > 0 && <div className="mt-5 print:hidden"><PriceListActions text={text} /></div>}

      <section className={`${cardClass} mt-5 print:mt-0 print:bg-white print:p-0 print:text-black`}>
        <h2 className="font-display text-2xl font-bold">{title}</h2>
        <p className="text-sm text-neutral-500">{date}</p>
        {priced.length === 0 ? (
          <p className="mt-4 text-sm">Todavía no pusiste precios a tus productos. Entrá a cada producto en <Link href="/gestion/productos" className="underline">Mis productos</Link> y agregale el precio de venta.</p>
        ) : (
          <table className="mt-4 w-full text-left text-[15px]">
            <thead className="text-xs text-neutral-500"><tr><th className="py-2 font-normal">Producto</th><th className="py-2 text-right font-normal">Precio</th><th className="py-2 text-right font-normal">Mayorista</th></tr></thead>
            <tbody>
              {priced.map((r) => (
                <tr key={r.id} className="border-t border-neutral-100 dark:border-neutral-800 print:border-neutral-300">
                  <td className="py-2.5 pr-2">{r.name}{r.activity && <span className="block text-xs text-neutral-500">{r.activity}</span>}</td>
                  <td className="py-2.5 text-right font-semibold">{r.retail !== null ? pesos(r.retail) : '—'}</td>
                  <td className="py-2.5 text-right">{r.wholesale ? <>{pesos(r.wholesale.price)}{r.wholesale.from > 1 && <span className="block text-xs text-neutral-500">desde {r.wholesale.from} u.</span>}</> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {missing > 0 && <p className="mt-3 text-sm text-neutral-500 print:hidden">{missing === 1 ? '1 producto no aparece' : `${missing} productos no aparecen`} porque no {missing === 1 ? 'tiene' : 'tienen'} precio cargado.</p>}
    </AppShell>
  );
}
