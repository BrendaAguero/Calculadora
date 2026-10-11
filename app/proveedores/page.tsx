import Link from 'next/link';
import { SubmitButton } from '@/components/submit-button';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAccessSnapshot, hasFeature } from '@/lib/access/permissions';
import { FeatureLocked } from '@/components/feature-locked';
import { cardClass, errorBox, inputClass, labelClass, pageClass, primaryButton } from '@/lib/ui';
import { createSupplier } from './actions';

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<{ error?: string; archivados?: string }> }) {
  const { error, archivados } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const snapshot = await getAccessSnapshot();
  const allowed = Boolean(snapshot && hasFeature(snapshot, 'PROVEEDORES_BASICO'));

  let query = supabase.from('suppliers').select('id,name,phone,email,status').eq('user_id', user.id).order('name');
  if (!archivados) query = query.eq('status', 'active');
  const { data: suppliers, error: loadError } = allowed ? await query : { data: [], error: null };

  return (
    <main className={pageClass}>
      <header className="flex items-start justify-between gap-4">
        <div>
          <Link href="/gestion" className="text-sm text-neutral-500 dark:text-neutral-400">← Gestión</Link>
          <h1 className="text-2xl font-semibold">Proveedores</h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">A quién le comprás. Sus compras actualizan precios y stock.</p>
        </div>
        {allowed && <Link href="/compras" className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-700">Compras</Link>}
      </header>

      {!allowed ? (
        <FeatureLocked title="Proveedores es parte del módulo «Proveedores básico» o de Emprendedor.">Guardá tus proveedores, registrá compras y compará precios.</FeatureLocked>
      ) : (
        <>
          {(error || loadError) && <div role="alert" className={errorBox}>{error ?? `No se pudieron cargar los proveedores: ${loadError!.message}`}</div>}
          <section className="grid gap-3">
            {!suppliers?.length
              ? <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">Todavía no cargaste proveedores.</div>
              : suppliers.map((supplier) => (
                <Link key={supplier.id} href={`/proveedores/${supplier.id}`} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900">
                  <h2 className="font-medium">{supplier.name}{supplier.status === 'archived' && <span className="ml-2 text-xs text-neutral-500">(archivado)</span>}</h2>
                  <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{[supplier.phone, supplier.email].filter(Boolean).join(' · ') || 'Sin datos de contacto'}</p>
                </Link>
              ))}
            <Link href={archivados ? '/proveedores' : '/proveedores?archivados=1'} className="text-sm text-neutral-500 underline">{archivados ? 'Ocultar archivados' : 'Ver también los archivados'}</Link>
          </section>

          <form action={createSupplier} className={`${cardClass} grid gap-3 sm:grid-cols-2`}>
            <h2 className="font-semibold sm:col-span-2">Nuevo proveedor</h2>
            <label className={`${labelClass} sm:col-span-2`}>Nombre *<input name="name" required maxLength={120} className={inputClass} /></label>
            <label className={labelClass}>Teléfono<input name="phone" maxLength={40} className={inputClass} /></label>
            <label className={labelClass}>Email<input name="email" type="email" maxLength={120} className={inputClass} /></label>
            <label className={`${labelClass} sm:col-span-2`}>Notas<input name="notes" maxLength={300} placeholder="Dirección, horarios, condiciones…" className={inputClass} /></label>
            <div className="sm:col-span-2"><SubmitButton className={primaryButton}>Guardar proveedor</SubmitButton></div>
          </form>
        </>
      )}
    </main>
  );
}
