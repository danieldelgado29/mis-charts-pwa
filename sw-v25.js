/* Mis Charts 2.5 — PWA sin AppCache antiguo. */
'use strict';
var CACHE='mis-charts-runtime-v2.6.0';
var FILES=['./launch-v25.html?v=2.6.0','./index.html?v=2.6.0','./styles.css?v=2.6.0','./app.js?v=2.6.0','./notation-v24.js?v=2.6.0','./manifest.webmanifest?v=2.6.0','./icons/icon180.png','./icons/icon192.png','./icons/icon512.png'];
self.addEventListener('install',function(event){
 event.waitUntil(caches.open(CACHE).then(function(cache){
  return Promise.all(FILES.map(function(url){return cache.add(url).catch(function(){return null;});}));
 }).then(function(){return self.skipWaiting();}));
});
self.addEventListener('activate',function(event){
 event.waitUntil(caches.keys().then(function(keys){
  return Promise.all(keys.map(function(key){
   if(key.indexOf('mis-charts-runtime-')===0||key.indexOf('mis-charts-botones-')===0){
    if(key!==CACHE)return caches.delete(key);
   }
   return Promise.resolve();
  }));
 }).then(function(){return self.clients.claim();}));
});
self.addEventListener('fetch',function(event){
 var request=event.request;
 if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
 event.respondWith(fetch(request,{cache:'no-store'}).then(function(response){
  if(response.ok){var copy=response.clone();caches.open(CACHE).then(function(c){return c.put(request,copy);}).catch(function(){});}
  return response;
 }).catch(function(){
  return caches.match(request).then(function(saved){
   if(saved)return saved;
   if(request.mode==='navigate')return caches.match('./launch-v25.html?v=2.6.0');
   return Response.error();
  });
 }));
});
