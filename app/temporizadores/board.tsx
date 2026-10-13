'use client';

import { useEffect, useState } from 'react';
import { Bell, Check, Trash2 } from 'lucide-react';
import { formatCountdown, TIMERS_KEY, type StoredTimer } from '@/lib/timers';
import { deleteTimer, finishTimer } from './actions';

type Timer = StoredTimer & { done_at: string | null };
const time = (iso: string) => new Date(iso).toLocaleString('es-AR', { weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });

export function TimersBoard({ timers }: { timers: Timer[] }) {
  const [now, setNow] = useState<number | null>(null);
  const [permission, setPermission] = useState<string>('granted');

  useEffect(() => {
    // Los activos quedan en el aparato para que el aviso funcione en cualquier pantalla de la app.
    try { localStorage.setItem(TIMERS_KEY, JSON.stringify(timers.filter((t) => !t.done_at).map(({ id, label, ends_at }) => ({ id, label, ends_at })))); } catch {}
  }, [timers]);
  useEffect(() => {
    const tick = () => {
      setNow(Date.now());
      if (typeof Notification !== 'undefined') setPermission(Notification.permission);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const active = timers.filter((t) => !t.done_at);
  return (
    <div className="grid gap-3">
      {permission === 'default' && (
        <button type="button" onClick={async () => setPermission(await Notification.requestPermission())} className="flex w-fit items-center gap-2 rounded-xl border border-orange-300 bg-orange-50 px-4 py-2.5 text-sm font-medium text-orange-900 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-100">
          <Bell size={16} aria-hidden="true" />Activar los avisos del celular o la compu
        </button>
      )}
      {!active.length && <div className="rounded-2xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">No hay temporizadores en marcha.</div>}
      {active.map((t) => {
        const left = now === null ? null : new Date(t.ends_at).getTime() - now;
        const ready = left !== null && left <= 0;
        return (
          <div key={t.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 ${ready ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40' : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900'}`}>
            <div className="min-w-0">
              <p className="font-semibold">{t.label}</p>
              <p className="text-xs text-neutral-500">{ready ? 'Ya está' : `Avisa el ${time(t.ends_at)}`}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`font-mono text-2xl font-bold tabular-nums ${ready ? 'text-emerald-700 dark:text-emerald-300' : ''}`} aria-live={ready ? 'polite' : 'off'}>{left === null ? '—' : ready ? '¡Listo!' : formatCountdown(left)}</span>
              <form action={finishTimer}><input type="hidden" name="timer_id" value={t.id} /><button aria-label={`Marcar «${t.label}» como hecho`} className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-white"><Check size={18} aria-hidden="true" /></button></form>
              <form action={deleteTimer}><input type="hidden" name="timer_id" value={t.id} /><button aria-label={`Quitar «${t.label}»`} className="grid h-10 w-10 place-items-center rounded-xl border border-neutral-300 text-neutral-500 dark:border-neutral-700"><Trash2 size={16} aria-hidden="true" /></button></form>
            </div>
          </div>
        );
      })}
    </div>
  );
}
