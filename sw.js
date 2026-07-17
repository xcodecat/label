/* Label — offline shell.
   Caches the app and its CDN libraries so it opens with no signal.
   Your data never comes through here: items, PLUs and the calendar live in
   localStorage, which works offline anyway. This is only about the app
   itself loading when you're standing in a walk-in with no bars.          */
const CACHE = "label-v1";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.5/JsBarcode.all.min.js"
];

self.addEventListener("install", e=>{
  e.waitUntil(
    caches.open(CACHE).then(c=>
      // Don't let one dead CDN URL fail the whole install
      Promise.all(SHELL.map(u=>c.add(u).catch(()=>null)))
    ).then(()=>self.skipWaiting())
  );
});

self.addEventListener("activate", e=>{
  e.waitUntil(
    caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch", e=>{
  const req = e.request;
  if(req.method !== "GET") return;                    // never cache sync POSTs

  const url = new URL(req.url);
  // Apps Script + flyer data: network first, fall back to the last good copy
  if(url.hostname.includes("script.google") || url.hostname.includes("wishabi")){
    e.respondWith(
      fetch(req).then(r=>{
        const copy = r.clone();
        caches.open(CACHE).then(c=>c.put(req, copy));
        return r;
      }).catch(()=>caches.match(req))
    );
    return;
  }
  // App shell: cache first, it barely changes
  e.respondWith(
    caches.match(req).then(hit=> hit || fetch(req).then(r=>{
      if(r.ok && (url.origin === location.origin || url.hostname.includes("cdnjs"))){
        const copy = r.clone();
        caches.open(CACHE).then(c=>c.put(req, copy));
      }
      return r;
    }).catch(()=>caches.match("./index.html")))
  );
});
