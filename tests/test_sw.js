// Service Worker v2 (build 2026-11-14a) — o comportamento, nao so o texto do arquivo.
// Problema real: o servidor (nginx) nao manda Cache-Control; o Safari guardava o index.html no cache
// HTTP por dias e o SW v1 buscava a navegacao com fetch(req) — que passa por esse cache. iPhone/iPad
// ficavam em versao velha (e versao velha no mesmo jogo = bugs de gravacao de volta).
// Roda o sw.js num contexto isolado (vm) com caches/fetch/clients falsos e dispara os eventos.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
const ORIGIN = 'https://scout.exemplo.com';
let ok = 0, ko = 0;
function chk(c, m){ if (c) { ok++; console.log('OK   ' + m); } else { ko++; console.log('FAIL ' + m); } }
function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

function makeEnv(){
  const env = { offline: false, hang: false, fast: false, fetchCalls: [], skipped: false, claimed: false, clients: [], listeners: {} };
  const store = new Map(); // nome do cache -> Map(url -> resposta)
  const keyOf = req => new URL(typeof req === 'string' ? req : req.url, ORIGIN + '/').href;
  const mkRes = (url, extra) => Object.assign({ ok: true, status: 200, url: url, redirected: false, body: 'net:' + url, clone(){ return Object.assign({}, this, { cloned: true }); } }, extra || {});
  env.store = store; env.keyOf = keyOf; env.mkRes = mkRes;
  const cacheApi = name => { if (!store.has(name)) store.set(name, new Map()); const m = store.get(name); return {
    put: async (req, res) => { m.set(keyOf(req), res); },
    match: async req => m.get(keyOf(req)),
    addAll: async urls => { for (const u of urls) m.set(keyOf(u), mkRes(u, { precached: true })); } }; };
  const caches = {
    open: async name => cacheApi(name),
    match: async req => { for (const m of store.values()) { const k = keyOf(req); if (m.has(k)) return m.get(k); } return undefined; },
    keys: async () => Array.from(store.keys()),
    delete: async name => store.delete(name)
  };
  const fetchFn = (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    env.fetchCalls.push({ url: url, init: init || null, byRequest: typeof input !== 'string' });
    if (env.offline) return Promise.reject(new Error('offline'));
    if (env.hang) return new Promise(function(){});
    return Promise.resolve(env.nextRes ? env.nextRes(url) : mkRes(url));
  };
  class FakeChannel { constructor(){ const p1 = { onmessage: null }; this.port1 = p1; this.port2 = { postMessage(d){ setTimeout(function(){ if (p1.onmessage) p1.onmessage({ data: d }); }, 0); } }; } }
  const self = {
    addEventListener: (t, fn) => { env.listeners[t] = fn; },
    skipWaiting: () => { env.skipped = true; },
    clients: { claim: async () => { env.claimed = true; }, matchAll: async () => env.clients },
    location: { href: ORIGIN + '/sw.js', origin: ORIGIN }
  };
  const ctx = { self: self, caches: caches, fetch: fetchFn, URL: URL, Response: { error: () => ({ type: 'error' }) }, Promise: Promise, MessageChannel: FakeChannel, console: console,
    setTimeout: (fn, ms) => setTimeout(fn, env.fast ? Math.min(ms, 5) : ms) };
  vm.createContext(ctx); vm.runInContext(SRC, ctx);
  env.fetchEvent = function(url, o){
    o = o || {};
    const ev = { request: { url: new URL(url, ORIGIN + '/').href, method: o.method || 'GET', mode: o.mode || 'no-cors' }, responded: null, respondWith(p){ ev.responded = Promise.resolve(p); } };
    env.listeners.fetch(ev); return ev;
  };
  env.lifecycle = async function(type){ let p = null; env.listeners[type]({ waitUntil(x){ p = x; } }); await p; };
  env.shell = () => { const m = store.get('rsscout-shell-v2'); return m ? m.get(ORIGIN + '/') : undefined; };
  return env;
}

(async function(){
 try {
  console.log('\n--- 1. instalar / ativar ---');
  var e = makeEnv();
  await e.lifecycle('install');
  chk(e.skipped === true, 'install: skipWaiting (o SW novo nao espera fechar as abas)');
  chk(e.store.has('rsscout-shell-v2') && e.store.get('rsscout-shell-v2').size === 3, 'install: pre-cacheia o SDK do Firebase (3 arquivos) no cache v2');
  await e.lifecycle('activate');
  chk(e.claimed === true, 'activate: clients.claim');

  console.log('\n--- 2. navegacao do app: rede SEM cache HTTP ---');
  e.fetchCalls.length = 0;
  var ev = e.fetchEvent('/', { mode: 'navigate' });
  var res = await ev.responded;
  chk(!!ev.responded && e.fetchCalls.length === 1, 'navegacao e interceptada e vai pra rede');
  chk(e.fetchCalls[0].init && e.fetchCalls[0].init.cache === 'no-store' && e.fetchCalls[0].byRequest === false, 'busca com cache:"no-store" (o v1 fazia fetch(req), que passa pelo cache HTTP do navegador)');
  chk(res.ok && !!e.shell(), 'resposta boa e guardada como shell (pra abrir offline)');
  e.fetchCalls.length = 0;
  ev = e.fetchEvent('/?torneio=taca', { mode: 'navigate' }); await ev.responded;
  chk(/\?torneio=taca$/.test(e.fetchCalls[0].url) && e.fetchCalls[0].init.cache === 'no-store' && /torneio=taca/.test(e.shell().url), 'link com ?torneio=: busca a URL completa sem cache e atualiza o MESMO shell');
  ev = e.fetchEvent('/index.html', { mode: 'navigate' }); await ev.responded;
  chk(/index\.html$/.test(e.shell().url), '/index.html tambem e o shell');
  var shellBefore = e.shell().url;
  ev = e.fetchEvent('/manual/', { mode: 'navigate' }); res = await ev.responded;
  chk(res.ok && e.shell().url === shellBefore, 'outra pagina do site (manual) NAO sobrescreve o shell do app (o v1 sobrescrevia)');

  console.log('\n--- 3. offline / rede travada ---');
  e.offline = true;
  ev = e.fetchEvent('/', { mode: 'navigate' }); res = await ev.responded;
  chk(res && res.url === shellBefore, 'offline: abre o ultimo index.html bom');
  ev = e.fetchEvent('/manual/', { mode: 'navigate' }); res = await ev.responded;
  chk(res && res.type === 'error', 'offline em pagina que nao e o app: erro de rede normal (nao serve o app no lugar)');
  e.offline = false; e.hang = true; e.fast = true;
  ev = e.fetchEvent('/', { mode: 'navigate' }); res = await ev.responded;
  chk(res && res.url === shellBefore, 'rede travada (sem resposta): depois do tempo limite cai no shell guardado');
  e.hang = false; e.fast = false;
  var e2 = makeEnv(); e2.offline = true;
  ev = e2.fetchEvent('/', { mode: 'navigate' }); res = await ev.responded;
  chk(res && res.type === 'error', 'offline na 1a visita (sem shell guardado): erro de rede');
  e.nextRes = url => e.mkRes(url, { redirected: true });
  e.fetchCalls.length = 0;
  ev = e.fetchEvent('/', { mode: 'navigate' }); await ev.responded;
  chk(e.fetchCalls.length === 2 && e.fetchCalls[1].byRequest === true, 'resposta redirecionada: refaz com a requisicao original (o navegador segue o redirect)');
  e.nextRes = null;

  console.log('\n--- 4. o que NAO pode ser interceptado ---');
  chk(e.fetchEvent('/index.html?vchk=1', { mode: 'same-origin' }).responded === null, 'checagem de versao (index.html?vchk=1): passa direto pra rede');
  chk(e.fetchEvent('/sw.js').responded === null && e.fetchEvent('/cores-core.js').responded === null, 'js/json/html do mesmo host (fora de navegacao): passam direto — o v1 guardava cache-first PRA SEMPRE');
  chk(e.fetchEvent('https://scola-volei-default-rtdb.firebaseio.com/.lp?x=1').responded === null, 'Realtime Database: nunca interceptado');
  chk(e.fetchEvent('https://identitytoolkit.googleapis.com/v1/accounts:lookup').responded === null && e.fetchEvent('https://securetoken.googleapis.com/v1/token').responded === null, 'Auth (login / renovacao do token): nunca interceptado');
  chk(e.fetchEvent('/', { mode: 'navigate', method: 'POST' }).responded === null, 'POST: passa direto');

  console.log('\n--- 5. estaticos ---');
  e.fetchCalls.length = 0;
  ev = e.fetchEvent('/icon-192.png'); res = await ev.responded; await sleep(5);
  chk(!!ev.responded && res.ok && e.store.get('rsscout-shell-v2').has(ORIGIN + '/icon-192.png'), 'icone do mesmo host: interceptado e guardado');
  e.fetchCalls.length = 0;
  ev = e.fetchEvent('/icon-192.png'); res = await ev.responded; await sleep(5);
  chk(res.cloned === true && e.fetchCalls.length === 1, 'na 2a vez devolve do cache e atualiza em 2o plano');
  e.fetchCalls.length = 0;
  ev = e.fetchEvent('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js'); res = await ev.responded;
  chk(res.precached === true && e.fetchCalls.length === 0, 'SDK do Firebase: cache-first (abre offline)');

  console.log('\n--- 6. troca de versao do SW: pagina antiga e recarregada, pagina nova so e avisada ---');
  var e3 = makeEnv();
  e3.store.set('rsscout-shell-v1', new Map([[ORIGIN + '/', e3.mkRes('/', { old: true })]]));
  var mkClient = function(replies){ var c = { url: ORIGIN + '/?app=1', msgs: [], navigated: [], postMessage(m, ports){ c.msgs.push(m.type); if (m.type === 'rs-build?' && replies) ports[0].postMessage({ build: '2026-11-14a' }); }, navigate: async u => { c.navigated.push(u); } }; return c; };
  var novo = mkClient(true), velho = mkClient(false);
  e3.clients = [novo, velho]; e3.fast = true;
  await e3.lifecycle('activate');
  chk(!e3.store.has('rsscout-shell-v1') && e3.claimed, 'activate: apaga o cache v1 e assume as paginas');
  chk(novo.navigated.length === 0 && novo.msgs.join() === 'rs-build?,rs-sw-new', 'pagina NOVA (responde o build): nao e recarregada, so avisada pra conferir a versao');
  chk(velho.navigated.length === 1 && velho.navigated[0] === ORIGIN + '/?app=1', 'pagina ANTIGA (nao responde): recarregada uma vez — agora pela rede sem cache');
  var e4 = makeEnv(); var c4 = mkClient(false); e4.clients = [c4];
  await e4.lifecycle('activate');
  chk(c4.navigated.length === 0 && c4.msgs.length === 0, '1a instalacao (sem SW anterior): ninguem e recarregado');

  console.log('\n=== test_sw: ' + ok + ' OK, ' + ko + ' FAIL ===');
  process.exit(ko > 0 ? 1 : 0);
 } catch (err) { console.log('FAIL exception: ' + err.message); console.log((err.stack || '').split('\n').slice(0, 8).join('\n')); process.exit(1); }
})();
