'use client';

import { useEffect, useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { formatCountdown, TIMERS_KEY, type StoredTimer } from '@/lib/timers';
import { deleteTimer, finishTimer } from './actions';

type Timer = StoredTimer & { done_at: string | null; created_at: string };
const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Reloj circular: el anillo se llena a medida que pasa el tiempo.
function Ring({ progress, ready, children }: { progress: number; ready: boolean; children: React.ReactNode }) {
  return (
    <div className="relative grid h-32 w-32 shrink-0 place-items-center">
      <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={RADIUS} fill="none" strokeWidth="10" className="stroke-neutral-200 dark:stroke-neutral-800" />
        <circle cx="60" cy="60" r={RADIUS} fill="none" strokeWidth="10" strokeLinecap="round" strokeDasharray={CIRCUMFERENCE} strokeDashoffset={CIRCUMFERENCE * (1 - progress)} className={`transition-[stroke-dashoffset] duration-1000 ease-linear ${ready ? 'stroke-emerald-500' : 'stroke-orange-600'}`} />
      </svg>
      <div className="relative text-center">{children}</div>
    </div>
  );
}

const time = (iso: string) => new Date(iso).toLocaleString('es-AR', { weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });

export function TimersBoard({ timers }: { timers: Timer[] }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // Los activos quedan en el aparato para que el aviso funcione en cualquier pantalla de la app.
    try { localStorage.setItem(TIMERS_KEY, JSON.stringify(timers.filter((t) => !t.done_at).map(({ id, label, ends_at }) => ({ id, label, ends_at })))); } catch {}
  }, [timers]);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const active = timers.filter((t) => !t.done_at);
  return (
    <div className="grid gap-3">
      {!active.length && <div className="rounded-2xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">No hay temporizadores en marcha.</div>}
      <div className="grid gap-3 sm:grid-cols-2">
      {active.map((t) => {
        const start = new Date(t.created_at).getTime();
        const end = new Date(t.ends_at).getTime();
        const left = now === null ? null : end - now;
        const ready = left !== null && left <= 0;
        const progress = now === null ? 0 : Math.min(1, Math.max(0, (now - start) / Math.max(1, end - start)));
        return (
          <div key={t.id} className={`flex items-center gap-4 rounded-3xl border p-4 ${ready ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40' : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900'}`}>
            <Ring progress={ready ? 1 : progress} ready={ready}>
              {ready
                ? <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300">¡Listo!</span>
                : <><span className="block font-mono text-xl font-bold tabular-nums">{left === null ? '—' : formatCountdown(left)}</span><span className="text-xs text-neutral-500">quedan</span></>}
            </Ring>
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-snug">{t.label}</p>
              <p className="mt-0.5 text-xs text-neutral-500">{ready ? 'Ya está' : `Avisa el ${time(t.ends_at)}`}</p>
              <div className="mt-3 flex gap-2">
                <form action={finishTimer}><input type="hidden" name="timer_id" value={t.id} /><button aria-label={`Marcar «${t.label}» como hecho`} className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-white"><Check size={18} aria-hidden="true" /></button></form>
                <form action={deleteTimer}><input type="hidden" name="timer_id" value={t.id} /><button aria-label={`Quitar «${t.label}»`} className="grid h-10 w-10 place-items-center rounded-xl border border-neutral-300 text-neutral-500 dark:border-neutral-700"><Trash2 size={16} aria-hidden="true" /></button></form>
              </div>
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
