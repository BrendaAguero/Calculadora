"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Fingerprint, LockKeyhole } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "@/app/login/actions";
import { answerSessionAlert } from "@/app/seguridad/actions";
import { LAST_ONLINE_KEY, OFFLINE_PLUS_KEY, OFFLINE_USER_KEY } from "@/lib/outbox";
import { SW_PLUS_EVENT } from "@/components/sw-register";
import { FIRED_KEY, TIMERS_KEY } from "@/lib/timers";
import { HIDDEN_AT_KEY, RELOCK_AFTER_MS, UNLOCKED_KEY, UNLOCKED_PATHS, checkBiometric, checkPin, readLock, saveLock, type LockConfig } from "@/lib/app-lock";

type Alert = { id: string; place_a: string | null; place_b: string | null };
// Pantallas que se guardan de antemano para usarlas sin conexión (Personal Plus).
const WARM_URLS = ["/", "/calcular", "/calcular/resina", "/calcular/jesmonite", "/calcular/cemento", "/ventas", "/ventas/nueva", "/stock", "/materials", "/gestion/productos", "/historial", "/mas"];
let warmed = false;

// Guarda en el aparato si tiene el modo sin conexión, quién es y cuándo se conectó por última vez.
function rememberConnection(data: { plus?: boolean; userId?: string }) {
  try {
    const before = localStorage.getItem(OFFLINE_PLUS_KEY) === "1";
    localStorage.setItem(LAST_ONLINE_KEY, String(Date.now()));
    if (data.userId) localStorage.setItem(OFFLINE_USER_KEY, data.userId);
    if (data.plus) localStorage.setItem(OFFLINE_PLUS_KEY, "1"); else localStorage.removeItem(OFFLINE_PLUS_KEY);
    if (before !== Boolean(data.plus)) window.dispatchEvent(new Event(SW_PLUS_EVENT));
  } catch {}
  if (data.plus && !warmed && "serviceWorker" in navigator) {
    warmed = true;
    // Al trabajador que controla la página (el de Plus, si ya se activó); el de Plus además guarda solo al activarse.
    navigator.serviceWorker.ready.then((registration) => (navigator.serviceWorker.controller ?? registration.active)?.postMessage({ type: "warm", urls: WARM_URLS })).catch(() => {});
  }
}

// Al cerrar sesión (pantalla de entrada): se borran las pantallas guardadas y los datos del modo sin conexión.
function forgetConnection() {
  try { [OFFLINE_PLUS_KEY, OFFLINE_USER_KEY, TIMERS_KEY, FIRED_KEY].forEach((key) => localStorage.removeItem(key)); } catch {}
  if ("serviceWorker" in navigator) navigator.serviceWorker.ready.then((registration) => {
    registration.active?.postMessage({ type: "clear" });
    // Los avisos de los temporizadores eran de la cuenta que salió: se dejan de recibir en este aparato.
    return registration.pushManager?.getSubscription().then((sub) => sub?.unsubscribe());
  }).catch(() => {});
}
const PING_EVERY_MS = 5 * 60 * 1000;
const MAX_PIN_TRIES = 5;

// Corre en todas las pantallas: avisa «estoy en uso», muestra el aviso de uso en paralelo y el bloqueo de la app.
export function DeviceGuard() {
  const pathname = usePathname();
  const isOpenPage = UNLOCKED_PATHS.some((path) => pathname.startsWith(path));
  const [alert, setAlert] = useState<Alert | null>(null);
  const [lock, setLock] = useState<LockConfig | null>(null);
  const lastPing = useRef(0);
  const router = useRouter();

  const ping = useCallback(async () => {
    if (isOpenPage || !navigator.onLine) return;
    lastPing.current = Date.now();
    try {
      const response = await fetch("/api/presence", { method: "POST", cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { state: string; alert?: Alert | null; plus?: boolean; userId?: string };
      rememberConnection(data);
      if (data.state === "released") router.replace("/login?ok=" + encodeURIComponent("Este aparato fue liberado. Entrá de nuevo con tu clave."));
      else if (data.state === "device_limit") router.replace("/login?error=device_limit");
      else setAlert(data.alert ?? null);
    } catch {}
  }, [isOpenPage, router]);

  // Bloqueo: al abrir la app (sesión nueva del navegador) o después de 5 minutos en segundo plano.
  const applyLock = useCallback(() => {
    const config = isOpenPage ? null : readLock();
    let unlocked = false;
    try { unlocked = sessionStorage.getItem(UNLOCKED_KEY) === "1"; } catch {}
    const locked = Boolean(config && !unlocked);
    document.documentElement.classList.toggle("app-locked", locked);
    setLock(locked ? config : null);
  }, [isOpenPage]);

  useEffect(() => {
    if (pathname.startsWith("/login")) forgetConnection();
  }, [pathname]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lee el bloqueo guardado en el navegador al montar
    applyLock();
    void ping();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void ping(); }, PING_EVERY_MS);
    const onVisibility = () => {
      try {
        if (document.visibilityState === "hidden") {
          sessionStorage.setItem(HIDDEN_AT_KEY, String(Date.now()));
          return;
        }
        const hiddenAt = Number(sessionStorage.getItem(HIDDEN_AT_KEY) || 0);
        if (hiddenAt && Date.now() - hiddenAt > RELOCK_AFTER_MS) sessionStorage.removeItem(UNLOCKED_KEY);
      } catch {}
      applyLock();
      if (Date.now() - lastPing.current > 60_000) void ping();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisibility); };
  }, [applyLock, ping]);

  const unlock = () => {
    try { sessionStorage.setItem(UNLOCKED_KEY, "1"); } catch {}
    applyLock();
  };

  return (
    <>
      {alert && !lock && <ParallelUseAlert alert={alert} />}
      {lock && createPortal(<LockScreen config={lock} onUnlock={unlock} />, document.body)}
    </>
  );
}

function ParallelUseAlert({ alert }: { alert: Alert }) {
  const places = [alert.place_a, alert.place_b].filter(Boolean).join(" y ") || "dos lugares distintos";
  return (
    <div role="alertdialog" aria-labelledby="parallel-title" className="fixed inset-x-0 top-0 z-50 p-3">
      <div className="mx-auto max-w-xl rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 shadow-lg dark:border-amber-800 dark:bg-amber-950 dark:text-amber-50">
        <p id="parallel-title" className="font-semibold">⚠️ Tu cuenta se está usando en dos lugares a la vez</p>
        <p className="mt-1">Vimos uso al mismo tiempo en <strong>{places}</strong>. ¿Fuiste vos? (Con datos del celular la ubicación puede variar.)</p>
        <form action={answerSessionAlert} className="mt-3 flex flex-wrap gap-2">
          <input type="hidden" name="id" value={alert.id} />
          <button name="mine" value="1" className="rounded-lg border border-amber-400 px-3 py-1.5 font-medium dark:border-amber-700">Sí, fui yo</button>
          <button name="mine" value="0" className="rounded-lg bg-red-700 px-3 py-1.5 font-semibold text-white">No fui yo: cerrar todo y cambiar la clave</button>
        </form>
      </div>
    </div>
  );
}

function LockScreen({ config, onUnlock }: { config: LockConfig; onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [tries, setTries] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const forgetForm = useRef<HTMLFormElement>(null);

  const tryBiometric = useCallback(async () => {
    try {
      if (await checkBiometric(config)) onUnlock();
    } catch {
      setMessage("No se pudo leer la huella o la cara. Probá de nuevo.");
    }
  }, [config, onUnlock]);

  // Algunos aparatos (iPhone) piden tocar el botón; en otros se abre sola.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- pide la huella al mostrar la pantalla
  useEffect(() => { if (config.type === "bio") void tryBiometric(); }, [config, tryBiometric]);

  const forget = () => { saveLock(null); forgetForm.current?.requestSubmit(); };

  const submitPin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (await checkPin(config, pin)) return onUnlock();
    const next = tries + 1;
    setTries(next);
    setPin("");
    if (next >= MAX_PIN_TRIES) return forget();
    setMessage(`PIN incorrecto. Te quedan ${MAX_PIN_TRIES - next} intentos.`);
  };

  return (
    <div id="app-lock" className="terrazo-borde fixed inset-0 z-[100] flex flex-col items-center justify-center bg-orange-800 p-6 text-white dark:bg-orange-900">
      <div className="w-full max-w-xs text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-resina text-resina-dark"><LockKeyhole size={30} aria-hidden="true" /></span>
        <h1 className="mt-4 text-2xl text-white">Calculadora Emprender</h1>
        <p className="mt-1 text-sm text-white/75">{config.type === "pin" ? "Escribí tu PIN para abrir la app" : "Usá tu huella o tu cara para abrir la app"}</p>
        {config.type === "pin" ? (
          <form onSubmit={submitPin} className="mt-6 space-y-4">
            <label className="sr-only" htmlFor="app-lock-pin">PIN</label>
            <input id="app-lock-pin" autoFocus inputMode="numeric" type="password" autoComplete="off" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} className="w-full rounded-2xl border-0 bg-white/15 px-4 py-4 text-center text-3xl tracking-[0.6em] text-white placeholder:text-white/40 focus:bg-white/20" placeholder="••••" />
            <button className="w-full rounded-2xl bg-resina py-3.5 text-base font-bold text-resina-dark disabled:opacity-60" disabled={pin.length < 4}>Abrir</button>
          </form>
        ) : (
          <button onClick={() => void tryBiometric()} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-resina py-3.5 text-base font-bold text-resina-dark"><Fingerprint size={22} aria-hidden="true" />Abrir con huella o cara</button>
        )}
        {message && <p role="alert" className="mt-3 rounded-xl bg-white/15 px-3 py-2 text-sm">{message}</p>}
        <form ref={forgetForm} action={signOut} className="mt-8">
          <button type="button" onClick={forget} className="text-sm text-white/75 underline underline-offset-4">
            {config.type === "pin" ? "Olvidé mi PIN" : "No puedo usar la huella"}: entrar de nuevo con mi clave
          </button>
        </form>
      </div>
    </div>
  );
}
