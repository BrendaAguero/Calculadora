"use client";

import { useEffect } from "react";
import { OFFLINE_PLUS_KEY } from "@/lib/outbox";

export const SW_PLUS_EVENT = "calculadora-sw-plus";

// Registra el service worker. Con Personal Plus se registra en modo «sin conexión» (sw.js?plus=1).
function register() {
  if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
  let plus = false;
  try { plus = localStorage.getItem(OFFLINE_PLUS_KEY) === "1"; } catch {}
  navigator.serviceWorker.register(plus ? "/sw.js?plus=1" : "/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
}

export function ServiceWorkerRegister() {
  useEffect(() => {
    register();
    window.addEventListener(SW_PLUS_EVENT, register);
    return () => window.removeEventListener(SW_PLUS_EVENT, register);
  }, []);
  return null;
}
