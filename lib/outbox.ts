// Bandeja de salida del modo sin conexión: lo que se carga sin internet queda guardado en el aparato
// (IndexedDB) hasta que vuelve la conexión y se sube solo.
export type OutboxType = "sale" | "yeso_calc" | "mix_calc" | FormType;
// Formularios que se guardan tal cual (los campos del formulario) y se mandan al servidor al volver internet.
export const FORM_TYPES = ["material", "stock_item", "stock_move", "production", "purchase"] as const;
export type FormType = (typeof FORM_TYPES)[number];
export type OutboxItem = { id: string; userId: string | null; type: OutboxType; payload: unknown; label: string; createdAt: number; error?: string };

export const OFFLINE_PLUS_KEY = "calculadora-sin-conexion";
export const OFFLINE_USER_KEY = "calculadora-usuaria";
export const LAST_ONLINE_KEY = "calculadora-ultima-conexion";
export const OFFLINE_MAX_DAYS = 30;
export const OUTBOX_EVENT = "calculadora-outbox";

const DB = "calculadora";
const STORE = "salida";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore(STORE, { keyPath: "id" }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = fn(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(request.result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };

// ¿Este aparato tiene el modo sin conexión? (Mensualidad Plus; lo informa el servidor en cada conexión).
export const offlineEnabled = () => read(OFFLINE_PLUS_KEY) === "1";
export const isOffline = () => typeof navigator !== "undefined" && !navigator.onLine;

export async function enqueue(type: OutboxType, payload: unknown, label: string) {
  const item: OutboxItem = { id: crypto.randomUUID(), userId: read(OFFLINE_USER_KEY), type, payload, label, createdAt: Date.now() };
  await run("readwrite", (store) => store.put(item));
  window.dispatchEvent(new Event(OUTBOX_EVENT));
  return item;
}

export const listOutbox = () => run<OutboxItem[]>("readonly", (store) => store.getAll() as IDBRequest<OutboxItem[]>);
export const removeFromOutbox = (id: string) => run("readwrite", (store) => store.delete(id));
export const updateOutbox = (item: OutboxItem) => run("readwrite", (store) => store.put(item));
