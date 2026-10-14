self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => self.clients.claim());
const CACHE='aimes-v11-2';
self.addEventListener('fetch', e => {
  if (e.request.url.includes('web-llm') || e.request.url.includes('mlc') || e.request.url.includes('huggingface')) return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      if (res.ok && (e.request.url.includes('jspdf') || e.request.url.endsWith('.json') || e.request.url.endsWith('.html'))) {
        caches.open(CACHE).then(c => c.put(e.request, res.clone())).catch(()=>{});
      }
      return res;
    }).catch(()=> r))
  );
});
