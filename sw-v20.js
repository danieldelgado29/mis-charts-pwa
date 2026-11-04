/* Mis Charts v2.0 */
var CACHE='mis-charts-botones-v2.4.0';
var ASSETS=['./?v=2.4.0','./index.html?v=2.4.0','./styles.css?v=2.4.0','./app.js?v=2.4.0','./notation-v24.js?v=2.4.0','./icons/icon180.png','./icons/icon192.png','./icons/icon512.png'];
self.addEventListener('install',function(e){e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(ASSETS);}).then(function(){return self.skipWaiting();}));});
self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(keys){return Promise.all(keys.map(function(k){if(k.indexOf('mis-charts-botones-')===0&&k!==CACHE)return caches.delete(k);}));}).then(function(){return self.clients.claim();}));});
self.addEventListener('fetch',function(e){if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(function(r){if(r.ok&&new URL(e.request.url).origin===self.location.origin){var copy=r.clone();caches.open(CACHE).then(function(c){c.put(e.request,copy);});}return r;}).catch(function(){return caches.match(e.request).then(function(hit){return hit||caches.match('./index.html?v=2.4.0');});}));});
