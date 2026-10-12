// Service worker de Calculadora Emprender.
// - Guarda los archivos fijos de la app (estilos, código, íconos) para que abra rápido.
// - Sin internet muestra la pantalla «Estás sin conexión».
// - Con Mensualidad Plus (sw.js?plus=1) guarda también las pantallas que se van abriendo, para poder
//   usarlas sin conexión. Se borran al cerrar sesión.
const VERSION = "v4";
const STATIC_CACHE = `estaticos-${VERSION}`;
const PAGES_CACHE = "pantallas-v1";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png"];
const PLUS = new URL(self.location.href).searchParams.get("plus") === "1";
// Pantallas que nunca se guardan (entrada, pagos, administración y datos de la API).
const NEVER = ["/login", "/auth/", "/api/", "/admin", "/set-password", "/comprar", "/bienvenida"];
// Pantallas principales que se guardan de antemano (Plus), para tenerlas aunque no se hayan abierto.
const WARM = ["/", "/calcular", "/calcular/resina", "/calcular/jesmonite", "/calcular/cemento", "/ventas", "/ventas/nueva", "/stock", "/materials", "/gestion/productos", "/historial", "/mas", "/materials/new", "/produccion/nueva", "/compras/nueva"];

async function warm(paths) {
  await Promise.all(paths.slice(0, 20).map(async (path) => {
    const url = new URL(path, self.location.origin);
    if (!cacheable(url)) return;
    try {
      const request = new Request(url.href, { credentials: "same-origin" });
      const response = await fetch(request);
      await savePage(request, response);
    } catch {}
  }));
  // También cada cosa del stock, para poder anotar movimientos sin conexión.
  if (paths.includes("/stock")) {
    const saved = await (await caches.open(PAGES_CACHE)).match(new URL("/stock", self.location.origin).href);
    const html = saved ? await saved.text() : "";
    const items = [...new Set([...html.matchAll(/href="(\/stock\/[0-9a-f-]{36})"/g)].map((m) => m[1]))].slice(0, 40);
    await Promise.all(items.map(async (path) => {
      try {
        const request = new Request(new URL(path, self.location.origin).href, { credentials: "same-origin" });
        await savePage(request, await fetch(request));
      } catch {}
    }));
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== STATIC_CACHE && (key !== PAGES_CACHE || !PLUS)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
      // Con Plus, apenas se activa guarda las pantallas principales.
      .then(() => (PLUS ? warm(WARM) : undefined)),
  );
});

const cacheable = (url) => url.origin === self.location.origin && !NEVER.some((path) => url.pathname.startsWith(path));

async function savePage(request, response) {
  if (!PLUS || !response.ok || response.redirected || response.type !== "basic") return;
  const html = await response.clone().text();
  const cache = await caches.open(PAGES_CACHE);
  await cache.put(request, response);
  await saveAssets(html);
}

// Guarda también el código y los estilos que usa la pantalla (si no, sin internet no arranca).
async function saveAssets(html) {
  const paths = new Set();
  for (const match of html.matchAll(/(?:\/_next\/)?static\/(?:chunks|css|media)\/[A-Za-z0-9_\-./]+?\.(?:js|css|woff2)/g)) {
    paths.add(match[0].startsWith("/_next/") ? match[0] : `/_next/${match[0]}`);
  }
  const cache = await caches.open(STATIC_CACHE);
  await Promise.all([...paths].slice(0, 200).map(async (path) => {
    if (await cache.match(path)) return;
    try {
      const response = await fetch(path);
      if (response.ok) await cache.put(path, response);
    } catch {}
  }));
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
            // Esa pantalla no estaba guardada: se lleva al Inicio guardado (desde ahí se navega a lo guardado).
            const homeUrl = new URL("/", self.location.origin).href;
            if (url.pathname !== "/" && (await cache.match(new Request(homeUrl)))) return Response.redirect(homeUrl, 302);
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
  if (data.type === "warm" && PLUS) event.waitUntil(warm(Array.isArray(data.urls) ? data.urls : WARM));
});
