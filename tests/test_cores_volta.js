/* Volta em 2 sets: lado da quadra e a emenda do set seguinte.
   O operador não deve "entrar em outro jogo": ao fechar o set 1 ele cai no set 2
   com a mesma equipe, a mesma escalação, o lado trocado e o saque invertido.
   Roda: node tests/test_cores_volta.js  */
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
  push(v) { seq++; const k = '-V' + String(seq).padStart(5, '0'); setAt(p + '/' + k, v); return Promise.resolve({ key: k }); }
});
const firebaseMock = { initializeApp() { }, database: () => ({ ref: makeRef }) };

const PRETO = { id: 'tp', n: 'PRETO', cor: '#111827', ordem: 0, players: [
  { id: 'p1', nm: 'LUIZA' }, { id: 'p2', nm: 'VINNY' }, { id: 'p3', nm: 'ORELHA' }, { id: 'p4', nm: 'JOSE' }] };
const AMAR = { id: 'ta', n: 'AMARELO', cor: '#eab308', ordem: 1, players: [
  { id: 'a1', nm: 'BRUNA' }, { id: 'a2', nm: 'JOAO' }, { id: 'a3', nm: 'ADAL' }, { id: 'a4', nm: 'ANGEL' }] };

/* a volta: AMARELO x PRETO em dois sets */
fakeDB['torneio-cores'] = {
  config: { nome: 'Mini Minis - Cores', setPoints: 15, vantagem: 2, emQuadra: 4, ptsVitoria: 3, ptsDerrota: 1, dedupeMs: 4000 },
  teams: { tp: PRETO, ta: AMAR },
  games: {
    s1: { id: 's1', a: 'ta', b: 'tp', dt: '2026-09-06', tm: '', st: 'agendada', fase: 'class', turno: 2, set: 1, sets: 2, rodada: 1 },
    s2: { id: 's2', a: 'ta', b: 'tp', dt: '2026-09-06', tm: '', st: 'agendada', fase: 'class', turno: 2, set: 2, sets: 2, rodada: 1 }
  },
  events: {}
};

const html = fs.readFileSync('cores.html', 'utf8')
  .replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>/g, '')
  .replace(/<script src="cores-core\.js[^"]*"><\/script>/, '<script>' + fs.readFileSync('cores-core.js', 'utf8') + '</script>')
  .replace('firebase.initializeApp(fc);', 'var firebase=window.firebaseMock; firebase.initializeApp(fc);');

let CLOCK = 1757200000000;
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
function clicaTxt(w, sel, s) {
  const e = all(w, sel).find(x => x.textContent.replace(/\s+/g, ' ').indexOf(s) >= 0);
  if (!e) throw new Error('nao achei ' + sel + ' com "' + s + '" | tela: ' + txt(w).slice(0, 220));
  e.click(); return e;
}

(async () => {
  console.log('\n== lado da quadra ==');

  const M = aparelho('?v=mesa&g=s1');
  await wait(70);
  clicaTxt(M, '.pickteam-btn', 'AMARELO'); await wait(60);

  await t('o setup pergunta o lado da quadra', () => {
    ok_(txt(M).indexOf('De que lado a AMARELO está') >= 0, txt(M).slice(0, 220));
    eq(all(M, '.ladoch').length, 2, 'esquerda e direita');
    ok_(all(M, '.ladoch').map(b => b.textContent).join(' ').indexOf('ESQUERDA') >= 0);
  });

  await t('escolher ESQUERDA grava o lado no jogo, nao no evento', async () => {
    clicaTxt(M, '.ladoch', 'ESQUERDA'); await wait(80);
    eq(getAt('torneio-cores/games/s1/ladoA'), 'E', 'AMARELO e a equipe A, logo ladoA=E');
    const evs = Object.values(getAt('torneio-cores/events/s1') || {});
    ok_(!evs.some(e => e.t === 'lado'), 'lado nao e evento: os dois aparelhos leem o mesmo campo');
  });

  await t('o SET 2 ja nasce com o lado invertido', () => {
    eq(getAt('torneio-cores/games/s2/ladoA'), 'D', 'no set 2 o AMARELO troca de lado');
  });

  await t('a mesa mostra de que lado cada equipe esta', () => {
    const tags = all(M, '.ladotag').map(e => e.textContent.replace(/\s+/g, ' ').trim());
    ok_(tags.length >= 2, 'faltou a etiqueta de lado: ' + tags.join(' | '));
    ok_(tags.join(' ').indexOf('ESQUERDA') >= 0 && tags.join(' ').indexOf('DIREITA') >= 0, tags.join(' | '));
  });

  console.log('\n== emenda do set 2 ==');

  await t('monta o set 1 e joga ate fechar', async () => {
    clicaTxt(M, '.teamchoice:not(.ladoch)', 'AMARELO'); await wait(60);   /* AMARELO saca */
    for (let i = 0; i < 4; i++) {
      const livres = all(M, '.poolp').filter(b => !b.disabled);
      livres[0].click(); await wait(25);
    }
    clicaTxt(M, 'button', 'Confirmar e começar'); await wait(80);
    clicaTxt(M, 'button', 'Iniciar jogo'); await wait(80);
    for (let i = 0; i < 15; i++) {
      CLOCK += 14000;
      const b = all(M, 'button').find(x => /Ponto AMARELO/.test(x.textContent));
      if (!b) break;
      b.click(); await wait(40);
    }
    ok_(txt(M).indexOf('Set encerrado') >= 0, txt(M).slice(0, 200));
  });

  await t('finalizado, a mesa oferece ir para o SET 2', async () => {
    clicaTxt(M, 'button', 'Finalizar jogo'); await wait(120);
    const b = all(M, 'button').find(x => /Ir para o VOLTA · SET 2|SET 2/.test(x.textContent));
    ok_(b, 'faltou o botao de emenda | ' + all(M, 'button').map(x => x.textContent.trim()).join(' | ').slice(0, 200));
  });

  await t('a emenda leva ao SET 2 com equipe, escalacao e saque prontos', async () => {
    all(M, 'button').find(x => /SET 2/.test(x.textContent)).click();
    await wait(200);
    eq(M.location.search.indexOf('g=s2') >= 0, true, 'devia ter navegado para o set 2: ' + M.location.search);
    eq(M.localStorage.getItem('cores_tid_s2'), 'ta', 'a equipe do operador segue junto');
    const evs = Object.values(getAt('torneio-cores/events/s2') || {});
    const lu = evs.find(e => e.t === 'lineup' && e.tid === 'ta');
    ok_(lu, 'a escalacao tinha que ser copiada');
    eq(lu.ordem, ['a1', 'a2', 'a3', 'a4']);
    const fs2 = evs.find(e => e.t === 'first');
    ok_(fs2, 'faltou quem saca no set 2');
    eq(fs2.tid, 'tp', 'quem RECEBEU no set 1 comeca sacando no set 2');
  });

  await t('no SET 2 a tela ja abre pronta para iniciar', async () => {
    await wait(90);
    ok_(txt(M).indexOf('Escalação pronta') >= 0 || txt(M).indexOf('Iniciar jogo') >= 0, txt(M).slice(0, 200));
    ok_(txt(M).indexOf('ANTES DE COMEÇAR') < 0, 'nao pode pedir o setup de novo');
  });

  await t('o set 1 continua finalizado e valendo na classificacao', () => {
    eq(getAt('torneio-cores/games/s1/st'), 'finalizada');
    eq(getAt('torneio-cores/games/s2/st'), 'agendada');
  });

  console.log('\n== telao ==');

  await t('o telao mostra as equipes na ordem da quadra', async () => {
    setAt('torneio-cores/games/s2/st', 'ao_vivo');
    const T1 = aparelho('?v=telao'); await wait(140);
    const nomes = all(T1, '.tl-nm').map(e => e.textContent.replace(/[^A-ZÁÉÍÓÚÃÕÇ ]/g, '').trim());
    /* no set 2 o AMARELO esta na DIREITA, entao aparece a direita */
    eq(nomes, ['PRETO', 'AMARELO'], 'com ladoA=D o telao inverte a ordem');
  });

  await t('sem lado definido, o telao usa a ordem do jogo', async () => {
    setAt('torneio-cores/games/s2/ladoA', null);
    const T2 = aparelho('?v=telao'); await wait(140);
    const nomes = all(T2, '.tl-nm').map(e => e.textContent.replace(/[^A-ZÁÉÍÓÚÃÕÇ ]/g, '').trim());
    eq(nomes, ['AMARELO', 'PRETO']);
  });

  console.log('\n' + (fail ? '✗ ' + fail + ' FALHA(S) · ' : '✓ TUDO VERDE · ') + ok + ' checagens');
  process.exit(fail ? 1 : 0);
})();
