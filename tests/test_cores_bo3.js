/* Semifinal e final em MELHOR DE 3, na tela.
   O que precisa ficar de pé: o card é do confronto, o placar que decide é o de
   SETS, o terceiro set só existe se ficar 1 a 1, e a final espera o confronto
   inteiro da semi — não um set.
   Roda: node tests/test_cores_bo3.js  */
const fs = require('fs');
const { JSDOM } = require('jsdom');
const C = require('../cores-core.js');

let ok = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); ok++; console.log('  ✓ ' + name); }
  catch (e) { fail++; console.log('  ✗ ' + name + '\n      ' + (e && e.message)); }
}
function eq(a, b, m) {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A !== B) throw new Error((m ? m + ': ' : '') + 'esperado ' + B + ', veio ' + A);
}
function ok_(c, m) { if (!c) throw new Error(m || 'falso'); }

const fakeDB = {}, listeners = [];
let seq = 0;
const parts = p => String(p).split('/').filter(Boolean);
const getAt = p => { let c = fakeDB; for (const k of parts(p)) { if (c == null) return null; c = c[k]; } return c === undefined ? null : c; };
function setAt(p, v) {
  const a = parts(p); let c = fakeDB;
  for (let i = 0; i < a.length - 1; i++) { if (c[a[i]] == null || typeof c[a[i]] !== 'object') c[a[i]] = {}; c = c[a[i]]; }
  if (v === null) delete c[a[a.length - 1]]; else c[a[a.length - 1]] = JSON.parse(JSON.stringify(v));
  listeners.slice().forEach(l => { try { l.cb({ val: () => getAt(l.path) }); } catch (e) { } });
}
const makeRef = p => ({
  on(e, cb) { listeners.push({ path: p, cb }); cb({ val: () => getAt(p) }); },
  off() { for (let i = listeners.length - 1; i >= 0; i--) if (listeners[i].path === p) listeners.splice(i, 1); },
  once() { return Promise.resolve({ val: () => getAt(p) }); },
  set(v) { setAt(p, v); return Promise.resolve(); },
  remove() { setAt(p, null); return Promise.resolve(); },
  push(v) { seq++; const k = '-B' + String(seq).padStart(5, '0'); setAt(p + '/' + k, v); return Promise.resolve({ key: k }); }
});
const firebaseMock = { initializeApp() { }, database: () => ({ ref: makeRef }) };

const CFG = { nome: 'Cores', setPoints: 15, vantagem: 2, emQuadra: 4, ptsVitoria: 3, ptsDerrota: 1, dedupeMs: 4000 };
const TEAMS = {
  tz: { id: 'tz', n: 'AZUL', cor: '#2563eb', ordem: 0, players: [{ id: 'z1', nm: 'ANA' }, { id: 'z2', nm: 'BIA' }, { id: 'z3', nm: 'CAU' }, { id: 'z4', nm: 'DU' }] },
  ta: { id: 'ta', n: 'AMARELO', cor: '#eab308', ordem: 1, players: [{ id: 'a1', nm: 'EVA' }, { id: 'a2', nm: 'FE' }, { id: 'a3', nm: 'GI' }, { id: 'a4', nm: 'HEL' }] }
};
/* sets fechados no placar pedido, sem passar pela tela */
let n = 0;
function setFeito(conf, fase, set, a, b, pa, pb, st) {
  const ev = {};
  let r = 0;
  const bota = tid => { n++; ev['-e' + n] = { t: 'act', tid: tid, ak: 'pontonos', oc: 'Ponto', rally: r++, ts: 1757400000000 + n * 20000 }; };
  for (let i = 0; i < pa; i++) bota(a);
  for (let i = 0; i < pb; i++) bota(b);
  return {
    g: { id: conf + '_s' + set, a: a, b: b, st: st || 'finalizada', fase: fase, conf: conf, set: set, sets: 3, dt: '2026-09-06', tm: '', ordem: 1 },
    ev: ev
  };
}

const html = fs.readFileSync('cores.html', 'utf8')
  .replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>/g, '')
  .replace(/<script src="cores-core\.js[^"]*"><\/script>/, '<script>' + fs.readFileSync('cores-core.js', 'utf8') + '</script>')
  .replace('firebase.initializeApp(fc);', 'var firebase=window.firebaseMock; firebase.initializeApp(fc);');

function aparelho(qs) {
  return new JSDOM(html, {
    url: 'http://localhost/cores.html' + qs, runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w) { w.firebaseMock = firebaseMock; w.confirm = () => true; w.alert = () => { }; w.scrollTo = () => { }; }
  }).window;
}
const wait = ms => new Promise(r => setTimeout(r, ms || 60));
const all = (w, s) => Array.from(w.document.querySelectorAll(s));
const txt = w => (w.document.querySelector('#app') || w.document.body).textContent.replace(/\s+/g, ' ');

function semeia(jogos, evs, extras) {
  const games = {}, events = {};
  jogos.forEach((j, i) => { games[j.g.id] = j.g; events[j.g.id] = j.ev; });
  (extras || []).forEach(g => { games[g.id] = g; });
  fakeDB['torneio-cores'] = { config: CFG, teams: TEAMS, games: games, events: events };
}

(async () => {
  console.log('\n== melhor de 3 no mural ==');

  await t('2 a 0 fecha o confronto e o 3o set não é jogado', async () => {
    semeia([setFeito('sf1', 'semi', 1, 'tz', 'ta', 15, 9),
            setFeito('sf1', 'semi', 2, 'tz', 'ta', 15, 12)],
      null,
      [{ id: 'sf1_s3', a: 'tz', b: 'ta', st: 'agendada', fase: 'semi', conf: 'sf1', set: 3, sets: 3, dt: '2026-09-06', tm: '', ordem: 1 }]);
    const W = aparelho('?'); await wait(140);
    const cards = all(W, '.gcard');
    eq(cards.length, 1, 'os tres sets sao UM card');
    const c = cards[0];
    ok_(/melhor de 3/.test(c.textContent), c.textContent.replace(/\s+/g, ' ').slice(0, 90));
    ok_(/2-0/.test(c.textContent.replace(/\s+/g, '')), 'faltou o placar de sets | ' + c.textContent.replace(/\s+/g, ' ').slice(0, 90));
    eq(c.querySelectorAll('.gc-set').length, 3, 'os tres sets aparecem');
    eq(c.querySelectorAll('.gc-set.morto').length, 1, 'o set 3 fica apagado — nao vai acontecer');
    ok_(/FIM/.test(c.textContent), 'o confronto tem que constar como encerrado');
    ok_(!/Marcar celular/.test(c.textContent), 'nao pode oferecer marcar um confronto decidido');
  });

  await t('1 a 1 deixa o 3o set em aberto e é ele que abre', async () => {
    semeia([setFeito('sf1', 'semi', 1, 'tz', 'ta', 15, 9),
            setFeito('sf1', 'semi', 2, 'tz', 'ta', 11, 15)],
      null,
      [{ id: 'sf1_s3', a: 'tz', b: 'ta', st: 'agendada', fase: 'semi', conf: 'sf1', set: 3, sets: 3, dt: '2026-09-06', tm: '', ordem: 1 }]);
    const W = aparelho('?'); await wait(140);
    const c = all(W, '.gcard')[0];
    ok_(/1-1/.test(c.textContent.replace(/\s+/g, '')), 'placar de sets | ' + c.textContent.replace(/\s+/g, ' ').slice(0, 90));
    eq(c.querySelectorAll('.gc-set.morto').length, 0, 'nenhum set morto: o terceiro vai valer');
    ok_(/AGENDADO/.test(c.textContent), 'o confronto continua aberto');
    const b = Array.from(c.querySelectorAll('button')).find(x => /Marcar$/.test(x.textContent.trim()));
    ok_(b && /sf1_s3/.test(b.getAttribute('onclick')), 'o botao tem que abrir o SET 3 | ' + (b && b.getAttribute('onclick')));
  });

  await t('a mesa avisa que o confronto acabou em vez de oferecer o 3o set', async () => {
    semeia([setFeito('sf1', 'semi', 1, 'tz', 'ta', 15, 9),
            setFeito('sf1', 'semi', 2, 'tz', 'ta', 15, 12)],
      null,
      [{ id: 'sf1_s3', a: 'tz', b: 'ta', st: 'agendada', fase: 'semi', conf: 'sf1', set: 3, sets: 3, dt: '2026-09-06', tm: '', ordem: 1 }]);
    const W = aparelho('?v=mesa&g=sf1_s2'); await wait(160);
    W.setMeuTid('tz'); await wait(120);
    ok_(/Confronto encerrado/.test(txt(W)), txt(W).slice(0, 220));
    ok_(/venceu por 2 a 0 em sets/.test(txt(W)), txt(W).slice(0, 220));
    ok_(!/Ir para o/.test(txt(W)), 'nao pode oferecer o set seguinte');
  });

  console.log('\n== a final espera a semi inteira ==');

  await t('a final só recebe as equipes quando a semi fecha em sets', async () => {
    const b = C.coresBracket(
      [{ tid: 'tz', n: 'AZUL' }, { tid: 'ta', n: 'AMARELO' }, { tid: 'tz', n: 'AZUL' }, { tid: 'ta', n: 'AMARELO' }],
      'semi', false, { prefixo: 'f', dt: '2026-09-06' });
    const sf1 = b.filter(x => x.conf === 'f_sf1');
    eq(sf1.length, 3, 'a semi nasce com tres sets');
    const fin = b.filter(x => x.fase === 'final');
    eq(fin[0].srcA, { fromConf: 'f_sf1', tipo: 'win' });

    /* um set só não decide */
    const um = setFeito('f_sf1', 'semi', 1, 'tz', 'ta', 15, 9);
    let r = C.coresResolveGames(sf1.slice(1).concat([um.g], fin), { [um.g.id]: um.ev }, TEAMS, CFG);
    eq(r.find(x => x.fase === 'final').a, '', 'com 1 a 0 a final ainda espera');

    /* o segundo fecha */
    const dois = setFeito('f_sf1', 'semi', 2, 'tz', 'ta', 15, 11);
    r = C.coresResolveGames([um.g, dois.g].concat(fin), { [um.g.id]: um.ev, [dois.g.id]: dois.ev }, TEAMS, CFG);
    eq(r.find(x => x.fase === 'final').a, 'tz', 'AZUL fez 2 sets e vai a final');
  });

  await t('campeã é quem leva o confronto da final', () => {
    const um = setFeito('fin', 'final', 1, 'tz', 'ta', 15, 9);
    const dois = setFeito('fin', 'final', 2, 'tz', 'ta', 12, 15);
    const tres = setFeito('fin', 'final', 3, 'tz', 'ta', 15, 13);
    const evs = { [um.g.id]: um.ev, [dois.g.id]: dois.ev, [tres.g.id]: tres.ev };
    eq(C.coresCampeao([um.g, dois.g], { [um.g.id]: um.ev, [dois.g.id]: dois.ev }, TEAMS, CFG), null, '1 a 1 nao da titulo');
    eq(C.coresCampeao([um.g, dois.g, tres.g], evs, TEAMS, CFG), 'tz', 'AZUL leva por 2 a 1');
  });

  await t('nada disso entra na classificação', () => {
    const um = setFeito('sf1', 'semi', 1, 'tz', 'ta', 15, 9);
    const dois = setFeito('sf1', 'semi', 2, 'tz', 'ta', 15, 12);
    const S = C.coresStandings([um.g, dois.g], Object.values(TEAMS),
      { [um.g.id]: um.ev, [dois.g.id]: dois.ev }, CFG);
    eq(S.map(x => [x.n, x.j, x.pts]), [['AZUL', 0, 0], ['AMARELO', 0, 0]], 'mata-mata nao pontua');
  });

  console.log('\n' + (fail ? '✗ ' + fail + ' FALHA(S) · ' : '✓ TUDO VERDE · ') + ok + ' checagens');
  process.exit(fail ? 1 : 0);
})();
