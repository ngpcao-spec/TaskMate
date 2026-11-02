/* Service worker TaskMate — mise en cache de l'app (coquille + assets hachés). Jamais l'API Supabase :
   les données passent par le cache TanStack Query persistant et la file d'écritures hors ligne. */
importScripts('/sw-push.js'); // notifications push

const VERSION = 'taskmate-v2';
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(['/', '/manifest.webmanifest', '/sw-push.js'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase, polices externes : réseau uniquement

  // Vidéo d'accueil V2 (D-106) : réseau seulement. Le navigateur la lit par requêtes partielles (Range → 206), que le cache ne sait pas servir
  // (Safari refuse une réponse complète à une requête partielle) ; jamais de 206 en cache.
  if (request.headers.has('range') || request.destination === 'video' || request.destination === 'audio') return;

  // Fichiers hachés / icônes : cache d'abord (immuables)
  if (url.pathname.startsWith('/_expo/static/') || url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }),
    );
    return;
  }

  // Navigations : réseau d'abord, repli sur la coquille en cache (démarrage hors ligne)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) caches.open(SHELL).then((cache) => cache.put(request, res.clone()));
          return res;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match('/')) || Response.error()),
    );
  }
});
