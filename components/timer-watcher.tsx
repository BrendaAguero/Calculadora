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

// Alarma con sonido (la app tiene que estar abierta): dos pitidos por segundo hasta que se apague, como mucho 2 minutos.
let audio: AudioContext | null = null;
let alarm: ReturnType<typeof setInterval> | null = null;
let alarmEnds = 0;
const unlockAudio = () => {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
  } catch {}
};
function beep(at: number) {
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = 'square';
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.25, at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
  osc.connect(gain).connect(audio.destination);
  osc.start(at);
  osc.stop(at + 0.18);
}
function stopAlarm() {
  if (alarm) clearInterval(alarm);
  alarm = null;
  try { navigator.vibrate?.(0); } catch {}
}
function startAlarm() {
  unlockAudio();
  alarmEnds = Date.now() + 120_000;
  if (alarm) return;
  const ring = () => {
    if (Date.now() > alarmEnds) return stopAlarm();
    if (audio) { const t = audio.currentTime; beep(t); beep(t + 0.25); }
    try { navigator.vibrate?.([400, 200, 400]); } catch {}
  };
  ring();
  alarm = setInterval(ring, 1200);
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
      // Suena solo si acaba de vencer (no por uno viejo al abrir la app más tarde).
      if (fresh.some((t) => now - new Date(t.ends_at).getTime() < 3 * 60_000)) startAlarm();
      setDue((d) => [...d, ...fresh]);
    };
    check();
    const id = setInterval(check, 5_000);
    const onStorage = (e: StorageEvent) => { if (e.key === TIMERS_KEY) check(); };
    window.addEventListener('storage', onStorage);
    // El navegador solo deja sonar después de que la persona tocó algo en la app.
    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    return () => { clearInterval(id); window.removeEventListener('storage', onStorage); window.removeEventListener('pointerdown', unlockAudio); stopAlarm(); };
  }, []);

  if (!due.length) return null;
  return (
    <div role="alert" className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-md rounded-2xl bg-orange-800 p-4 text-white shadow-xl lg:bottom-6">
      <div className="flex items-start gap-3">
        <BellRing size={22} aria-hidden="true" className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">¡Tiempo cumplido!</p>
          <ul className="text-sm">{due.map((t) => <li key={t.id}>{t.label}</li>)}</ul>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => { stopAlarm(); setDue([]); }} className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-orange-900">Apagar alarma</button>
            <Link href="/temporizadores" onClick={() => { stopAlarm(); setDue([]); }} className="text-sm underline">Ver temporizadores</Link>
          </div>
        </div>
        <button type="button" onClick={() => { stopAlarm(); setDue([]); }} aria-label="Cerrar el aviso" className="rounded-lg p-1 hover:bg-white/10"><X size={18} aria-hidden="true" /></button>
      </div>
    </div>
  );
}
