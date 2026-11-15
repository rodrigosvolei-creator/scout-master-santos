/* RS-Scout — Service Worker (PWA) — v2 (build 2026-11-14a)
   Objetivo: app instalável, abre offline (app shell) e ATUALIZA sozinho a cada
   redeploy — sem "limpar cache" e sem precisar bumpar versão a cada deploy.

   Por que v2: o servidor (nginx) não manda Cache-Control. Sem ele o navegador guarda
   o index.html no cache HTTP pela "heurística" do Last-Modified (≈10% da idade do
   arquivo: um deploy de 30 dias atrás = ~3 dias de cache). O v1 fazia fetch(req) na
   navegação, que PASSA pelo cache HTTP — por isso iPhone/iPad seguravam versão velha.
   Agora a navegação busca com cache:'no-store' (só a rede decide a versão).

   Estratégia por tipo de requisição:
   - Navegação do app (o index.html): NETWORK-FIRST sem cache HTTP; offline (ou rede
     travada por mais de 6 s) cai no último index.html bom guardado aqui.
   - Outras páginas do mesmo host (manual etc.): rede sem cache HTTP, sem guardar.
   - CDN estático (Firebase SDK, Google Fonts): CACHE-FIRST (URLs versionadas/imutáveis)
     — é o que permite o shell abrir offline.
   - Estáticos do mesmo host (ícones, manifest, imagens): cache + atualização em 2º plano.
   - Todo o resto do mesmo host (checagem de versão ?vchk=1, sw.js…): NÃO intercepta.
   - Firebase RTDB / Auth (dado AO VIVO): NÃO intercepta — passa direto pra rede.
     Nunca cacheia dado ao vivo nem atrapalha o realtime/login. */
'use strict';
var CACHE = 'rsscout-shell-v2';
var SHELL = './';
var NAV_TIMEOUT_MS = 6000;
// hosts de DADO AO VIVO: o SW nao intercepta (deixa o Firebase cuidar do realtime)
var LIVE_HOSTS = ['firebaseio.com', 'firebasedatabase.app', 'googleapis.com',
  'identitytoolkit', 'securetoken', 'firebaseinstallations', 'firebaselogging'];
// CDN estatico que pode ser cacheado (cache-first)
var CDN_HOSTS = ['gstatic.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
// estaticos do proprio host que valem cache (o resto passa direto)
var STATIC_RE = /\.(png|jpe?g|gif|webp|svg|ico|webmanifest|woff2?)$/i;

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

// Pergunta o build a uma pagina aberta. Pagina NOVA (build 2026-11-14a+) responde; pagina
// antiga nao tem quem responda -> null depois de 1,5 s.
function askBuild(client){
  return new Promise(function(resolve){
    var done = false;
    var fin = function(v){ if (!done) { done = true; resolve(v); } };
    try {
      var ch = new MessageChannel();
      ch.port1.onmessage = function(ev){ fin((ev.data && ev.data.build) || null); };
      client.postMessage({ type: 'rs-build?' }, [ch.port2]);
    } catch (_) { fin(null); return; }
    setTimeout(function(){ fin(null); }, 1500);
  });
}

self.addEventListener('activate', function(e){
  e.waitUntil((async function(){
    var keys = await caches.keys();
    var upgrade = keys.some(function(k){ return k !== CACHE && k.indexOf('rsscout-shell') === 0; });
    await Promise.all(keys.map(function(k){ return k === CACHE ? null : caches.delete(k); }));
    await self.clients.claim();
    // Veio de um SW anterior: a pagina aberta pode ser HTML velho (cache HTTP do Safari).
    // Pagina antiga (nao responde ao askBuild) e recarregada UMA vez — agora a navegacao passa
    // por aqui e vem sem cache. Pagina nova so e avisada pra conferir a versao (ela decide a
    // hora segura de recarregar: nunca no meio de uma marcacao).
    if (upgrade) {
      try {
        var list = await self.clients.matchAll({ type: 'window' });
        for (var i = 0; i < list.length; i++) {
          var c = list[i];
          var b = await askBuild(c);
          try {
            if (b) c.postMessage({ type: 'rs-sw-new' });
            else if (c.navigate) await c.navigate(c.url);
          } catch (_) {}
        }
      } catch (_) {}
    }
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

// devolve o que esta no cache e atualiza em 2o plano (icone/manifest novo aparece na proxima)
function staleWhileRevalidate(req){
  return (async function(){
    var c = await caches.open(CACHE);
    var hit = await c.match(req);
    var net = fetch(req).then(function(r){ if (r && r.ok) c.put(req, r.clone()); return r; }).catch(function(){ return null; });
    return hit || (await net) || Response.error();
  })();
}

// Busca SEM cache HTTP; ms > 0 = desiste depois desse tempo (pra cair no shell guardado)
function fetchFresh(url, ms){
  var p = fetch(url, { cache: 'no-store', credentials: 'same-origin' });
  if (!ms) return p;
  return Promise.race([p, new Promise(function(_, rej){ setTimeout(function(){ rej(new Error('nav-timeout')); }, ms); })]);
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

  // 2) Navegacao: network-first SEM cache HTTP; offline -> shell guardado (so pro app)
  if (req.mode === 'navigate') {
    var scope = new URL(SHELL, self.location.href).pathname;       // "/" (ou a pasta do app)
    var isShell = url.origin === self.location.origin && (url.pathname === scope || url.pathname === scope + 'index.html');
    e.respondWith((async function(){
      var cached = isShell ? await caches.match(SHELL) : null;
      try {
        var net = await fetchFresh(req.url, (isShell && cached) ? NAV_TIMEOUT_MS : 0);
        if (net && net.redirected) return fetch(req);            // redirecionou: deixa o navegador seguir
        if (isShell && net && net.ok) { var c = await caches.open(CACHE); c.put(SHELL, net.clone()); }  // guarda o ultimo index bom
        return net;
      } catch (err) {
        if (cached) return cached;
        try { return await fetch(req); } catch (_) { return Response.error(); }
      }
    })());
    return;
  }

  // 3) CDN estatico (Firebase SDK, fontes): cache-first
  for (var j = 0; j < CDN_HOSTS.length; j++) {
    if (url.hostname.indexOf(CDN_HOSTS[j]) >= 0) { e.respondWith(cacheFirst(req)); return; }
  }

  // 4) Mesmo host: so ESTATICOS (icones, manifest, imagens). HTML/JS/JSON (e a checagem de
  //    versao ?vchk=1) passam direto pra rede — o v1 guardava tudo cache-first pra sempre.
  if (url.origin === self.location.origin && STATIC_RE.test(url.pathname)) { e.respondWith(staleWhileRevalidate(req)); return; }

  // 5) Resto: passa direto
});
