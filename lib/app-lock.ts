// Bloqueo de la app en este aparato (opcional): con PIN o con la huella/cara del aparato.
// Es un bloqueo de pantalla local, como el de las apps del banco: se guarda solo en este navegador.
// La cuenta sigue protegida por la clave de acceso; esto evita que alguien abra la app en tu aparato.

export const LOCK_STORAGE_KEY = "calculadora-bloqueo";
export const UNLOCKED_KEY = "calculadora-desbloqueada";
export const HIDDEN_AT_KEY = "calculadora-oculta-desde";
export const RELOCK_AFTER_MS = 5 * 60 * 1000;
// Páginas que no se bloquean (públicas o de entrada).
export const UNLOCKED_PATHS = ["/login", "/registro", "/conocer", "/equipo-ingreso", "/auth/", "/ayuda", "/legal", "/arrepentimiento", "/baja", "/comprar", "/r/", "/set-password"];

export type LockConfig = { type: "pin"; salt: string; hash: string } | { type: "bio"; credentialId: string };

// Se ejecuta en <head> antes de pintar: si hay bloqueo y la app no se desbloqueó en esta sesión, oculta el contenido.
export const LOCK_INIT_SCRIPT = `(function(){try{var p=location.pathname;var u=${JSON.stringify(UNLOCKED_PATHS)};for(var i=0;i<u.length;i++){if(p.indexOf(u[i])===0)return}if(localStorage.getItem("${LOCK_STORAGE_KEY}")&&!sessionStorage.getItem("${UNLOCKED_KEY}"))document.documentElement.classList.add("app-locked")}catch(e){}})()`;

export function readLock(): LockConfig | null {
  try {
    const raw = localStorage.getItem(LOCK_STORAGE_KEY);
    const value = raw ? (JSON.parse(raw) as LockConfig) : null;
    return value && (value.type === "pin" || value.type === "bio") ? value : null;
  } catch {
    return null;
  }
}

export function saveLock(config: LockConfig | null) {
  try {
    if (config) localStorage.setItem(LOCK_STORAGE_KEY, JSON.stringify(config));
    else localStorage.removeItem(LOCK_STORAGE_KEY);
    sessionStorage.setItem(UNLOCKED_KEY, "1");
  } catch {}
}

const toBase64 = (bytes: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))));
const fromBase64 = (value: string) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));

export async function hashPin(pin: string, salt: string) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: fromBase64(salt), iterations: 150000 }, material, 256);
  return toBase64(bits);
}

export async function createPinLock(pin: string): Promise<LockConfig> {
  const salt = toBase64(crypto.getRandomValues(new Uint8Array(16)));
  return { type: "pin", salt, hash: await hashPin(pin, salt) };
}

export async function checkPin(config: LockConfig, pin: string) {
  return config.type === "pin" && (await hashPin(pin, config.salt)) === config.hash;
}

export async function biometricAvailable() {
  try {
    return typeof PublicKeyCredential !== "undefined" && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

// Registra la huella/cara de este aparato (el aparato la guarda; la app nunca la ve).
export async function createBiometricLock(name: string): Promise<LockConfig> {
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "Calculadora Emprender" },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name, displayName: name },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
      timeout: 60000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;
  if (!credential) throw new Error("No se pudo registrar.");
  return { type: "bio", credentialId: toBase64(credential.rawId) };
}

export async function checkBiometric(config: LockConfig) {
  if (config.type !== "bio") return false;
  const result = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ type: "public-key", id: fromBase64(config.credentialId) }],
      userVerification: "required",
      timeout: 60000,
    },
  });
  return Boolean(result);
}
