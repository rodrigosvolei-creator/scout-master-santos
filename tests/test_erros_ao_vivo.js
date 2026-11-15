// ERROS AO VIVO — resumo rapido na mesa (build 2026-11-14a).
// Pedido do Rodrigo: "preciso ver de forma rapida, durante a partida em andamento, quantos saques
// errados? quantos erros de ataque etc". Quadro fixo na tela de marcacao (classica e tablet) com os
// erros por fundamento no SET em que a mesa esta e no JOGO todo; tocar abre o detalhe por atleta.
const fs = require('fs'); const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');
const fakeDB = {}; const listeners = {};
function getAt(p){ const a = p.split('/'); let c = fakeDB; for (const k of a) { if (c == null) return null; c = c[k]; } return c === undefined ? null : c; }
function setAt(p, v){ const a = p.split('/'); let c = fakeDB; for (let i = 0; i < a.length - 1; i++) { if (c[a[i]] == null || typeof c[a[i]] !== 'object') c[a[i]] = {}; c = c[a[i]]; } c[a[a.length - 1]] = JSON.parse(JSON.stringify(v)); }
function makeRef(p){ return { _path: p, on: function(e, cb){ listeners[p] = cb; }, once: function(){ return Promise.resolve({ val: () => getAt(p) }); }, set: function(v){ setAt(p, v); return Promise.resolve(); }, update: function(){ return Promise.resolve(); } }; }
global.firebaseMock = { initializeApp: () => {}, database: () => ({ ref: makeRef }), auth: () => ({ onAuthStateChanged: function(cb){ setTimeout(() => cb({ uid: 'm', email: 'rodrigosvolei@gmail.com', displayName: 'M' }), 0); }, signInWithPopup: () => Promise.resolve(), signOut: () => Promise.resolve() }) };

let n = 0;
function act(set, pid, ak, oc){ return { id: 'a' + (1794700000000 + (n++)) + '_x', pid: pid, ak: ak, oc: oc, set: set }; }
// Set 1: saque 2 erros (a1, a2), ataque 1 erro + 1 bloqueado (a3), recepcao 1 erro (a4), 1 erro do adversario.
// Set 2: saque 1 erro (a1), ataque 2 erros (a3), bloqueio 1 erro (a2), defesa 1 erro (a4), levantamento 1 erro (a2), 2 erros do adversario.
const acts = [
  act(1, 'a1', 'saque', 'Erro'), act(1, 'a2', 'saque', 'Erro'), act(1, 'a1', 'saque', 'Ace'), act(1, 'a3', 'ataque', 'Erro'), act(1, 'a3', 'ataque', 'Bloq'),
  act(1, 'a3', 'ataque', 'Ponto'), act(1, 'a4', 'recepcao', 'Erro'), act(1, 'a4', 'recepcao', 'A'), { id: 'a1794700000900_x', pid: null, ak: 'erroadv', oc: 'Ponto', set: 1 },
  act(2, 'a1', 'saque', 'Erro'), act(2, 'a3', 'ataque', 'Erro'), act(2, 'a3', 'ataque', 'Erro'), act(2, 'a2', 'bloqueio', 'Erro'), act(2, 'a4', 'defesa', 'Erro'),
  act(2, 'a2', 'levantamento', 'Erro'), act(2, 'a2', 'levantamento', 'A'), { id: 'a1794700000901_x', pid: null, ak: 'erroadv', oc: 'Ponto', set: 2 }, { id: 'a1794700000902_x', pid: null, ak: 'erroadv', oc: 'Ponto', set: 2 }
];
const LU = [1, 2, 3, 4, 5, 6].map(i => ({ aid: 'a' + i, nu: i }));
const seed = { 'torneio-master-santos': {
  teams: [{ id: 'trs', n: 'RS', c: '#000', roster: [1, 2, 3, 4, 5, 6].map(i => ({ aid: 'a' + i })) }],
  athletes: [1, 2, 3, 4, 5, 6].map(i => ({ aid: 'a' + i, nm: ['Fabiano', 'Orelha', 'Igor', 'Jordan', 'Toy', 'Andre'][i - 1] + ' Silva', po: 'Ponteiro', nu: i })),
  tournaments: [{ id: 'tA', n: 'Liga' }],
  games: [
    { id: 'g1', tid: 'trs', torId: 'tA', opp: 'MG VOLEI', st: 'live', format: 'bo5', ss: [{ u: 25, t: 20 }, { u: 4, t: 6 }], act: acts, lineup: LU },
    { id: 'g2', tid: 'trs', torId: 'tA', opp: 'PENDENTE', st: 'pending', format: 'bo5', lineup: LU }
  ],
  invites: {} } };
Object.assign(fakeDB, JSON.parse(JSON.stringify(seed)));
const htmlMod = html.replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>/g, '').replace('firebase.initializeApp(fc);', 'var firebase=window.firebaseMock; firebase.initializeApp(fc);');
function boot(tablet){
  return new JSDOM(htmlMod, { url: 'https://master.exemplo.com.br/', runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(window){ window.firebaseMock = global.firebaseMock;
      var m = tablet ? { rs_scout_tablet: '1' } : {};
      try { Object.defineProperty(window, 'localStorage', { value: { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; }, clear: () => { m = {}; } }, configurable: true }); } catch (e) {}
      window.AudioContext = function(){ return { createOscillator: () => ({ connect: () => {}, frequency: {}, start: () => {}, stop: () => {} }), createGain: () => ({ connect: () => {}, gain: {} }), destination: {}, currentTime: 0 }; };
      window.navigator.vibrate = () => {}; window.alert = () => {}; } });
}
let ok = 0, ko = 0; function chk(c, m){ if (c) { ok++; console.log('OK   ' + m); } else { ko++; console.log('FAIL ' + m); } }
function load(w){ ['teams', 'games', 'tournaments', 'athletes', 'invites'].forEach(k => { var p = 'torneio-master-santos/' + k; if (listeners[p]) listeners[p]({ val: () => getAt(p) }); }); w.currentUser = { uid: 'm', email: 'rodrigosvolei@gmail.com' }; }
const cells = (el, row) => Array.from(el.querySelectorAll('tr')[row].children).map(x => x.textContent).join(' ');

const dom = boot(false); const w = dom.window;
setTimeout(() => {
 try {
  load(w);
  console.log('\n--- 1. errStats: erros por fundamento, no set e no jogo ---');
  var g = w.gF('g1'), s2 = w.errStats(g, 2), s1 = w.errStats(g, 1);
  chk(s2.set.byF.saque === 1 && s2.set.byF.ataque === 2 && s2.set.byF.bloqueio === 1 && s2.set.byF.defesa === 1 && s2.set.byF.levantamento === 1 && s2.set.byF.recepcao === 0 && s2.set.total === 6, 'set 2: saque 1, ataque 2, bloqueio 1, defesa 1, levantamento 1, recepcao 0 = 6');
  chk(s1.set.byF.saque === 2 && s1.set.byF.ataque === 1 && s1.set.byF.recepcao === 1 && s1.set.total === 4, 'set 1: saque 2, ataque 1, recepcao 1 = 4');
  chk(s2.game.byF.saque === 3 && s2.game.byF.ataque === 3 && s2.game.total === 10 && s1.game.total === 10, 'jogo todo: saque 3, ataque 3, total 10 (igual em qualquer set)');
  chk(s1.set.bloq === 1 && s2.set.bloq === 0 && s2.game.bloq === 1 && s2.game.byF.ataque === 3, 'ataque BLOQUEADO vai separado (1 no set 1) e nao entra nos erros de ataque');
  chk(s1.set.adv === 1 && s2.set.adv === 2 && s2.game.adv === 3, 'pontos em erro do adversario: 1 no set 1, 2 no set 2, 3 no jogo');
  chk(s2.players.a3.game.byF.ataque === 3 && s2.players.a3.set.byF.ataque === 2 && s2.players.a3.game.bloq === 1 && s2.players.a1.game.byF.saque === 2 && !s2.players.a5, 'por atleta: a3 errou 3 ataques (2 no set 2) e foi bloqueado 1x; a1 errou 2 saques; quem nao errou nao aparece');
  chk(w.errStats({ act: [] }, 1).set.total === 0 && w.errStats(null, 1).game.total === 0, 'jogo sem acoes / nulo: zeros, sem quebrar');

  console.log('\n--- 2. quadro na mesa CLASSICA ---');
  w.tab = 'scout'; w.S = { aid: 'g1', sp: null, sa: null, cs: 2, us: [], tm: 0, rn: false, ti: null };
  w.render();
  var el = w.document.querySelector('#mainApp .sc-errs');
  chk(!!el, 'o quadro de erros aparece na tela de marcacao do jogo ao vivo');
  chk(cells(el, 0) === 'Erros SAQ ATQ REC BLQ LEV DEF TOT ADV', 'colunas: SAQ ATQ REC BLQ LEV DEF TOT ADV');
  chk(cells(el, 1) === 'set 2 1 2 0 1 1 1 6 2', 'linha do set em que a mesa esta: ' + cells(el, 1));
  chk(cells(el, 2) === 'jogo 3 3 1 1 1 1 10 3', 'linha do jogo todo: ' + cells(el, 2));
  // build 2026-11-15a: "erro do adversario" e "ataque bloqueado" cada um na SUA linha. Na mesma linha o Rodrigo
  // leu como se uma fosse o nome da outra ("pq o erro do adv chama ataq bloq....e erro do adv").
  var ftl = Array.from(el.querySelectorAll('.ft > div')).map(x => x.textContent);
  chk(ftl.length === 3 && ftl[0] === 'ADV = erros do adversário (pontos nossos)' && !/bloq/i.test(ftl[0]), 'rodape, linha 1: so a legenda do ADV (erros do adversario = pontos nossos)');
  chk(/^Nossos ataques bloqueados: 0 no set · 1 no jogo/.test(ftl[1]) && !/advers/i.test(ftl[1]), 'rodape, linha 2: so os NOSSOS ataques bloqueados (fora do total) — "' + ftl[1] + '"');
  var pill = w.document.querySelector('#mainApp .sc-errpill');
  chk(pill && pill.textContent === '6 erros', 'atalho no centro do placar com o total do set: "' + (pill && pill.textContent) + '"');
  w.goSet(1); el = w.document.querySelector('#mainApp .sc-errs');
  chk(cells(el, 1) === 'set 1 2 1 1 0 0 0 4 1' && w.document.querySelector('.sc-errpill').textContent === '4 erros', 'trocou de set: a linha do set acompanha (set 1 = 4 erros)');
  w.goSet(2);

  console.log('\n--- 3. o quadro se atualiza a cada marcacao ---');
  w.S.sp = 'a5'; w.S.sa = 'saque'; w.rcO('Erro');
  el = w.document.querySelector('#mainApp .sc-errs');
  chk(cells(el, 1) === 'set 2 2 2 0 1 1 1 7 2' && cells(el, 2) === 'jogo 4 3 1 1 1 1 11 3', 'marcou saque errado: SAQ 1 -> 2 no set, 3 -> 4 no jogo, total 7 / 11');
  w.scErrAdv(); el = w.document.querySelector('#mainApp .sc-errs');
  chk(cells(el, 1).slice(-2) === ' 3' && cells(el, 2).slice(-2) === ' 4', 'erro do adversario soma na coluna ADV (3 no set, 4 no jogo)');
  w.S.sp = 'a5'; w.S.sa = 'ataque'; w.rcO('Ponto'); el = w.document.querySelector('#mainApp .sc-errs');
  chk(cells(el, 1) === 'set 2 2 2 0 1 1 1 7 3', 'ponto de ataque nao mexe no quadro de erros');

  console.log('\n--- 4. detalhe por atleta (toque no quadro) ---');
  el.click();
  var pn = w.document.getElementById('errPanel');
  chk(!!pn && /ERROS POR FUNDAMENTO/.test(pn.textContent), 'tocar no quadro abre "ERROS POR FUNDAMENTO"');
  var rows = Array.from(pn.querySelectorAll('tbody tr')).map(r => Array.from(r.children).map(c => c.textContent).join(' '));
  chk(rows[0] === '#2 Orelha 0 0 0 1 1 0 2 0' && rows[1] === '#3 Igor 0 2 0 0 0 0 2 0' && rows[2] === '#1 Fabiano 1 0 0 0 0 0 1 0', 'set 2, ordenado por quem mais errou (empate: mais erros no jogo, depois camisa/nome): ' + rows.slice(0, 3).join(' | '));
  chk(rows[rows.length - 1] === 'TIME 2 2 0 1 1 1 7 0', 'linha do TIME bate com o quadro: ' + rows[rows.length - 1]);
  chk(!rows.some(r => /Andre/.test(r)), 'quem nao errou no recorte nao entra na lista');
  w.openErrPanel('game');
  rows = Array.from(w.document.querySelectorAll('#errPanel tbody tr')).map(r => Array.from(r.children).map(c => c.textContent).join(' '));
  chk(rows[0] === '#3 Igor 0 3 0 0 0 0 3 1' && rows[rows.length - 1] === 'TIME 4 3 1 1 1 1 11 1', '"Jogo todo": Igor 3 erros de ataque + 1 bloqueado; TIME 11 erros');
  var advBox = w.document.querySelector('#errPanel .errp-adv'), tbEl = w.document.querySelector('#errPanel .errp-tb'), ftEl = w.document.querySelector('#errPanel .errp-ft');
  chk(advBox && /^Erros do advers.rio: 4/.test(advBox.textContent) && /pontos nossos/.test(advBox.textContent) && !/bloq/i.test(advBox.textContent), 'erros do adversario (pontos nossos) numa faixa propria: "' + (advBox && advBox.textContent) + '"');
  chk(advBox && tbEl && !!(advBox.compareDocumentPosition(tbEl) & 4), 'a faixa do adversario vem ANTES da tabela dos nossos erros');
  chk(/Nossos erros, por atleta/.test(w.document.getElementById('errPanel').textContent), 'a tabela e rotulada "Nossos erros, por atleta"');
  chk(ftEl && /^ATQ bloqueado = ataque nosso que parou no bloqueio deles/.test(ftEl.textContent) && !/Erros do advers/.test(ftEl.textContent), 'a legenda do ATQ bloqueado fica sozinha embaixo (sem a contagem de erro do adversario na mesma linha)');
  chk(/ATQ\s*bloqueado/.test(w.document.querySelector('#errPanel thead th.bq').textContent), 'ultima coluna: "ATQ bloqueado" por extenso');
  w.S.sp = 'a6'; w.S.sa = 'recepcao'; w.rcO('Erro');
  rows = Array.from(w.document.querySelectorAll('#errPanel tbody tr')).map(r => Array.from(r.children).map(c => c.textContent).join(' '));
  chk(rows.some(r => r === '#6 Andre 0 0 1 0 0 0 1 0') && rows[rows.length - 1] === 'TIME 4 3 2 1 1 1 12 1', 'com o detalhe aberto, a marcacao nova entra na hora (Andre: 1 erro de recepcao)');
  w.closeErrPanel();
  chk(!w.document.getElementById('errPanel'), 'fecha no X');

  console.log('\n--- 5. onde NAO aparece ---');
  w.S = { aid: 'g2', sp: null, sa: null, cs: 1, us: [], tm: 0, rn: false, ti: null }; w.render();
  chk(!w.document.querySelector('#mainApp .sc-errs') && !w.document.querySelector('#mainApp .sc-errpill'), 'jogo ainda nao iniciado: sem quadro');
  chk(w._errStripHTML({ tidB: 'x', st: 'live', act: acts }) === '', 'minis 2 lados (duas equipes na mesma mesa): sem quadro');

  console.log('\n--- 6. modo TABLET ---');
  const d2 = boot(true); const w2 = d2.window;
  setTimeout(() => {
    try {
      load(w2);
      w2.tab = 'scout'; w2.S = { aid: 'g1', sp: null, sa: null, cs: 2, us: [], tm: 0, rn: false, ti: null };
      w2.gF('g1').courtMode = true; w2.gF('g1').court = { '2': { pos: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'], serving: 'us', libPair: null, after: null } };
      w2.render();
      var e2 = w2.document.querySelector('#mainApp .sct-col-l .sc-errs');
      chk(!!w2.document.querySelector('#mainApp .sct-body') && !!e2, 'tablet: o quadro fica na coluna esquerda da mesa (abaixo da quadra/liberos)');
      chk(e2 && cells(e2, 1) === 'set 2 1 2 0 1 1 1 6 2' && cells(e2, 2) === 'jogo 3 3 1 1 1 1 10 3', 'tablet: mesmos numeros do quadro classico');
      console.log('\n=== test_erros_ao_vivo: ' + ok + ' OK, ' + ko + ' FAIL ===');
      process.exit(ko > 0 ? 1 : 0);
    } catch (e) { console.log('FAIL exception: ' + e.message); console.log((e.stack || '').split('\n').slice(0, 6).join('\n')); process.exit(1); }
  }, 200);
 } catch (e) { console.log('FAIL exception: ' + e.message); console.log((e.stack || '').split('\n').slice(0, 6).join('\n')); process.exit(1); }
}, 200);
