// Cleanup worker for the retired MVP cache. The current full calculator does not register a service worker.
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key)))));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key))));
    await self.registration.unregister();
    const clientsList = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
    for (const client of clientsList) client.navigate(client.url);
  })());
});
self.addEventListener('fetch', () => {});
