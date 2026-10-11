import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { cardClass, dateTime, errorBox, pageClass } from '@/lib/ui';

const ACTIONS: Record<string, string> = {
  'user.status': 'Cambió el estado de una cuenta', 'license.grant': 'Dio una licencia de cortesía',
  'affiliate.approve': 'Aprobó una afiliada', 'affiliate.reject': 'Rechazó una afiliada', 'affiliate.status': 'Cambió el estado de una afiliada', 'affiliate.pro': 'Afiliada pasó a PRO',
  'withdrawal.paid': 'Marcó un retiro como pagado', 'withdrawal.rejected': 'Rechazó un retiro', 'withdrawal.reviewing': 'Puso un retiro en revisión', 'withdrawal.approved': 'Aprobó un retiro',
};

export default async function AdminAuditPage() {
  const { supabase } = await requireAdmin();
  const { data: logs, error } = await supabase.from('audit_logs').select('id,action,entity_type,old_data,new_data,created_at,actor_user_id').order('created_at', { ascending: false }).limit(200);
  const actorIds = [...new Set((logs ?? []).map((l) => l.actor_user_id).filter((id): id is string => Boolean(id)))];
  const { data: actors } = actorIds.length ? await supabase.from('profiles').select('id,email').in('id', actorIds) : { data: [] };
  const email = new Map((actors ?? []).map((a) => [a.id, a.email]));

  return (
    <main className={pageClass}>
      <header>
        <Link href="/admin" className="text-sm text-neutral-500 dark:text-neutral-400">← Administración</Link>
        <h1 className="text-2xl font-semibold">Auditoría</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Registro de todo lo que se hizo desde la administración. No se puede editar ni borrar.</p>
      </header>
      {error && <div role="alert" className={errorBox}>{error.message}</div>}
      <section className={cardClass}>
        {!logs?.length ? <p className="text-sm text-neutral-500">Todavía no hay acciones registradas.</p> : (
          <ul className="divide-y divide-neutral-100 text-sm dark:divide-neutral-800">{logs.map((l) => (
            <li key={l.id} className="py-2">
              <p><strong>{ACTIONS[l.action] ?? l.action}</strong> <span className="text-neutral-500">· {dateTime(l.created_at)} · {l.actor_user_id ? email.get(l.actor_user_id) ?? 'cuenta' : 'sistema'}</span></p>
              {(l.old_data || l.new_data) && <p className="mt-0.5 break-all font-mono text-xs text-neutral-500">{l.old_data ? `${JSON.stringify(l.old_data).slice(0, 160)} → ` : ''}{JSON.stringify(l.new_data ?? {}).slice(0, 200)}</p>}
            </li>
          ))}</ul>
        )}
      </section>
    </main>
  );
}
