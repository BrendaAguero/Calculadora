// Service worker de Calculadora Emprender.
// - Guarda los archivos fijos de la app (estilos, código, íconos) para que abra rápido.
// - Sin internet muestra la pantalla «Estás sin conexión».
// - Con Mensualidad Plus (sw.js?plus=1) guarda también las pantallas que se van abriendo, para poder
//   usarlas sin conexión. Se borran al cerrar sesión.
const VERSION = "v2";
const STATIC_CACHE = `estaticos-${VERSION}`;
const PAGES_CACHE = "pantallas-v1";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png"];
const PLUS = new URL(self.location.href).searchParams.get("plus") === "1";
// Pantallas que nunca se guardan (entrada, pagos, administración y datos de la API).
const NEVER = ["/login", "/auth/", "/api/", "/admin", "/set-password", "/comprar", "/bienvenida"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== STATIC_CACHE && (key !== PAGES_CACHE || !PLUS)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

const cacheable = (url) => url.origin === self.location.origin && !NEVER.some((path) => url.pathname.startsWith(path));

async function savePage(request, response) {
  if (!PLUS || !response.ok || response.redirected || response.type !== "basic") return;
  const cache = await caches.open(PAGES_CACHE);
  await cache.put(request, response);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Pantallas: siempre desde internet. Sin conexión: la última versión guardada (Plus) o el aviso.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (cacheable(url)) event.waitUntil(savePage(request, response.clone()));
          return response;
        })
        .catch(async () => {
          if (PLUS && cacheable(url)) {
            const cache = await caches.open(PAGES_CACHE);
            const saved = (await cache.match(request)) || (await cache.match(request, { ignoreSearch: true }));
            if (saved) return saved;
          }
          return caches.match(OFFLINE_URL);
        }),
    );
    return;
  }

  // Archivos fijos con nombre único (no cambian): primero los guardados.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })),
    );
  }
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  // Al cerrar sesión: borrar las pantallas guardadas (tienen datos de la cuenta).
  if (data.type === "clear") event.waitUntil(caches.delete(PAGES_CACHE));
  // Plus: guardar de antemano las pantallas principales para tenerlas sin conexión.
  if (data.type === "warm" && PLUS && Array.isArray(data.urls)) {
    event.waitUntil(Promise.all(data.urls.slice(0, 20).map(async (path) => {
      const url = new URL(path, self.location.origin);
      if (!cacheable(url)) return;
      try {
        const request = new Request(url.href, { credentials: "same-origin" });
        const response = await fetch(request);
        await savePage(request, response);
      } catch {}
    })));
  }
});
