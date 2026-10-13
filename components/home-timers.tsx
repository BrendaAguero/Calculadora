'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Timer } from 'lucide-react';
import { formatCountdown, type StoredTimer } from '@/lib/timers';

// Franja de Inicio con los temporizadores en marcha (los 3 más próximos).
export function HomeTimers({ timers }: { timers: StoredTimer[] }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  if (!timers.length) return null;
  return (
    <Link href="/temporizadores" className="mt-3 flex items-start gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-950 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-100">
      <Timer size={20} aria-hidden="true" className="mt-0.5 shrink-0" />
      <ul className="min-w-0 flex-1 space-y-0.5">
        {timers.map((t) => {
          const left = now === null ? null : new Date(t.ends_at).getTime() - now;
          return (
            <li key={t.id} className="flex justify-between gap-3">
              <span className="truncate">{t.label}</span>
              <span className="shrink-0 font-mono font-semibold tabular-nums">{left === null ? '—' : left <= 0 ? '¡Listo!' : formatCountdown(left)}</span>
            </li>
          );
        })}
      </ul>
    </Link>
  );
}
