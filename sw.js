/* Label — offline shell.
   Caches the app and its CDN libraries so it opens with no signal.
   Your data never comes through here: items, PLUs and the calendar live in
   localStorage, which works offline anyway. This is only about the app
   itself loading when you're standing in a walk-in with no bars.          */
/* BUMP THIS ON EVERY DEPLOY.
   It was hard-coded to "label-v1" forever while the shell was served
   cache-first, and activate only deletes caches whose name DIFFERS from this
   one. So the name never changed, the old cache was never dropped, and a phone
   went on serving the first index.html it ever saw — every update invisible
   until you cleared site data. The comment next to the fetch handler said the
   shell "barely changes", which was wrong the day it was written. */
const CACHE = "catcaddy-v41-2026-07-20";
const SHELL = [
  "./",
  "./index.html",
  "./logo.png",
  "./icon-192.png",
  "./cat-idle.webp",
  "./cat_no_obvious_headshake.gif",
  "./cat_smile_instant.gif",
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
  // The app itself: network first, cache as the fallback. It changes often, and
  // a stale copy is worse than a slow one — you'd be looking at last week's
  // build with no way to tell. The cache is still there for the walk-in with no
  // bars; it just stops being the first answer.
  if(url.origin === location.origin){
    e.respondWith(
      fetch(req).then(r=>{
        if(r.ok){
          const copy = r.clone();
          caches.open(CACHE).then(c=>c.put(req, copy));
        }
        return r;
      }).catch(()=> caches.match(req).then(hit=> hit || caches.match("./index.html")))
    );
    return;
  }

  // CDN libraries are versioned in their URL, so those really don't change.
  e.respondWith(
    caches.match(req).then(hit=> hit || fetch(req).then(r=>{
      if(r.ok && url.hostname.includes("cdnjs")){
        const copy = r.clone();
        caches.open(CACHE).then(c=>c.put(req, copy));
      }
      return r;
    }).catch(()=>caches.match("./index.html")))
  );
});
