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
const CACHE = "catcaddy-v131.2-2026-08-17";
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
  // The app DOCUMENT (index.html / navigations): NETWORK-FIRST, so every online
  // launch runs the newest build instead of last launch's cached copy.
  //  - {cache:"reload"} bypasses the browser + GitHub-Pages HTTP cache, so a
  //    stale index.html can never be handed back.
  //  - a 3s timeout guards the walk-in: if the signal is slow or half-dead we
  //    stop waiting and serve the cached shell, so launch never stalls.
  //  - offline (fetch fails) falls back to the cached shell as well.
  //  - on success we refresh the cached copy so the offline fallback is current
  //    next time. Everything else same-origin (icons/images) stays cache-first
  //    for an instant launch. Your DB still rides the Apps Script branch above.
  if(url.origin === location.origin){
    const isDoc = req.mode === "navigate"
               || url.pathname.endsWith("/")
               || url.pathname.endsWith("index.html");
    if(isDoc){
      e.respondWith((async ()=>{
        const fromCache = ()=> caches.match(req)
          .then(h=> h || caches.match("./index.html"))
          .then(h=> h || caches.match("./"));
        const net = fetch(req.url, { cache: "reload" }).then(r=>{
          if(r && r.ok){
            const copy = r.clone();
            caches.open(CACHE).then(c=> c.put("./index.html", copy));
          }
          return r;
        });
        net.catch(()=>{});   // keep it alive to seed the cache even if we time out
        try{
          const timeout = new Promise((_, rej)=> setTimeout(()=> rej(new Error("slow")), 3000));
          return await Promise.race([net, timeout]);
        }catch(_){
          return (await fromCache()) || net;   // slow/offline → cached shell
        }
      })());
      return;
    }
    e.respondWith(
      caches.match(req).then(hit=>{
        const fresh = fetch(req).then(r=>{
          if(r.ok){
            const copy = r.clone();
            caches.open(CACHE).then(c=>c.put(req, copy));
          }
          return r;
        }).catch(()=> hit || caches.match("./index.html"));
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
