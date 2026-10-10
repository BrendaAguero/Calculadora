import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { priceTypeLabel, statusLabel } from './constants';

const pageClass = 'mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 bg-white px-4 py-6 pb-24 text-neutral-900 dark:bg-neutral-950 dark:text-white';

function money(value: number | string) {
  return Number(value).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 });
}

export default async function ProductsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <main className={pageClass}>Iniciá sesión para ver tus productos.</main>;

  const { data: products, error } = await supabase
    .from('products')
    .select('id,name,photo_url,status,activities(name),product_prices(price_type,quantity_min,price,valid_from,valid_until)')
    .eq('user_id', user.id)
    .order('status', { ascending: true })
    .order('name', { ascending: true });
  const now = new Date();

  return (
    <main className={pageClass}>
      <header className="flex items-center justify-between gap-4">
        <div>
          <Link href="/gestion" className="text-sm text-neutral-500 dark:text-neutral-400">← Gestión</Link>
          <h1 className="text-2xl font-semibold">Productos</h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Lo que vendés: con sus fórmulas, moldes y precios con historial.</p>
        </div>
        <Link href="/gestion/productos/new" className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">Nuevo</Link>
      </header>

      {error
        ? <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">No se pudieron cargar los productos: {error.message}</div>
        : !products.length
          ? <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">Todavía no tenés productos. Creá el primero.</div>
          : <section className="grid gap-3">
            {products.map(product => {
              const activity = Array.isArray(product.activities) ? product.activities[0] : product.activities;
              const current = (product.product_prices ?? []).filter(p => new Date(p.valid_from) <= now && (!p.valid_until || new Date(p.valid_until) > now));
              const retail = current.filter(p => p.price_type === 'retail').sort((a, b) => Number(a.quantity_min) - Number(b.quantity_min))[0] ?? current[0];
              return (
                <Link key={product.id} href={`/gestion/productos/${product.id}`} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900">
                  <div className="flex gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element -- la foto es una URL externa elegida por la usuaria */}
                    {product.photo_url ? <img src={product.photo_url} alt="" className="h-16 w-16 rounded-xl object-cover" /> : <div className="h-16 w-16 rounded-xl bg-neutral-100 dark:bg-neutral-800" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="font-medium">{product.name}</h2>
                        <span className={`rounded-full px-2.5 py-1 text-xs ${product.status === 'active' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'}`}>{statusLabel(product.status)}</span>
                      </div>
                      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{[activity?.name, retail ? `${priceTypeLabel(retail.price_type)}: ${money(retail.price)}` : 'Sin precio vigente'].filter(Boolean).join(' · ')}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </section>}
    </main>
  );
}
