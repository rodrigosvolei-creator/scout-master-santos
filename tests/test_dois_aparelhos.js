// DOIS APARELHOS NO MESMO JOGO — build 2026-11-14a.
// O que os jogos reais mostraram (14/11/2026, 2 celulares dividindo os fundamentos) e o que este teste trava:
//  1. aparelho com ESTADO VELHO (aba suspensa / conexao zumbi) nao apaga o jogo do colega ao tocar "Iniciar",
//     ao abrir o jogo pela lista ou ao abrir o proximo set (antes: ss inteiro / act:null gravados por cima);
//  2. "Proximo set" nos 2 aparelhos nao cria set fantasma; quem estava no ultimo set acompanha o set novo;
//  3. save() grava POR DIFERENCA: so o que este aparelho mudou (antes: os 4 nos inteiros da copia local);
//  4. escalacao automatica do card grava so a lineup do jogo e so se o servidor nao tiver uma;
//  5. PONTO DUPLICADO: ponto que chegou de outro aparelho segura por 6 s o ponto deste;
//  6. TOQUE SEGURO: redesenho por dado nao troca o DOM com o dedo na tela (click perdido no iPhone/iPad);
//  7. CONEXAO: estado real, fila de envio, reconexao forcada (voltar do 2o plano, gravacao parada);
//  8. VERSAO: checagem do build do servidor, faixa dentro do jogo, atualizacao sozinha fora dele, versoes
//     misturadas no mesmo jogo, e volta pro mesmo jogo/set depois de atualizar.
// Mock do Firebase compartilhado entre os "aparelhos": update() multi-caminho de verdade (null apaga,
// increment soma), snapshot IMUTAVEL (como o DataSnapshot do SDK), transacao, .info/connected controlavel e
// "suspender" um aparelho: ele continua GRAVANDO (e ve as proprias gravacoes, como no SDK), mas com a
// visao velha do que os OUTROS fizeram; transacao feita assim fica pendente e e re-executada ao voltar.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');

const fakeDB = {};       // o SERVIDOR
const L = [];            // listeners: {path, cb, dev}
const suspended = {};    // dev -> true
const view = {};         // dev -> copia PRIVADA do banco enquanto suspenso (cache local do SDK + as proprias gravacoes)
const pendTx = {};       // dev -> transacoes feitas com estado velho (re-executadas contra o servidor ao voltar)
const writes = [];       // gravacoes que chegaram ao SERVIDOR: {dev, op, path, keys}
const net = {};          // dev -> {off, on}  (goOffline/goOnline chamados)
function clone(v){ return v === undefined ? null : JSON.parse(JSON.stringify(v)); }
function getIn(root, p){ const a = p.split('/'); let c = root; for (const k of a) { if (c == null) return null; c = c[k]; } return c === undefined ? null : c; }
// como o Firebase: no criado por caminho com chave numerica e devolvido como vetor
function setIn(root, p, v){
  const a = p.split('/'); let c = root;
  for (let i = 0; i < a.length - 1; i++) {
    if (c[a[i]] == null || typeof c[a[i]] !== 'object') c[a[i]] = (/^[0-9]+$/.test(a[i + 1]) ? [] : {});
    else if (Array.isArray(c[a[i]]) && !/^[0-9]+$/.test(a[i + 1])) c[a[i]] = Object.assign({}, c[a[i]]);
    c = c[a[i]];
  }
  c[a[a.length - 1]] = clone(v);
}
function delIn(root, p){
  const a = p.split('/'); let c = root;
  for (let i = 0; i < a.length - 1; i++) { if (c == null) return; c = c[a[i]]; }
  if (!c) return; const k = a[a.length - 1];
  if (Array.isArray(c) && /^[0-9]+$/.test(k)) { const i = +k; if (i === c.length - 1) { c.length = i; while (c.length && c[c.length - 1] == null) c.length--; } else if (i < c.length) c[i] = null; }
  else delete c[k];
}
function updIn(root, base, obj){
  const ks = Object.keys(obj);
  for (const x of ks) for (const y of ks) { if (x !== y && y.indexOf(x + '/') === 0) throw new Error('update() com caminho ancestral: ' + x + ' > ' + y); }
  for (const k of ks) {
    const p = base + '/' + k, v = obj[k];
    if (v === null) delIn(root, p);
    else if (v && typeof v === 'object' && v['.sv'] && typeof v['.sv'].increment === 'number') { const cur = getIn(root, p); setIn(root, p, (typeof cur === 'number' ? cur : 0) + v['.sv'].increment); }
    else { if (JSON.stringify(v).indexOf('undefined') >= 0) throw new Error('undefined em ' + p); setIn(root, p, v); }
  }
}
const getAt = p => getIn(fakeDB, p);
const updAt = (base, obj) => updIn(fakeDB, base, obj);
// o que o aparelho "enxerga": o servidor, ou a copia privada dele enquanto esta suspenso
function rootOf(dev){ return view[dev] || fakeDB; }
function snapOf(p, dev){ const v = clone(getIn(rootOf(dev), p)); return { val: function(){ return clone(v); } }; } // imutavel, como o DataSnapshot
// Evento "value". Como no SDK: quem GRAVOU sempre recebe o eco da propria gravacao (mesmo sem conexao);
// os outros aparelhos so recebem se nao estiverem suspensos.
function fire(wp, writer){
  L.forEach(function(x){
    if (x.path.charAt(0) === '.') return;
    if (wp === x.path || wp.indexOf(x.path + '/') === 0 || x.path.indexOf(wp + '/') === 0) {
      if (suspended[x.dev] && x.dev !== writer) return;
      x.cb(snapOf(x.path, x.dev));
    }
  });
}
// aplica a gravacao no servidor e, se quem gravou esta suspenso, tambem na copia privada dele
function write(dev, p, fn){ fn(fakeDB); if (view[dev]) fn(view[dev]); fire(p, dev); }
function suspend(dev){ suspended[dev] = true; view[dev] = clone(fakeDB); pendTx[dev] = []; }
function resume(dev){
  delete suspended[dev]; delete view[dev];
  // transacoes feitas com estado velho: o servidor re-executa contra o valor REAL (pode abortar)
  (pendTx[dev] || []).forEach(function(t){ const r = t.fn(clone(getAt(t.p))); if (r !== undefined) { writes.push({ dev: dev, op: 'tx', path: t.p }); setIn(fakeDB, t.p, r); fire(t.p, dev); } });
  delete pendTx[dev];
  L.filter(x => x.dev === dev && x.path.charAt(0) !== '.').forEach(x => x.cb(snapOf(x.path, dev)));
}
function setConn(dev, v){ L.filter(x => x.dev === dev && x.path === '.info/connected').forEach(x => x.cb({ val: () => v })); }
function makeRef(p, dev){ return {
  _path: p,
  on: function(e, cb){ L.push({ path: p, cb: cb, dev: dev }); if (p.charAt(0) !== '.') cb(snapOf(p, dev)); },
  once: function(){ return Promise.resolve(snapOf(p, dev)); },   // como o SDK: com listener ativo responde do cache local
  set: function(v){ writes.push({ dev: dev, op: 'set', path: p }); write(dev, p, r => setIn(r, p, v)); return Promise.resolve(); },
  update: function(o){ writes.push({ dev: dev, op: 'update', path: p, keys: Object.keys(o) }); write(dev, p, r => updIn(r, p, o)); return Promise.resolve(); },
  remove: function(){ writes.push({ dev: dev, op: 'remove', path: p }); write(dev, p, r => delIn(r, p)); return Promise.resolve(); },
  // transacao: em dia, roda contra o servidor. Suspenso (estado velho): aplica so na copia local (otimista,
  // como o SDK) e fica pendente; ao voltar, e re-executada contra o valor real do servidor.
  transaction: function(fn){
    if (view[dev]) {
      const rl = fn(clone(getIn(view[dev], p)));
      if (rl === undefined) return Promise.resolve({ committed: false });
      setIn(view[dev], p, rl); pendTx[dev].push({ p: p, fn: fn }); fire(p, dev);
      return new Promise(function(){});   // so confirma quando o aparelho voltar
    }
    const r = fn(clone(getAt(p)));
    if (r === undefined) return Promise.resolve({ committed: false });
    writes.push({ dev: dev, op: 'tx', path: p }); setIn(fakeDB, p, r); fire(p, dev);
    return Promise.resolve({ committed: true });
  }
}; }
function makeMock(dev){
  net[dev] = { off: 0, on: 0 };
  const dbo = { ref: function(p){ return makeRef(p, dev); }, goOffline: function(){ net[dev].off++; }, goOnline: function(){ net[dev].on++; } };
  const database = function(){ return dbo; };
  database.ServerValue = { increment: function(n){ return { '.sv': { 'increment': n } }; } };
  return { initializeApp: function(){}, database: database,
    auth: function(){ return { onAuthStateChanged: function(cb){ setTimeout(function(){ cb({ uid: 'u_' + dev, email: 'rodrigosvolei@gmail.com', displayName: 'Mesa ' + dev }); }, 0); }, signInWithPopup: function(){ return Promise.resolve(); }, signOut: function(){ return Promise.resolve(); } }; } };
}

const LU = [1, 2, 3, 4, 5, 6, 7].map(i => ({ aid: 'a' + i, nu: i }));
const seed = { 'torneio-master-santos': {
  teams: [{ id: 'trs', n: 'RS MASC 35', c: '#2563eb', roster: [1, 2, 3, 4, 5, 6, 7].map(i => ({ aid: 'a' + i })) }],
  athletes: [1, 2, 3, 4, 5, 6, 7].map(function(i){ return { aid: 'a' + i, nm: 'Atleta ' + i, po: (i === 7 ? 'Libero' : 'Ponta'), nu: i }; }),
  tournaments: [{ id: 'tRS', n: 'Liga', layout: 'gameday' }],
  games: [
    { id: 'g1', torId: 'tRS', tid: 'trs', opp: 'MG Volei', st: 'pending', format: 'bo5', lineup: LU },
    { id: 'g2', torId: 'tRS', tid: 'trs', opp: 'Sem Escalacao', st: 'pending', format: 'bo5' },           // sem lineup: escalacao automatica do card
    { id: 'g3', torId: 'tRS', tid: 'trs', opp: 'Pela Lista', st: 'pending', format: 'bo5', lineup: LU },
    { id: 'g4', torId: 'tRS', tid: 'trs', opp: 'Fluminense', st: 'pending', format: 'bo5', lineup: LU }
  ],
  invites: {} } };
Object.assign(fakeDB, clone(seed));

const htmlMod = html
  .replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>/g, '')
  .replace('firebase.initializeApp(fc);', 'var firebase=window.__mock; firebase.initializeApp(fc);');
function makeLS(){ var m = {}; return { getItem: function(k){ return k in m ? m[k] : null; }, setItem: function(k, v){ m[k] = String(v); }, removeItem: function(k){ delete m[k]; }, clear: function(){ m = {}; } }; }
function boot(dev, pre){
  return new JSDOM(htmlMod, { url: 'https://master.exemplo.com.br/?app=1', runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(window){
      window.__mock = makeMock(dev);
      var ls = makeLS(); ls.setItem('rs_trn_dev', 'dev_' + dev);
      try { Object.defineProperty(window, 'localStorage', { value: ls, configurable: true }); } catch (e) {}
      window.AudioContext = function(){ return { createOscillator: function(){ return { connect: function(){}, frequency: {}, start: function(){}, stop: function(){} }; }, createGain: function(){ return { connect: function(){}, gain: {} }; }, destination: {}, currentTime: 0 }; };
      window.navigator.vibrate = function(){};
      window.alert = function(){};
      if (pre) pre(window);
    } });
}
function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
let ok = 0, ko = 0; function chk(c, m){ if (c) { ok++; console.log('OK   ' + m); } else { ko++; console.log('FAIL ' + m); } }
const GP = 'torneio-master-santos/games/';
const G = i => getAt(GP + i);
const nAct = g => (g && g.act) ? Object.keys(g.act).length : 0;
const nSq = (g, i) => (g && g.ss && g.ss[i] && g.ss[i].sq) ? Object.keys(g.ss[i].sq).length : 0;
const nSets = g => (g && g.ss) ? (Array.isArray(g.ss) ? g.ss.length : Object.keys(g.ss).length) : 0;
const since = (n, dev) => writes.slice(n).filter(x => !dev || x.dev === dev);
const toastOf = w => { const t = w.document.getElementById('rsToast'); return t ? t.textContent : ''; };
function mark(w, pid, ak, oc){ w.S.sp = pid; w.S.sa = ak; w.rcO(oc); }
// rallies DIFERENTES: passou o tempo entre um ponto e outro (zera a janela da trava nos 2 aparelhos)
function rally(){ for (const w of ALL) w._pt.at = 0; }
let ALL = [];

(async function(){
 try {
  const A = boot('A'); await sleep(150);
  const B = boot('B'); await sleep(150);
  const wa = A.window, wb = B.window; ALL = [wa, wb];
  wa.currentUser = { uid: 'uA', email: 'rodrigosvolei@gmail.com' };
  wb.currentUser = { uid: 'uB', email: 'rodrigosvolei@gmail.com' };

  console.log('\n--- 1. aparelho com ESTADO VELHO toca "Iniciar": nao zera o jogo que o colega ja esta marcando ---');
  wa.openGameDayCard('g1'); wb.openGameDayCard('g1');
  suspend('B');                                   // B para de receber (aba suspensa / conexao zumbi)
  wa.startG();
  mark(wa, 'a1', 'ataque', 'Ponto');              // 1-0
  mark(wa, 'a2', 'saque', 'Ace');                 // 2-0
  mark(wa, 'a3', 'recepcao', 'Erro');             // 2-1
  chk(wb.gF('g1').st === 'pending' && !(wb.gF('g1').act || []).length, 'B (suspenso) ainda ve o jogo PENDENTE, 0-0, sem acoes');
  var w0 = writes.length;
  wb.startG();                                    // B toca "Iniciar" com a visao velha
  chk(G(0).st === 'live' && G(0).ss[0].u === 2 && G(0).ss[0].t === 1, 'banco: placar continua 2-1 (antes: o "Iniciar" do B regravava ss = 0-0)');
  chk(nSq(G(0), 0) === 3 && nAct(G(0)) === 3, 'banco: sequencia de pontos (3) e acoes (3) do A intactas');
  chk(since(w0, 'B').every(x => x.op === 'update' && x.keys.every(k => k === 'st' || /^ss\/[0-9]+\/[ut]$/.test(k))), 'startG do B gravou so st + contadores por increment (nenhum "ss" inteiro) — ' + JSON.stringify(since(w0, 'B').map(x => x.keys)));
  mark(wb, 'a4', 'ataque', 'Ponto');              // B marca com a visao velha
  chk(G(0).ss[0].u === 3 && G(0).ss[0].t === 1 && nAct(G(0)) === 4 && nSq(G(0), 0) === 4, 'B marcou com estado velho: 3-1, 4 acoes, 4 pontos na sequencia (soma, nao sobrescreve)');
  resume('B');
  chk(wb.gF('g1').ss[0].u === 3 && wb.gF('g1').act.length === 4 && wb.gF('g1').st === 'live', 'B voltou: ve 3-1, as 4 acoes, jogo ao vivo');

  console.log('\n--- 2. abrir jogo PENDENTE pela lista (openG) com estado velho nao apaga as acoes do colega ---');
  suspend('B');
  wa.openGameDayCard('g3'); wa.startG();
  mark(wa, 'a1', 'ataque', 'Ponto'); mark(wa, 'a2', 'ataque', 'Erro');
  w0 = writes.length;
  wb.openG('g3');                                 // B ve "pendente" e abre pela lista
  chk(since(w0, 'B').length === 0, 'openG do B (pendente, sem nada local pra limpar) nao gravou nada — antes gravava act:null + ss inteiro');
  chk(nAct(G(2)) === 2 && G(2).ss[0].u === 1 && G(2).ss[0].t === 1 && G(2).st === 'live', 'banco: g3 intacto (2 acoes, 1-1, ao vivo)');
  resume('B');
  wa.openGameDayCard('g1'); wb.openGameDayCard('g1');

  console.log('\n--- 3. PROXIMO SET com 2 aparelhos: sem set fantasma, sem zerar o set do colega ---');
  for (var i = 0; i < 22; i++) wa.scUp('u');      // set 1 -> 25-1
  await sleep(40);                                // modal "set encerrado" abre sozinho nos 2
  var ma = wa.document.getElementById('rsConfirm'), mb = wb.document.getElementById('rsConfirm');
  chk(!!ma && !!mb && /ENCERRADO/.test(mb.textContent) && mb.getAttribute('data-kind') === 'setclose', 'set 1 fechou 25-1: modal "SET 1 ENCERRADO — iniciar o set 2?" nos 2 aparelhos');
  suspend('B');                                   // B fica com o modal velho na tela
  wa.document.getElementById('rsConfirmOk').onclick();   // A inicia o set 2
  wa.scUp('u'); wa.scUp('u');                     // e ja faz 2-0 no set 2
  chk(nSets(G(0)) === 2 && G(0).ss[1].u === 2 && nSq(G(0), 1) === 2, 'A abriu o set 2 e fez 2-0');
  wb.document.getElementById('rsConfirmOk').onclick();   // B confirma o modal VELHO ("iniciar o set 2")
  chk(nSets(G(0)) === 2, 'banco: continua com 2 sets (antes: o B criava o set 3 — set fantasma)');
  chk(G(0).ss[1].u === 2 && G(0).ss[1].t === 0 && nSq(G(0), 1) === 2, 'banco: set 2 continua 2-0 com a sequencia (antes: ss/1 = {u:0,t:0} gravado por cima)');
  chk(wb.S.cs === 2, 'B esta no set 2');
  resume('B');
  chk(wb.gF('g1').ss.length === 2 && wb.gF('g1').ss[1].u === 2 && wb.S.cs === 2, 'B voltou: 2 sets, set 2 em 2-0, marcando no set 2');
  // aparelho atrasado (ficou num set anterior) toca "Proximo set": so avanca
  wb.S.cs = 1; w0 = writes.length;
  wb.nxS();
  chk(wb.S.cs === 2 && nSets(G(0)) === 2 && since(w0, 'B').length === 0, '"Proximo set" com o set seguinte ja aberto: so avanca pro set 2, sem gravar nem criar set');
  // os 2 em dia: A abre o set 3 -> B acompanha sozinho e o modal velho dele some
  for (i = 0; i < 23; i++) wa.scUp('u');          // set 2 -> 25-0
  await sleep(40);
  chk(!!wb.document.getElementById('rsConfirm') && wb.S.cs === 2, 'set 2 fechou: B tambem esta com o modal aberto, no set 2');
  wa.document.getElementById('rsConfirmOk').onclick();   // A inicia o set 3
  chk(nSets(G(0)) === 3 && wb.S.cs === 3, 'A abriu o set 3 -> B passou pro set 3 SOZINHO');
  chk(!wb.document.getElementById('rsConfirm'), 'o modal velho do B ("iniciar o set 3?") foi fechado');
  chk(/Set 3 aberto no outro aparelho/.test(toastOf(wb)), 'B avisa: "Set 3 aberto no outro aparelho"');
  wb.nxS();                                       // set 3 esta 0-0: a trava do set vazio continua valendo
  chk(nSets(G(0)) === 3 && wb.S.cs === 3, 'B toca "Proximo set" no set 3 ainda 0-0: nao abre set 4');
  // quem voltou de proposito num set anterior (remarcando) NAO e arrastado pro set novo
  mark(wa, 'a1', 'ataque', 'Ponto'); rally();
  wb.goSet(1);
  for (i = 0; i < 25; i++) wa.scUp('t');          // set 3 -> 1-25 (adversario vence: 2-1 em sets, partida segue)
  await sleep(40);
  wa.document.getElementById('rsConfirmOk').onclick();   // A abre o set 4
  chk(nSets(G(0)) === 4 && wa.S.cs === 4 && wb.S.cs === 1, 'B estava remarcando o set 1: continua no set 1 quando o A abre o set 4');
  wb.goSet(4);

  console.log('\n--- 4. escalacao AUTOMATICA do card: so a lineup do jogo, so se o servidor nao tiver ---');
  w0 = writes.length;
  suspend('B');
  wa.openGameDayCard('g2');                       // g2 nao tem escalacao: o card escala com o elenco do time
  var wA = since(w0, 'A');
  chk(wA.length === 1 && wA[0].op === 'tx' && wA[0].path === GP + '1/lineup', 'abrir o card gravou SO games/1/lineup (transacao) — antes: save() regravava os 4 nos — ' + JSON.stringify(wA.map(x => x.op + ' ' + x.path)));
  chk(Array.isArray(G(1).lineup) && G(1).lineup.length === 7, 'banco: g2 com a escalacao do elenco (7)');
  var gA = wa.gF('g2'); gA.lineup = gA.lineup.slice(0, 6).map(function(e, k){ return { aid: e.aid, nu: 40 + k }; });
  w0 = writes.length; wa.save();                  // A ajusta numeros e salva a escalacao
  wA = since(w0, 'A');
  chk(wA.length === 1 && wA[0].op === 'update' && wA[0].path === 'torneio-master-santos/games' && wA[0].keys.join() === '1/lineup', 'save() depois de mexer na escalacao gravou SO games/1/lineup — ' + JSON.stringify(wA.map(x => x.path + ' ' + (x.keys || ''))));
  w0 = writes.length;
  wb.openGameDayCard('g2');                       // B (visao velha: g2 sem escalacao) abre o mesmo card
  chk(since(w0, 'B').length === 0 && G(1).lineup.length === 6 && G(1).lineup[0].nu === 40, 'B com estado velho abre o card: nada chega ao servidor (a transacao fica pendente), a escalacao do A continua');
  chk((wb.gF('g2').lineup || []).length === 7, 'B, sem saber da escalacao do A, ve na tela a automatica (7) — so na copia local dele');

  console.log('\n--- 5. save() POR DIFERENCA: aparelho com estado velho nao regrava o que nao mudou ---');
  // (B continua suspenso, com o g2 aberto: ss "padrao" [0-0] so na memoria dele)
  wa.startG(); mark(wa, 'a1', 'ataque', 'Ponto'); mark(wa, 'a2', 'ataque', 'Ponto'); mark(wa, 'a3', 'saque', 'Ace');  // g2: 3-0
  w0 = writes.length;
  wb.D.athletes[1].nu = 77; wb.save();            // B edita um atleta com a visao velha do jogo
  var wB = since(w0, 'B');
  chk(wB.length === 1 && wB[0].path === 'torneio-master-santos/athletes' && wB[0].keys.join() === '1/nu', 'save() do B gravou SO athletes/1/nu — ' + JSON.stringify(wB.map(x => x.path + ' ' + (x.keys || ''))));
  chk(G(1).st === 'live' && G(1).ss[0].u === 3 && nAct(G(1)) === 3 && nSq(G(1), 0) === 3, 'banco: g2 do A intacto (ao vivo, 3-0, 3 acoes) — antes o save() do B regravava todos os jogos da copia velha');
  chk(getAt('torneio-master-santos/athletes/1').nu === 77, 'banco: o numero do atleta foi gravado');
  // B (ainda velho) troca a escalacao do g1 enquanto A marca nele
  wa.openGameDayCard('g1'); wa.S.cs = 4; mark(wa, 'a5', 'ataque', 'Ponto'); mark(wa, 'a6', 'bloqueio', 'Ponto');
  var actsG1 = nAct(G(0)), s4u = G(0).ss[3].u;
  var gB = wb.gF('g1'); gB.lineup = gB.lineup.map(function(e){ return { aid: e.aid, nu: e.nu + 10 }; });
  w0 = writes.length; wb.save();
  wB = since(w0, 'B');
  chk(wB.length === 1 && wB[0].keys.join() === '0/lineup', 'save() do B (escalacao do g1) gravou SO games/0/lineup — ' + JSON.stringify(wB.map(x => x.path + ' ' + (x.keys || ''))));
  chk(nAct(G(0)) === actsG1 && G(0).ss[3].u === s4u && G(0).lineup[0].nu === 11, 'banco: acoes e placar que o B nem tinha visto continuam la; a escalacao e a do B');
  resume('B');
  chk(G(1).lineup.length === 6 && G(1).lineup[0].nu === 40 && wb.gF('g2').lineup.length === 6, 'B voltou: a transacao da escalacao automatica ABORTA (o servidor ja tinha uma) e o B passa a ver a do A');
  // nada mudou -> nao grava nada
  w0 = writes.length; wa.save(); wb.save();
  chk(since(w0).length === 0, 'save() sem mudanca nao grava NADA (antes: subia os 4 nos inteiros a cada save)');
  // jogo novo: so o jogo novo; acao e base da quadra vao inteiras; set desce por campo
  wa.D.games.push({ id: 'gNovo', torId: 'tRS', tid: 'trs', opp: 'Novo', st: 'pending', dt: '2026-11-20' });
  w0 = writes.length; wa.save();
  chk(since(w0, 'A').length === 1 && since(w0, 'A')[0].keys.join() === '4' && G(4).id === 'gNovo' && nSets(G(0)) === 4, 'jogo novo: grava so games/4; os outros jogos nao sao tocados');
  var up = {}; wa._diffInto(up, '0', { id: 'x', ss: [{ u: 1, t: 0, sq: { p1: 'u' } }], act: { a1: { pid: 'p', oc: 'A' } }, lineup: [{ aid: 'a' }] },
                                     { id: 'x', ss: [{ u: 2, t: 0, sq: { p1: 'u', p2: 'u' } }], act: { a1: { pid: 'q', oc: 'A' } }, lineup: [{ aid: 'a' }, { aid: 'b' }] }, wa._gmAtom);
  chk(Object.keys(up).sort().join() === '0/act/a1,0/lineup,0/ss/0/sq/p2,0/ss/0/u', '_diffInto: placar e sequencia por campo; acao e escalacao inteiras — ' + Object.keys(up).sort().join());
  chk(wa._deq({ a: 1, b: [], c: null }, { a: 1 }) && !wa._deq({ a: 0 }, {}) && wa._deq([{ x: 1 }], { 0: { x: 1 } }), '_deq: vazio == ausente, 0 nao e vazio, vetor == objeto de chaves numericas');
  var nz = wa._gmNormalize({ id: 'z', ss: { 0: { u: 3, t: 1 }, 1: { u: 0, t: 0 } } });
  chk(Array.isArray(nz.ss) && nz.ss.length === 2 && nz.ss[0].u === 3, '_gmNormalize: ss que chega como objeto de chaves numericas vira vetor');

  console.log('\n--- 6. PONTO DUPLICADO entre aparelhos (o mesmo rally marcado nos 2) ---');
  wa.openGameDayCard('g4'); wa.startG(); wb.openGameDayCard('g4');
  chk(wa.S.cs === 1 && wb.S.cs === 1 && wb.gF('g4').st === 'live', 'os 2 no g4, ao vivo, set 1');
  mark(wa, 'a1', 'ataque', 'Ponto');              // A: ponto do rally (1-0)
  mark(wb, 'a2', 'bloqueio', 'Ponto');            // B, em seguida, marca OUTRA acao de ponto pro mesmo rally
  chk(G(3).ss[0].u === 1 && nSq(G(3), 0) === 1, 'banco: placar continua 1-0 (antes: 2-0 e alguem corrigia no "-")');
  chk(nAct(G(3)) === 2, 'a acao do B foi gravada (a estatistica fica), so o ponto nao somou de novo');
  chk(/SEM somar ponto/.test(toastOf(wb)) && /Ataque/.test(toastOf(wb)), 'B avisa o que o outro aparelho ja marcou: "' + toastOf(wb) + '"');
  chk(wb.S.us[wb.S.us.length - 1].sc === null, 'desfazer do B tira so a acao (nao desconta ponto que ele nao somou)');
  mark(wb, 'a1', 'ataque', 'Ponto');              // B marca a MESMA acao que o A acabou de marcar
  chk(nAct(G(3)) === 2 && G(3).ss[0].u === 1, 'a MESMA acao (atleta+fundamento+resultado) vinda do outro aparelho nao e gravada 2x');
  wb.scUp('u');
  chk(G(3).ss[0].u === 2, 'o aviso mandou usar o "+" se for outro ponto: esse "+" entra direto, 1 toque so (2-0)');
  wa.scUp('u');                                   // no A: o ponto do B acabou de chegar, sem aviso anterior
  chk(G(3).ss[0].u === 2 && /Toque de novo/.test(toastOf(wa)), '"+" logo depois do ponto do colega: 1o toque so avisa');
  wa.scUp('u');
  chk(G(3).ss[0].u === 3, '2o toque confirma: e outro ponto mesmo (3-0)');
  wb.scErrAdv();                                  // no B: o ponto do A acabou de chegar
  chk(G(3).ss[0].u === 3 && nAct(G(3)) === 2, '"erro do adversario" no B logo depois do ponto do A: segura (nem ponto, nem acao)');
  wb._pt.at -= 7000;                              // passaram 7 s: e outro rally
  wb.scErrAdv();
  chk(G(3).ss[0].u === 4 && nAct(G(3)) === 3, 'passados 6 s, marca normal (4-0)');
  rally();
  wa.scUp('t'); wa.scUp('t');                     // pontos seguidos do PROPRIO aparelho nao sao segurados
  chk(G(3).ss[0].t === 2, 'dois "+" seguidos no mesmo aparelho contam os dois (acerto de placar continua livre)');
  wb.scDn('t'); wb.scUp('t');                     // o "-" (correcao) limpa a janela
  chk(G(3).ss[0].t === 2, '"-" seguido de "+" no B: o "-" e correcao, o "+" entra direto');
  rally();
  mark(wa, 'a3', 'recepcao', 'A'); mark(wb, 'a4', 'levantamento', 'A');
  chk(nAct(G(3)) === 5, 'acoes que nao valem ponto nunca sao seguradas (os 2 marcam o mesmo rally a vontade)');

  console.log('\n--- 7. TOQUE SEGURO: dado que chega do outro aparelho nao troca a tela com o dedo em cima ---');
  wa.render();
  var btn = wa.document.querySelector('#mainApp [onclick]');
  chk(!!btn && btn.isConnected, 'A esta na mesa do jogo (ha botoes na tela)');
  wa.document.dispatchEvent(new wa.Event('touchstart', { bubbles: true }));   // dedo encostou
  var actsA = wa.gF('g4').act.length;
  rally(); mark(wb, 'a5', 'defesa', 'A');         // o colega marca no meio do toque
  chk(wa.gF('g4').act.length === actsA + 1, 'o dado do colega chegou no A (estado atualizado)');
  chk(btn.isConnected, 'mas a tela NAO foi redesenhada com o dedo em cima: o botao tocado e o mesmo elemento');
  wa.document.dispatchEvent(new wa.Event('touchend', { bubbles: true }));
  chk(btn.isConnected, 'dedo saiu: ainda espera o click chegar');
  wa.document.dispatchEvent(new wa.Event('click', { bubbles: true }));        // click entregue
  await sleep(140);
  chk(!btn.isConnected, 'depois do click, a tela e redesenhada com o dado novo');
  wa.document.dispatchEvent(new wa.Event('touchstart', { bubbles: true }));
  wa.render();                                    // redesenho pedido pelo PROPRIO toque e imediato
  chk(!!wa.document.querySelector('#mainApp [onclick]'), 'render() direto (acao do proprio operador) nao e adiado');
  wa.document.dispatchEvent(new wa.Event('touchcancel', { bubbles: true }));

  console.log('\n--- 8. CONEXAO: estado real, fila de envio, reconexao forcada ---');
  setConn('A', true); wa.render();
  var chip = wa.document.querySelector('.net-chip');
  chk(wa._netState().k === 'ok' && chip && /online/.test(chip.textContent) && /ok/.test(chip.className), 'conectado: selo "online" na mesa');
  setConn('A', false);
  chip = wa.document.querySelector('.net-chip');
  chk(wa._netState().k === 'off' && /sem conex/.test(chip.textContent) && /off/.test(chip.className), 'caiu: o selo vira "sem conexao" na hora, sem redesenhar a tela');
  var bar = wa.document.getElementById('netBar');
  chk(!bar || bar.className === '', 'a faixa de aviso NAO aparece antes de 3 s (reconexao rapida nao assusta)');
  var never = new Promise(function(){});
  wa._netTrack(never);                            // uma gravacao que o servidor ainda nao confirmou
  wa._net.chg -= 4000; wa._netPaint();
  bar = wa.document.getElementById('netBar');
  chk(wa._netPendN() === 1 && bar && bar.className === 'off' && /SEM CONEX/.test(bar.textContent) && /1 marca/.test(bar.textContent) && /N.o feche o app/.test(bar.textContent), 'sem conexao ha 3 s+: faixa "SEM CONEXAO — 1 marcacao guardada neste aparelho. Nao feche o app"');
  setConn('A', true);
  for (var k in wa._net.pend) wa._net.pend[k] -= 3000;
  wa._netPaint();
  chk(wa._netState().k === 'wait' && wa.document.getElementById('netBar').className === 'wait' && /Enviando 1/.test(wa.document.getElementById('netBar').textContent), 'conectado mas a gravacao nao confirma: faixa "Enviando 1 marcacao... conexao lenta"');
  var o0 = net.A.off;
  wa._net.force = 0; chk(wa._netReconnect('t') === true && net.A.off === o0 + 1 && net.A.on === net.A.off, '_netReconnect: goOffline + goOnline');
  chk(wa._netReconnect('t') === false && net.A.off === o0 + 1, 'no maximo 1 reconexao forcada a cada 5 s');
  wa._net.force = 0; wa._net.hid = Date.now() - 1000; wa._netResume('visible');
  chk(net.A.off === o0 + 1, 'voltou do 2o plano em menos de 4 s, conectado: nao reconecta');
  wa._net.force = 0; wa._net.hid = Date.now() - 6000; wa._netResume('visible');
  chk(net.A.off === o0 + 2, 'voltou do 2o plano depois de 4 s+: reconecta (o listener rele do servidor)');
  wa._net.force = 0; wa._netResume('online');
  chk(net.A.off === o0 + 3, 'rede voltou (evento online): reconecta');
  wa._net.force = 0; wa._net.chg -= 30000; for (k in wa._net.pend) wa._net.pend[k] -= 9000;
  wa._netTick();
  chk(net.A.off === o0 + 4, 'gravacao parada ha mais de 10 s com a conexao "de pe" (zumbi): reconecta sozinho');
  for (k in wa._net.pend) delete wa._net.pend[k];
  wa._netPaint();
  chk(wa._netState().k === 'ok' && wa.document.getElementById('netBar').className === '', 'fila vazia e conectado: faixa some, selo volta pra "online"');

  console.log('\n--- 9. VERSAO: build do servidor, faixa no jogo, atualizacao sozinha fora dele, versoes misturadas ---');
  var meta = /<meta name="rs-build" content="([^"]+)">/.exec(html);
  chk(!!meta && meta[1] === wa.APP_BUILD_ID && /^20[0-9]{2}-[0-9]{2}-[0-9]{2}[a-z]$/.test(wa.APP_BUILD_ID), '<meta name="rs-build"> == APP_BUILD_ID (' + wa.APP_BUILD_ID + ')');
  chk(html.indexOf('<meta name="rs-build"') < 2000, 'o meta do build fica no comeco do arquivo (a checagem le so os primeiros 2 KB)');
  var fcalls = [], applied = 0, srvBuild = '2099-01-01a';
  wa.fetch = function(url, opt){ fcalls.push({ url: url, opt: opt }); return Promise.resolve({ ok: true, status: 206, text: function(){ return Promise.resolve('<!DOCTYPE html><head><meta name="rs-build" content="' + srvBuild + '"></head>'); } }); };
  wa._verApply = function(){ applied++; };
  wa._ver.at = 0; wa._verCheckNow(true); await sleep(20);
  chk(fcalls.length === 1 && /vchk=1/.test(fcalls[0].url) && fcalls[0].opt.cache === 'no-store' && /bytes=0-/.test(fcalls[0].opt.headers.Range), 'checagem: so o comeco do index.html, com cache:"no-store"');
  chk(wa._ver.need === srvBuild && applied === 0, 'build do servidor diferente DENTRO de um jogo: nao recarrega sozinho');
  var ub = wa.document.getElementById('updBar');
  chk(ub && /on/.test(ub.className) && /Nova vers/.test(ub.textContent) && /Atualizar agora/.test(ub.textContent), 'mostra a faixa "Nova versao do app disponivel — Atualizar agora"');
  wa.scoutBack(); wa.closeConfirmModal();
  wa._verOnOutdated();
  chk(applied === 1, 'fora do jogo (sem modal, sem fila): atualiza sozinho');
  wa._netTrack(never); wa._verOnOutdated();
  chk(applied === 1, 'com marcacao ainda nao confirmada pelo servidor: NAO recarrega (perderia a fila)');
  for (k in wa._net.pend) delete wa._net.pend[k];
  srvBuild = wa.APP_BUILD_ID; wa._ver.at = 0; wa._verCheckNow(true); await sleep(20);
  chk(wa._ver.need === null && !/on/.test(wa.document.getElementById('updBar').className), 'servidor no mesmo build: faixa some');
  // carimbo do build por aparelho no jogo + versoes misturadas
  var dv = G(3).devs || {};
  chk(dv.dev_A === wa.APP_BUILD_ID && dv.dev_B === wa.APP_BUILD_ID, 'cada aparelho carimba o build no jogo (games/{idx}/devs) junto com a 1a marcacao');
  wa.openGameDayCard('g4');
  chk(wa._ver.peer === null && wa._ver.peerOld === false, 'os 2 aparelhos no mesmo build: sem aviso');
  var oldAct = { id: 'a' + Date.now() + '_zzzzz', pid: 'a6', ak: 'defesa', oc: 'B', set: 1, dev: 'dev_VELHO' };   // aparelho que nao carimba = build antigo
  updAt(GP + '3', { ['act/' + oldAct.id]: oldAct }); fire(GP + '3');
  ub = wa.document.getElementById('updBar');
  chk(wa._ver.peerOld === true && /warn/.test(ub.className) && /ANTIGA/.test(ub.textContent), 'acao recente de aparelho sem carimbo: avisa "outro aparelho neste jogo esta numa versao ANTIGA"');
  updAt(GP + '3', { 'devs/dev_NOVO': '2099-12-31z' }); fire(GP + '3');
  ub = wa.document.getElementById('updBar');
  chk(wa._ver.peer === '2099-12-31z' && /mais nova/.test(ub.textContent) && /Atualizar este/.test(ub.textContent), 'outro aparelho com build MAIOR: avisa que ESTE esta desatualizado, com botao');

  console.log('\n--- 10. atualizar no meio do jogo devolve o operador ao mesmo jogo e set ---');
  wa.S.cs = 1; wa._sessKeep();
  var kept = JSON.parse(wa.sessionStorage.getItem('rs_resume') || 'null');
  chk(kept && kept.aid === 'g4' && kept.cs === 1 && Array.isArray(kept.us), '_sessKeep guarda jogo, set e a pilha do desfazer (sessionStorage)');
  const C = boot('C', function(win){ win.sessionStorage.setItem('rs_resume', JSON.stringify({ aid: 'g1', cs: 2, t: Date.now(), us: [{ manual: true, sc: 'u', set: 2 }] })); });
  await sleep(250);
  const wc = C.window;
  chk(wc.S.aid === 'g1' && wc.tab === 'scout' && wc.S.cs === 2 && wc.S.us.length === 1, 'depois de recarregar: de volta ao g1, no set 2, com o desfazer preservado');
  chk(wc.sessionStorage.getItem('rs_resume') === null, 'a retomada vale uma vez so (chave apagada)');
  const D2 = boot('D', function(win){ win.sessionStorage.setItem('rs_resume', JSON.stringify({ aid: 'g1', cs: 2, t: Date.now() - 10 * 60 * 1000, us: [] })); });
  await sleep(250);
  chk(D2.window.S.aid === null, 'retomada velha (mais de 2 min) e ignorada');

  console.log('\n=== test_dois_aparelhos: ' + ok + ' OK, ' + ko + ' FAIL ===');
  process.exit(ko > 0 ? 1 : 0);
 } catch (e) { console.log('FAIL exception: ' + e.message); console.log((e.stack || '').split('\n').slice(0, 8).join('\n')); process.exit(1); }
})();
