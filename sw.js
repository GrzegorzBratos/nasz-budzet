// Service worker: trzyma w telefonie TYLKO wygląd strony (pliki z tego repozytorium), żeby szybko się otwierała.
// Danych nie zapisuje nigdy: zapytania do Google (logowanie, brama) w ogóle tu nie przechodzą.
const WERSJA = 'nb-v2';
const PLIKI = ['./', 'index.html', 'style.css', 'app.js', 'config.js', 'manifest.webmanifest', 'icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(WERSJA).then(c => c.addAll(PLIKI)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== WERSJA).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;   // Google i brama – bez dotykania
  // Najpierw sieć (zawsze najnowsza wersja strony), pamięć tylko gdy brak internetu.
  e.respondWith(fetch(e.request).then(r => {
    const kopia = r.clone(); caches.open(WERSJA).then(c => c.put(e.request, kopia)); return r;
  }).catch(() => caches.match(e.request)));
});
