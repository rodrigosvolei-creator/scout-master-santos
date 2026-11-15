// PWA Fase 1: app instalável (manifest + ícones + SW). Valida os arquivos
// estáticos e as tags no <head>, e que o Service Worker NUNCA cacheia dado ao vivo
// (RTDB/Auth) — senão quebraria o realtime/login.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
let ok = 0, ko = 0;
function chk(c, m){ if(c){ ok++; console.log('OK   '+m);} else { ko++; console.log('FAIL '+m);} }
function rd(f){ return fs.readFileSync(path.join(ROOT, f), 'utf8'); }
function exists(f){ try { return fs.statSync(path.join(ROOT, f)).size; } catch(e){ return 0; } }

// 1) MANIFEST
chk(exists('manifest.webmanifest') > 0, 'manifest.webmanifest existe');
let man = null;
try { man = JSON.parse(rd('manifest.webmanifest')); chk(true, 'manifest é JSON válido'); }
catch(e){ chk(false, 'manifest é JSON válido — '+e.message); }
if (man) {
  chk(!!man.name && !!man.short_name, 'manifest: name + short_name');
  chk(man.start_url && man.scope, 'manifest: start_url + scope');
  chk(man.display === 'standalone', 'manifest: display standalone (abre como app)');
  chk(/^#/.test(man.theme_color||'') && /^#/.test(man.background_color||''), 'manifest: theme_color + background_color');
  var ic = man.icons || [];
  var sz = ic.map(function(i){ return i.sizes; });
  chk(sz.indexOf('192x192') >= 0 && sz.indexOf('512x512') >= 0, 'manifest: ícones 192 e 512');
  chk(ic.some(function(i){ return (i.purpose||'').indexOf('maskable') >= 0; }), 'manifest: ícone maskable (safe zone Android)');
  // os arquivos de ícone referenciados existem de verdade
  var faltando = ic.filter(function(i){ return !exists(i.src); }).map(function(i){ return i.src; });
  chk(faltando.length === 0, 'manifest: todos os PNGs referenciados existem'+(faltando.length?' — faltam '+faltando.join(','):''));
}

// 2) ÍCONES (arquivos e assinatura PNG)
['icon-192.png','icon-512.png','icon-maskable.png','apple-touch-icon.png','favicon.png'].forEach(function(f){
  var sz = exists(f);
  var isPng = sz > 0 && fs.readFileSync(path.join(ROOT,f)).slice(0,8).toString('hex') === '89504e470d0a1a0a';
  chk(sz > 0 && isPng, 'ícone '+f+' existe e é PNG válido ('+sz+' bytes)');
});

// 3) <head> do index.html
var html = rd('index.html');
chk(/<link[^>]+rel=["']manifest["'][^>]+href=["']\.?\/?manifest\.webmanifest/.test(html), 'index: <link rel="manifest">');
chk(/rel=["']apple-touch-icon["']/.test(html), 'index: apple-touch-icon');
chk(/name=["']apple-mobile-web-app-title["']/.test(html), 'index: apple-mobile-web-app-title');
chk(/name=["']apple-mobile-web-app-capable["'][^>]+content=["']yes["']/.test(html), 'index: apple-mobile-web-app-capable=yes');
chk(/name=["']theme-color["']/.test(html), 'index: theme-color');
chk(/serviceWorker/.test(html) && /register\(\s*["']\.?\/?sw\.js["']/.test(html), 'index: registra o Service Worker (./sw.js)');

// 4) SERVICE WORKER — offline shell sem quebrar dado ao vivo
chk(exists('sw.js') > 0, 'sw.js existe');
var sw = rd('sw.js');
chk(/skipWaiting\(\)/.test(sw) && /clients\.claim\(\)/.test(sw), 'sw: skipWaiting + clients.claim (atualiza sem "fechar todas as abas")');
chk(/req\.mode\s*===\s*['"]navigate['"]/.test(sw), 'sw: trata navegação (network-first do app)');
// CRITICO: RTDB e Auth NAO podem ser cacheados/interceptados
chk(/firebaseio\.com/.test(sw) && /identitytoolkit/.test(sw), 'sw: RTDB + Auth listados como dado AO VIVO (não intercepta)');
// o fetch handler retorna cedo (return) pros hosts ao vivo, ANTES de qualquer respondWith
var liveIdx = sw.indexOf('LIVE_HOSTS');
var navIdx = sw.indexOf("=== 'navigate'") >= 0 ? sw.indexOf("=== 'navigate'") : sw.indexOf('=== "navigate"');
chk(liveIdx >= 0 && navIdx >= 0 && sw.lastIndexOf('LIVE_HOSTS') < navIdx, 'sw: checa dado ao vivo ANTES de interceptar navegação (RTDB passa direto)');
chk(/gstatic\.com/.test(sw), 'sw: CDN (Firebase SDK/fontes) cacheável pro shell abrir offline');

// 5) ATUALIZACAO DE VERSAO (build 2026-11-14a): iPhone/iPad seguravam versao velha (cache HTTP + pagina em memoria)
chk(/cache:\s*['"]no-store['"]/.test(sw), 'sw: navegação busca o HTML com cache:"no-store" (sem cache HTTP do navegador)');
chk(/rsscout-shell-v2/.test(sw), 'sw: cache v2 (a ativação apaga o v1 e recarrega páginas antigas)');
chk(/updateViaCache:\s*['"]none['"]/.test(html), 'index: registra o SW com updateViaCache:"none"');
var mMeta = /<meta name="rs-build" content="([^"]+)">/.exec(html);
var mBuild = /var APP_BUILD="([^ "]+)/.exec(html);
chk(!!mMeta && !!mBuild && mMeta[1] === mBuild[1], 'index: <meta name="rs-build"> ('+(mMeta&&mMeta[1])+') == 1o item do APP_BUILD ('+(mBuild&&mBuild[1])+') — BUMPAR OS DOIS JUNTOS a cada build');
chk(!!mMeta && html.indexOf('<meta name="rs-build"') < 2000, 'index: o meta do build fica nos primeiros 2 KB (a checagem de versão só lê o começo do arquivo)');
chk(/index\.html\?vchk=1/.test(html) && /_verCheckNow/.test(html), 'index: checagem de versão contra o servidor (index.html?vchk=1)');

console.log('\n=== test_pwa: '+ok+' OK, '+ko+' FAIL ===');
process.exit(ko > 0 ? 1 : 0);
