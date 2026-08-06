/* RS-Scout — Service Worker (PWA Fase 1)
   Objetivo: app instalável, abre offline (app shell) e ATUALIZA sozinho a cada
   redeploy — sem "limpar cache" e sem precisar bumpar versão a cada deploy.

   Estratégia por tipo de requisição:
   - Navegação (o HTML do app): NETWORK-FIRST -> online sempre pega a versão nova
     do servidor; offline cai no último index.html cacheado.
   - CDN estático (Firebase SDK, Google Fonts): CACHE-FIRST (URLs versionadas/imutáveis)
     — é o que permite o shell abrir offline.
   - Mesmo host (ícones, manifest): CACHE-FIRST leve.
   - Firebase RTDB / Auth (dado AO VIVO): NÃO intercepta — passa direto pra rede.
     Nunca cacheia dado ao vivo nem atrapalha o realtime/login. */
'use strict';
var CACHE = 'rsscout-shell-v1';
var SHELL = './';
// hosts de DADO AO VIVO: o SW nao intercepta (deixa o Firebase cuidar do realtime)
var LIVE_HOSTS = ['firebaseio.com', 'firebasedatabase.app', 'googleapis.com',
  'identitytoolkit', 'securetoken', 'firebaseinstallations', 'firebaselogging'];
// CDN estatico que pode ser cacheado (cache-first)
var CDN_HOSTS = ['gstatic.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

// URLs estaveis do SDK do Firebase (9.22.0) — pre-cacheia no install pra o app
// abrir offline ja na 1a visita. Best-effort: se falhar (sem rede no install), o
// cache-first pega depois; o install NAO falha por causa disso.
var PRECACHE = [
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js'
];
self.addEventListener('install', function(e){
  self.skipWaiting();
  e.waitUntil((async function(){
    try { var c = await caches.open(CACHE); await c.addAll(PRECACHE); } catch (_) { /* best-effort */ }
  })());
});

self.addEventListener('activate', function(e){
  e.waitUntil((async function(){
    var keys = await caches.keys();
    await Promise.all(keys.map(function(k){ return k === CACHE ? null : caches.delete(k); }));
    await self.clients.claim();
  })());
});

function cacheFirst(req){
  return (async function(){
    var hit = await caches.match(req);
    if (hit) return hit;
    try {
      var net = await fetch(req);
      if (net && net.ok) { var c = await caches.open(CACHE); c.put(req, net.clone()); }
      return net;
    } catch (err) { return hit || Response.error(); }
  })();
}

self.addEventListener('fetch', function(e){
  var req = e.request;
  if (req.method !== 'GET') return;                 // POST/PUT etc. passam direto
  var url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // 1) Dado ao vivo (RTDB / Auth): NAO intercepta
  for (var i = 0; i < LIVE_HOSTS.length; i++) {
    if (url.hostname.indexOf(LIVE_HOSTS[i]) >= 0) return;
  }

  // 2) Navegacao (o app): network-first, offline -> shell cacheado
  if (req.mode === 'navigate') {
    e.respondWith((async function(){
      try {
        var net = await fetch(req);
        var c = await caches.open(CACHE);
        c.put(SHELL, net.clone());                  // guarda o ultimo index bom
        return net;
      } catch (err) {
        var cached = await caches.match(SHELL);
        return cached || Response.error();
      }
    })());
    return;
  }

  // 3) CDN estatico (Firebase SDK, fontes): cache-first
  for (var j = 0; j < CDN_HOSTS.length; j++) {
    if (url.hostname.indexOf(CDN_HOSTS[j]) >= 0) { e.respondWith(cacheFirst(req)); return; }
  }

  // 4) Mesmo host (icones, manifest, favicon): cache-first
  if (url.origin === self.location.origin) { e.respondWith(cacheFirst(req)); return; }

  // 5) Resto: passa direto
});
