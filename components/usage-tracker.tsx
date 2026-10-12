"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

// Cuenta qué pantallas se abren, sin datos personales: solo la pantalla (los números de cada cosa
// se reemplazan por «:id») y si estaba el Modo simple. No se guarda quién la abrió.
export function UsageTracker({ simple }: { simple: boolean }) {
  const pathname = usePathname();
  useEffect(() => {
    if (!navigator.onLine) return;
    const path = pathname.toLowerCase().replace(UUID, ":id").slice(0, 80);
    if (!/^\/[a-z0-9/:\-]*$/.test(path) || path.startsWith("/api")) return;
    void fetch("/api/uso", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path, simple }), keepalive: true }).catch(() => {});
  }, [pathname, simple]);
  return null;
}
