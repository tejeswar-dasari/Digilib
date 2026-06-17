const CACHE_NAME = "digilib-v1";

const urlsToCache = [
    "/",
    "/index.html",
    "/admin.html",
    "/guidelines.html",
    "/privacy.html",
    "/terms.html",
    "/manifest.json",
    "/icon-192.png",
    "/icon-512.png",
    "/offline.html"
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener("fetch", event => {
    event.respondWith(
        fetch(event.request)
            .catch(() => caches.match(event.request))
            .then(response => response || caches.match("/offline.html"))
    );
});