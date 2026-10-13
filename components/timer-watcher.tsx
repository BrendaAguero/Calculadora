'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BellRing, X } from 'lucide-react';
import { FIRED_KEY, TIMERS_KEY, type StoredTimer } from '@/lib/timers';

const read = <T,>(key: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(key) ?? '') as T; } catch { return fallback; } };

// Aviso del sistema (con el service worker si está, que es lo que funciona en celulares). Usa el mismo «tag»
// que el aviso push, así si llegan los dos se ve uno solo.
async function systemNotice(title: string, body: string, tag: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) await registration.showNotification(title, { body, tag, icon: '/icons/icon-192.png' });
    else new Notification(title, { body, tag });
  } catch {}
}

// Corre en todas las pantallas: cuando vence un temporizador de curado avisa (mientras la app esté abierta).
export function TimerWatcher() {
  const [due, setDue] = useState<StoredTimer[]>([]);
  useEffect(() => {
    const check = () => {
      const timers = read<StoredTimer[]>(TIMERS_KEY, []);
      const fired = new Set(read<string[]>(FIRED_KEY, []));
      const now = Date.now();
      const fresh = timers.filter((t) => new Date(t.ends_at).getTime() <= now && !fired.has(t.id));
      if (!fresh.length) return;
      fresh.forEach((t) => { fired.add(t.id); systemNotice('¡Tiempo cumplido!', t.label, t.id); });
      try { localStorage.setItem(FIRED_KEY, JSON.stringify([...fired].slice(-200))); } catch {}
      try { navigator.vibrate?.([300, 150, 300]); } catch {}
      setDue((d) => [...d, ...fresh]);
    };
    check();
    const id = setInterval(check, 10_000);
    const onStorage = (e: StorageEvent) => { if (e.key === TIMERS_KEY) check(); };
    window.addEventListener('storage', onStorage);
    return () => { clearInterval(id); window.removeEventListener('storage', onStorage); };
  }, []);

  if (!due.length) return null;
  return (
    <div role="alert" className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-md rounded-2xl bg-orange-800 p-4 text-white shadow-xl lg:bottom-6">
      <div className="flex items-start gap-3">
        <BellRing size={22} aria-hidden="true" className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">¡Tiempo cumplido!</p>
          <ul className="text-sm">{due.map((t) => <li key={t.id}>{t.label}</li>)}</ul>
          <Link href="/temporizadores" onClick={() => setDue([])} className="mt-1 inline-block text-sm underline">Ver temporizadores</Link>
        </div>
        <button type="button" onClick={() => setDue([])} aria-label="Cerrar el aviso" className="rounded-lg p-1 hover:bg-white/10"><X size={18} aria-hidden="true" /></button>
      </div>
    </div>
  );
}
