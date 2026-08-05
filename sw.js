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
const CACHE = "catcaddy-v92-2026-08-05";
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
  // The app itself: stale-while-revalidate. Serve the cached shell instantly so
  // launch stays as fast as a cache-first build, AND fetch a fresh copy in the
  // background to seed the cache for next launch. Net effect: the newest build
  // lands one launch later than network-first would, with zero launch-time wait.
  // If there's no cache yet (first-ever open or a clean install), fall through to
  // the network and index.html. This branch is code only — your DB rides the
  // Apps Script branch above and stays network-first / live.
  if(url.origin === location.origin){
    e.respondWith(
      caches.match(req).then(hit=>{
        const fresh = fetch(req).then(r=>{
          if(r.ok){
            const copy = r.clone();
            caches.open(CACHE).then(c=>c.put(req, copy));
          }
          return r;
        }).catch(()=> hit || caches.match("./index.html"));
        // Cached copy wins instantly when present; the network refresh still runs
        // to seed next launch. No cache yet → wait on the network.
        return hit || fresh;
      })
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
