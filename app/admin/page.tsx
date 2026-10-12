import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { cardClass, pageClass } from '@/lib/ui';

export default async function AdminHome() {
  const { supabase } = await requireAdmin();
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const [users, entrepreneur, applications, withdrawals, regrets] = await Promise.all([
    count(supabase.from('profiles').select('id', { count: 'exact', head: true })),
    count(supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'pending')),
    count(supabase.from('affiliates').select('id', { count: 'exact', head: true }).eq('status', 'pending')),
    count(supabase.from('withdrawals').select('id', { count: 'exact', head: true }).in('status', ['requested', 'reviewing', 'approved'])),
    count(supabase.from('regret_requests').select('id', { count: 'exact', head: true }).eq('status', 'received')),
  ]);

  const sections: [string, string, string, number?][] = [
    ['/admin/emails', 'Edición Personal: emails', 'Aprobar emails (transferencia, MercadoLibre), revocar y liberar aparatos.'],
    ['/admin/precios', 'Precios', 'Edición Personal, Mensualidad Plus, actividades y aparato extra.'],
    ['/admin/revendedoras', 'Revendedoras', 'Precios por cantidad, contacto, recursos de venta y saldos.'],
    ['/admin/usuarios', 'Usuarios', 'Cuentas, licencias, Emprendedor; suspender y dar licencias de cortesía.', users],
    ['/admin/emprendedor', 'Pedidos de Mensualidad Plus', 'Pedidos pendientes de pago para activar a mano.', entrepreneur],
    ['/admin/ventas', 'Ventas de la plataforma', 'Compras, pagos de Mercado Pago y suscripciones.'],
    ['/admin/afiliados', 'Afiliadas', 'Solicitudes, códigos, comisiones y retiros.', applications + withdrawals],
    ['/admin/arrepentimiento', 'Arrepentimiento y bajas', 'Pedidos para revocar una compra (10 días) o dar de baja la suscripción.', regrets],
    ['/admin/banner', 'Banner de publicidad', 'El aviso que ve quien no tiene Mensualidad Plus: tus planes o un sponsor.'],
    ['/admin/uso', 'Uso de la app', 'Qué pantallas se usan más y cuáles nadie abre (sin datos personales).'],
    ['/admin/auditoria', 'Auditoría', 'Todo lo que se hizo desde la administración.'],
  ];

  return (
    <main className={pageClass}>
      <header>
        <Link href="/access" className="text-sm text-neutral-500 dark:text-neutral-400">← Licencia y acceso</Link>
        <h1 className="text-2xl font-semibold">Administración</h1>
      </header>
      <section className="grid gap-3">
        {sections.map(([href, title, hint, badge]) => (
          <Link key={href} href={href} className={`${cardClass} flex items-start justify-between gap-3 transition hover:border-neutral-400`}>
            <div><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{hint}</p></div>
            {badge !== undefined && badge > 0 && <span className="rounded-full bg-orange-600 px-2.5 py-1 text-xs font-semibold text-white">{badge}</span>}
          </Link>
        ))}
      </section>
      <p className="text-xs text-neutral-500">El número en Usuarios es el total de cuentas; en los demás, lo que espera tu acción.</p>
    </main>
  );
}
