import "server-only";
import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

const DEVICE_COOKIE = "did";

// Identificador de este aparato (cookie que se crea al entrar), o null si todavía no tiene.
export async function currentDeviceId() {
  const value = (await cookies()).get(DEVICE_COOKIE)?.value;
  return value && /^[0-9a-f]{32}$/.test(value) ? value : null;
}

// Nombre simple del aparato para mostrarlo en «Mis aparatos» (por ejemplo, «Android · Chrome»).
function deviceLabel(userAgent: string) {
  const os = /iPhone|iPad/.test(userAgent) ? "iPhone/iPad" : /Android/.test(userAgent) ? "Android" : /Windows/.test(userAgent) ? "Windows" : /Mac OS X/.test(userAgent) ? "Mac" : /Linux/.test(userAgent) ? "Linux" : "Otro";
  const browser = /Edg\//.test(userAgent) ? "Edge" : /Chrome\//.test(userAgent) ? "Chrome" : /Firefox\//.test(userAgent) ? "Firefox" : /Safari\//.test(userAgent) ? "Safari" : "navegador";
  return `${os} · ${browser}`;
}

// Registra este aparato al iniciar sesión. La Edición Personal incluye 2 aparatos (+ los «Aparato extra»).
// Si ya usa todos, cierra la sesión y devuelve false.
export async function registerCurrentDevice(): Promise<boolean> {
  const cookieStore = await cookies();
  let deviceId = cookieStore.get(DEVICE_COOKIE)?.value;
  if (!deviceId || !/^[0-9a-f]{32}$/.test(deviceId)) {
    deviceId = randomBytes(16).toString("hex");
    cookieStore.set(DEVICE_COOKIE, deviceId, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 365 * 2 });
  }
  const userAgent = (await headers()).get("user-agent") ?? "";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("register_device", { p_device_id: deviceId, p_label: deviceLabel(userAgent) });
  if (error) {
    console.error("No se pudo registrar el aparato", error.message);
    return true;
  }
  if (data === "limit") {
    await supabase.auth.signOut();
    return false;
  }
  return true;
}

export const DEVICE_LIMIT_MESSAGE = "Ya usás la app en todos tus aparatos. Liberá uno desde «Mi acceso» en otro aparato, comprá un «Aparato extra» o escribinos.";
