"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CloudOff, RefreshCw, WifiOff } from "lucide-react";
import { LAST_ONLINE_KEY, OFFLINE_MAX_DAYS, OUTBOX_EVENT, listOutbox, offlineEnabled, removeFromOutbox, updateOutbox, type OutboxItem } from "@/lib/outbox";
import { NO_NAV_PATHS } from "@/lib/nav";

// Modo sin conexión (Mensualidad Plus): avisa cuando no hay internet, muestra lo que falta subir
// y lo sube solo cuando vuelve la conexión.
export function OfflineSync() {
  const pathname = usePathname();
  const [online, setOnline] = useState(true);
  const [plus, setPlus] = useState(false);
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [expired, setExpired] = useState(false);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    setPlus(offlineEnabled());
    setOnline(navigator.onLine);
    try { setItems(await listOutbox()); } catch { setItems([]); }
    try {
      const last = Number(localStorage.getItem(LAST_ONLINE_KEY) || 0);
      setExpired(!navigator.onLine && last > 0 && Date.now() - last > OFFLINE_MAX_DAYS * 86_400_000);
    } catch { setExpired(false); }
  }, []);

  const sync = useCallback(async () => {
    if (busy.current || !navigator.onLine) return;
    const pending = (await listOutbox().catch(() => [] as OutboxItem[])).filter((item) => !item.error);
    if (!pending.length) return;
    busy.current = true;
    setSyncing(true);
    try {
      const response = await fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: pending }) });
      if (response.ok) {
        const { results } = (await response.json()) as { results: { id: string; status: string; message?: string }[] };
        for (const result of results) {
          const item = pending.find((p) => p.id === result.id);
          if (!item) continue;
          if (result.status === "done" || result.status === "duplicate") await removeFromOutbox(item.id);
          else if (result.status === "error") await updateOutbox({ ...item, error: result.message ?? "No se pudo subir." });
        }
      }
    } catch {
      // Sin conexión de verdad: se reintenta al volver.
    } finally {
      busy.current = false;
      setSyncing(false);
      await refresh();
    }
  }, [refresh]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lee el estado del aparato al montar
    void refresh().then(sync);
    const onOnline = () => { void refresh().then(sync); };
    const onChange = () => { void refresh().then(() => { if (navigator.onLine) void sync(); }); };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onChange);
    window.addEventListener(OUTBOX_EVENT, onChange);
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onChange); window.removeEventListener(OUTBOX_EVENT, onChange); };
  }, [refresh, sync]);

  if (NO_NAV_PATHS.some((path) => pathname.startsWith(path))) return null;
  const failed = items.filter((item) => item.error);
  const waiting = items.length - failed.length;

  if (!online && plus && expired) {
    return (
      <div className="fixed inset-0 z-[90] grid place-items-center bg-neutral-50/95 p-6 text-center dark:bg-neutral-950/95">
        <div className="max-w-sm">
          <WifiOff size={36} aria-hidden="true" className="mx-auto text-orange-800 dark:text-orange-300" />
          <h2 className="mt-3 text-xl">Conectate un momento a internet</h2>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">Pasaron más de {OFFLINE_MAX_DAYS} días sin conexión. Conectate para renovar el modo sin conexión; lo que cargaste está guardado y se sube solo.</p>
        </div>
      </div>
    );
  }

  if (online && !items.length) return null;
  if (!online && !plus) return null;

  return (
    <div role="status" className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 px-3 lg:bottom-4 lg:left-62">
      <div className="mx-auto max-w-xl rounded-2xl bg-neutral-900 px-4 py-3 text-sm text-white shadow-lg dark:bg-neutral-800">
        {!online ? (
          <p className="flex items-start gap-2"><CloudOff size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-resina" />
            <span>Sin conexión. Ves tus datos guardados; las ventas y los cálculos que cargues se suben solos al volver internet.{waiting > 0 ? ` Pendientes: ${waiting}.` : ""}</span></p>
        ) : (
          <p className="flex items-center gap-2"><RefreshCw size={18} aria-hidden="true" className={`shrink-0 text-resina ${syncing ? "animate-spin" : ""}`} />
            <span>{syncing ? `Subiendo ${waiting} ${waiting === 1 ? "carga" : "cargas"} hechas sin conexión…` : waiting > 0 ? `${waiting} ${waiting === 1 ? "carga pendiente" : "cargas pendientes"} de subir.` : "Todo subido."}</span>
            {!syncing && waiting > 0 && <button type="button" onClick={() => void sync()} className="ml-auto underline">Subir ahora</button>}
          </p>
        )}
        {failed.length > 0 && (
          <ul className="mt-2 space-y-1 border-t border-white/15 pt-2">
            {failed.map((item) => (
              <li key={item.id} className="flex items-center gap-2 text-xs">
                <span className="flex-1">No se pudo subir «{item.label}»: {item.error}</span>
                <button type="button" onClick={async () => { await updateOutbox({ ...item, error: undefined }); await sync(); }} className="underline">Reintentar</button>
                <button type="button" onClick={async () => { await removeFromOutbox(item.id); await refresh(); }} className="underline">Descartar</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
