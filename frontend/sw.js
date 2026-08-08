const CACHE_NAME = "digilib-v2";

const urlsToCache = [
    "/",
    "/index.html",
    "/admin.html",
    "/btech.html",
    "/school.html",
    "/intermediate.html",
    "/books.html",
    "/request.html",
    "/contribute.html",
    "/guidelines.html",
    "/privacy.html",
    "/terms.html",
    "/manifest.json",
    "/icon-192.png",
    "/icon-512.png",
    "/offline.html"
];

self.addEventListener("install", event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", event => {
    const url = new URL(event.request.url);

    // Bypass Service Worker for all API endpoints and non-GET requests
    if (event.request.method !== "GET" || 
        url.pathname.startsWith("/resources") || 
        url.pathname.startsWith("/requests") || 
        url.pathname.startsWith("/download") || 
        url.pathname.startsWith("/login") || 
        url.pathname.startsWith("/signup") || 
        url.pathname.startsWith("/admin-login") || 
        url.pathname.startsWith("/reset-password") || 
        url.pathname.startsWith("/test") ||
        url.pathname.startsWith("/uploads")) {
        return; // Let browser perform direct network fetch
    }

    event.respondWith(
        fetch(event.request)
            .then(response => {
                if (response && response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
                }
                return response;
            })
            .catch(() => {
                return caches.match(event.request).then(cachedResponse => {
                    if (cachedResponse) return cachedResponse;
                    if (event.request.mode === 'navigate') {
                        return caches.match("/offline.html");
                    }
                    return new Response(JSON.stringify({ error: "Offline" }), {
                        status: 503,
                        headers: { "Content-Type": "application/json" }
                    });
                });
            })
    );
});