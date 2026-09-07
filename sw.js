const CACHE_PREFIX="time-calculator-";
const CACHE_NAME="time-calculator-2.0.63-icon-isolation";
const CORE_ASSETS=[
  "./",
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./manifest.webmanifest",
  "./assets/icons/icon-192.png?v=time-calculator-20260907",
  "./assets/icons/icon-192-dark.png?v=time-calculator-20260907",
  "./assets/icons/icon-512.png?v=time-calculator-20260907",
  "./assets/icons/icon-1024.png?v=time-calculator-20260907",
  "./assets/icons/favicon-32.png?v=time-calculator-20260907",
  "./assets/icons/apple-touch-icon.png?v=time-calculator-20260907"
];

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(CORE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE_NAME).map(key=>caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch",event=>{
  const requestUrl=new URL(event.request.url);
  if(event.request.method!=="GET"||requestUrl.origin!==self.location.origin||!requestUrl.pathname.startsWith(self.registration.scope.replace(self.location.origin,"")))return;
  event.respondWith(caches.open(CACHE_NAME).then(cache=>cache.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
    const copy=response.clone();
    cache.put(event.request,copy);
    return response;
  }).catch(()=>cache.match("./index.html")))));
});
