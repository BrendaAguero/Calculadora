'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { removePushSubscription, savePushSubscription } from './push-actions';

type State = 'checking' | 'unsupported' | 'ios-install' | 'off' | 'on' | 'denied' | 'working' | 'error';

function keyBytes(base64: string) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function save(sub: PushSubscription) {
  const json = sub.toJSON();
  return savePushSubscription({ endpoint: sub.endpoint, p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' });
}

// Activa los avisos en este aparato: llegan aunque la app esté cerrada o el celular bloqueado.
export function PushToggle() {
  const [state, setState] = useState<State>('checking');

  useEffect(() => {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const installed = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    const next: Promise<State> = !supported
      ? Promise.resolve(ios && !installed ? 'ios-install' : 'unsupported')
      : Notification.permission === 'denied'
        ? Promise.resolve('denied')
        : navigator.serviceWorker.ready.then(async (reg) => {
          const sub = await reg.pushManager.getSubscription();
          if (!sub) return 'off';
          await save(sub); // por si cambió la cuenta en este aparato
          return 'on';
        });
    next.then(setState).catch(() => setState('off'));
  }, []);

  async function enable() {
    setState('working');
    try {
      if ((await Notification.requestPermission()) !== 'granted') return setState('denied');
      const reg = await navigator.serviceWorker.ready;
      const res = await fetch('/api/push/clave', { cache: 'no-store' });
      const { key } = (await res.json()) as { key?: string };
      if (!key) return setState('error');
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }));
      setState((await save(sub)).ok ? 'on' : 'error');
    } catch {
      setState('error');
    }
  }

  async function disable() {
    setState('working');
    try {
      const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
      if (sub) { await removePushSubscription(sub.endpoint); await sub.unsubscribe(); }
      setState('off');
    } catch {
      setState('error');
    }
  }

  const box = 'flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 text-sm';
  if (state === 'checking') return null;
  if (state === 'on') return (
    <div className={`${box} border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100`}>
      <BellRing size={18} aria-hidden="true" /><span className="flex-1">Avisos activados en este aparato: te llegan aunque la app esté cerrada.</span>
      <button type="button" onClick={disable} className="text-xs underline">Desactivar</button>
    </div>
  );
  if (state === 'ios-install') return (
    <div className={`${box} border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100`}>
      <Bell size={18} aria-hidden="true" /><span className="flex-1">En iPhone, para recibir avisos con la app cerrada: tocá <strong>Compartir</strong> → <strong>Agregar a inicio</strong>, abrí la app desde ese ícono y activá los avisos acá.</span>
    </div>
  );
  if (state === 'unsupported') return (
    <div className={`${box} border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300`}>
      <BellOff size={18} aria-hidden="true" /><span className="flex-1">Este navegador no permite avisos. Probá con Chrome (Android o computadora) o con la app agregada a la pantalla de inicio.</span>
    </div>
  );
  if (state === 'denied') return (
    <div className={`${box} border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100`}>
      <BellOff size={18} aria-hidden="true" /><span className="flex-1">Los avisos están bloqueados para esta app. Habilitalos en los ajustes del navegador (el candadito al lado de la dirección → Notificaciones → Permitir) y volvé a entrar.</span>
    </div>
  );
  return (
    <div className={`${box} border-orange-300 bg-orange-50 text-orange-950 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-100`}>
      <Bell size={18} aria-hidden="true" />
      <span className="flex-1">{state === 'error' ? 'No se pudieron activar los avisos. Probá de nuevo.' : 'Activá los avisos para que te lleguen aunque la app esté cerrada o el celular bloqueado.'}</span>
      <button type="button" onClick={enable} disabled={state === 'working'} className="rounded-xl bg-orange-800 px-4 py-2 font-semibold text-white disabled:opacity-50 dark:bg-orange-600">{state === 'working' ? 'Activando…' : 'Activar avisos'}</button>
    </div>
  );
}
