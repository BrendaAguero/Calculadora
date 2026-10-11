"use client";

import { useEffect } from "react";

// Registra el service worker (abre más rápido y muestra «Estás sin conexión» si no hay internet).
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    }
  }, []);
  return null;
}
