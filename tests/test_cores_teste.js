/* MODO TESTE (?teste=1) — o que importa aqui é UMA coisa: nada do espaço de
   treino pode encostar no torneio de verdade. O teste sobe os dois lado a lado
   no mesmo banco e confere isso a cada passo.
   Roda: node tests/test_cores_teste.js  */
const fs = require('fs');
const { JSDOM } = require('jsdom');

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
  push(v) { seq++; const k = '-T' + String(seq).padStart(5, '0'); setAt(p + '/' + k, v); return Promise.resolve({ key: k }); }
});
const firebaseMock = { initializeApp() { }, database: () => ({ ref: makeRef }) };

const TIMES = {
  tp: { id: 'tp', n: 'PRETO', cor: '#111827', ordem: 0, players: [
    { id: 'p1', nm: 'LUIZA' }, { id: 'p2', nm: 'VINNY' }, { id: 'p3', nm: 'ORELHA' }, { id: 'p4', nm: 'JOSE' }] },
  ta: { id: 'ta', n: 'AMARELO', cor: '#eab308', ordem: 1, players: [
    { id: 'a1', nm: 'BRUNA' }, { id: 'a2', nm: 'JOAO' }, { id: 'a3', nm: 'ADAL' }, { id: 'a4', nm: 'ANGEL' }] }
};
const CFG = { nome: 'Mini Minis - Cores', setPoints: 15, vantagem: 2, emQuadra: 4, ptsVitoria: 3, ptsDerrota: 1, dedupeMs: 4000 };

/* o torneio DE VERDADE, com um jogo já finalizado */
fakeDB['torneio-cores'] = {
  config: CFG, teams: TIMES,
  games: { real1: { id: 'real1', a: 'tp', b: 'ta', dt: '2026-09-06', tm: '', st: 'finalizada', fase: 'class' } },
  events: { real1: { '-r1': { t: 'act', tid: 'tp', ak: 'pontonos', oc: 'Ponto', rally: 0, ts: 1757000000000 } } },
  /* e o espaco de treino, no canto */
  _teste: {
    config: CFG, teams: TIMES,
    games: { t1: { id: 't1', a: 'tp', b: 'ta', dt: '2026-09-06', tm: '', st: 'agendada', fase: 'class' } },
    events: {}
  }
};
/* O motor anota a chave do evento (campo `k`) no próprio objeto ao lê-lo. Num
   Firebase de verdade `val()` devolve cópia e isso morre ali; no banco falso
   mexe no objeto guardado. Não é escrita — a foto ignora esse campo. */
const semK = o => JSON.parse(JSON.stringify(o || null), (k, v) => k === 'k' ? undefined : v);
const fotoReal = () => JSON.stringify({
  games: semK(getAt('torneio-cores/games')), events: semK(getAt('torneio-cores/events')),
  teams: semK(getAt('torneio-cores/teams')), config: semK(getAt('torneio-cores/config'))
});

const html = fs.readFileSync('cores.html', 'utf8')
  .replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>/g, '')
  .replace(/<script src="cores-core\.js[^"]*"><\/script>/, '<script>' + fs.readFileSync('cores-core.js', 'utf8') + '</script>')
  .replace('firebase.initializeApp(fc);', 'var firebase=window.firebaseMock; firebase.initializeApp(fc);');

let CLOCK = 1757300000000;
function aparelho(qs) {
  return new JSDOM(html, {
    url: 'http://localhost/cores.html' + qs, runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w) {
      w.Date.now = () => CLOCK;
      w.firebaseMock = firebaseMock;
      w.confirm = () => true; w.alert = () => { }; w.scrollTo = () => { };
    }
  }).window;
}
const wait = ms => new Promise(r => setTimeout(r, ms || 40));
const all = (w, s) => Array.from(w.document.querySelectorAll(s));
const txt = w => (w.document.querySelector('#app') || w.document.body).textContent.replace(/\s+/g, ' ');

(async () => {
  console.log('\n== o espaço de treino é separado ==');

  const ANTES = fotoReal();
  const T = aparelho('?teste=1'); await wait(80);
  const R = aparelho('?'); await wait(80);

  await t('o modo teste lê de outro canto do banco', () => {
    eq(T.ROOT, 'torneio-cores/_teste');
    eq(R.ROOT, 'torneio-cores');
  });

  await t('a tela avisa, sem chance de confundir com o torneio', () => {
    ok_(T.document.querySelector('.hd-teste'), 'faltou o selo no topo');
    ok_(txt(T).indexOf('MODO TESTE') >= 0, txt(T).slice(0, 120));
    ok_(txt(T).indexOf('não têm nenhuma relação com o torneio') >= 0, 'faltou o aviso explicando');
    ok_(!R.document.querySelector('.hd-teste'), 'o torneio de verdade NAO pode ter esse selo');
    ok_(txt(R).indexOf('MODO TESTE') < 0);
  });

  await t('cada um enxerga só os seus jogos', () => {
    eq(Object.keys(T.D.games), ['t1'], 'o treino so ve o jogo de treino');
    eq(Object.keys(R.D.games), ['real1'], 'o torneio so ve o jogo de verdade');
  });

  await t('navegar dentro do treino não perde o modo', async () => {
    T.go('class'); await wait(50);
    ok_(T.location.search.indexOf('teste=1') >= 0, 'perdeu o modo ao navegar: ' + T.location.search);
    eq(T.ROOT, 'torneio-cores/_teste');
    const tl = all(T, '.hd-nav a').find(a => /Telão/.test(a.textContent));
    ok_(tl && tl.getAttribute('href').indexOf('teste=1') >= 0, 'o link do telao tem que levar o modo junto');
    T.go('home'); await wait(50);
  });

  console.log('\n== marcar no treino não encosta no torneio ==');

  await t('montar e jogar um jogo de treino', async () => {
    const W = aparelho('?v=mesa&g=t1&teste=1'); await wait(90);
    all(W, '.pickteam-btn')[0].click(); await wait(60);
    all(W, '.teamchoice:not(.ladoch)')[0].click(); await wait(50);
    for (let i = 0; i < 4; i++) { all(W, '.poolp').filter(b => !b.disabled)[0].click(); await wait(25); }
    all(W, 'button').find(b => /Confirmar e começar/.test(b.textContent)).click(); await wait(80);
    all(W, 'button').find(b => /Iniciar jogo/.test(b.textContent)).click(); await wait(80);
    for (let i = 0; i < 15; i++) {
      CLOCK += 14000;
      const b = all(W, 'button').find(x => /Ponto PRETO/.test(x.textContent));
      if (!b) break;
      b.click(); await wait(35);
    }
    all(W, 'button').find(b => /Finalizar jogo/.test(b.textContent)).click(); await wait(110);
    eq(getAt('torneio-cores/_teste/games/t1/st'), 'finalizada', 'o jogo de treino tinha que fechar');
    ok_(Object.keys(getAt('torneio-cores/_teste/events/t1') || {}).length > 0, 'faltaram as marcacoes no treino');
  });

  await t('o torneio de verdade ficou byte a byte igual', () => {
    eq(fotoReal(), ANTES, 'alguma coisa do treino vazou para o torneio');
  });

  await t('a classificação do torneio não mudou', async () => {
    const R2 = aparelho('?v=class'); await wait(120);
    eq(Object.keys(R2.D.games), ['real1'], 'a classificacao do torneio nao pode ver o treino');
    /* conferido pelo motor, com os mesmos dados que a tela esta usando */
    const S = R2.coresStandings(R2.gamesArr(), R2.teamsArr(), R2.D.events, R2.D.config);
    const preto = S.find(x => x.tid === 'tp');
    eq([preto.j, preto.v, preto.pts], [1, 1, 3], 'o PRETO tem que continuar com um jogo so');
    eq(S.reduce((a, x) => a + x.j, 0), 2, 'so o jogo de verdade entra (duas participacoes)');
  });

  await t('a classificação do treino conta só o treino', async () => {
    const T2 = aparelho('?v=class&teste=1'); await wait(120);
    eq(Object.keys(T2.D.games), ['t1']);
    ok_(txt(T2).indexOf('PRETO') >= 0, txt(T2).slice(0, 120));
  });

  await t('apagar o treino inteiro não mexe no torneio', () => {
    setAt('torneio-cores/_teste', null);
    eq(getAt('torneio-cores/_teste'), null, 'o treino tinha que sumir');
    eq(fotoReal(), ANTES, 'apagar o treino nao pode encostar no torneio');
  });

  console.log('\n' + (fail ? '✗ ' + fail + ' FALHA(S) · ' : '✓ TUDO VERDE · ') + ok + ' checagens');
  process.exit(fail ? 1 : 0);
})();
