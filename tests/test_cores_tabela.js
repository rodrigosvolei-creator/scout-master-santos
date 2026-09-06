/* Motor de tabela — todos contra todos.
   Testa o motor puro (cores-core) E a tela do Admin de verdade: sobe o
   cores.html num jsdom com as 5 equipes reais, clica em "Gerar tabela" e
   confere o que foi GRAVADO no banco.
   Roda: node tests/test_cores_tabela.js  */
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

const CORES = ['c_amarelo', 'c_azul', 'c_branco', 'c_cinza', 'c_preto'];
const TIMES = CORES.map((id, i) => ({ id: id, n: id.slice(2).toUpperCase(), cor: '#111827', ordem: i, players: [] }));
const par = (g) => [g.a, g.b].slice().sort().join('|');

(async () => {
  console.log('\n== motor puro ==');

  await t('5 equipes = 10 jogos (todos contra todos, 1 turno)', () => {
    eq(C.coresTabela(TIMES, {}).length, 10);
  });
  await t('cada dupla aparece exatamente uma vez', () => {
    const j = C.coresTabela(TIMES, {});
    const vis = {};
    j.forEach(g => { if (vis[par(g)]) throw new Error('confronto repetido: ' + par(g)); vis[par(g)] = 1; });
    eq(Object.keys(vis).length, 10);
  });
  await t('cada equipe joga 4 vezes', () => {
    const j = C.coresTabela(TIMES, {}), n = {};
    j.forEach(g => { n[g.a] = (n[g.a] || 0) + 1; n[g.b] = (n[g.b] || 0) + 1; });
    CORES.forEach(id => eq(n[id], 4, id));
  });
  await t('5 rodadas, 2 jogos por rodada', () => {
    const j = C.coresTabela(TIMES, {});
    const porRod = {};
    j.forEach(g => porRod[g.rodada] = (porRod[g.rodada] || 0) + 1);
    eq(Object.keys(porRod).length, 5);
    Object.keys(porRod).forEach(r => eq(porRod[r], 2, 'rodada ' + r));
  });
  await t('dentro da rodada ninguem joga duas vezes', () => {
    const j = C.coresTabela(TIMES, {}), vis = {};
    j.forEach(g => {
      const ka = g.rodada + ':' + g.a, kb = g.rodada + ':' + g.b;
      if (vis[ka] || vis[kb]) throw new Error('equipe repetida na rodada ' + g.rodada);
      vis[ka] = 1; vis[kb] = 1;
    });
  });
  await t('ninguem joga dois jogos seguidos', () => {
    const j = C.coresTabela(TIMES, {});
    for (let i = 1; i < j.length; i++) {
      const ant = [j[i - 1].a, j[i - 1].b];
      if (ant.indexOf(j[i].a) >= 0 || ant.indexOf(j[i].b) >= 0)
        throw new Error('jogo ' + (i + 1) + ' repete equipe do anterior');
    }
  });
  await t('uma equipe folga por rodada (numero impar de equipes)', () => {
    const j = C.coresTabela(TIMES, {});
    const f = C.coresFolgas(TIMES, j);
    eq(f.length, 5);
    f.forEach(x => eq(x.folga.length, 1, 'rodada ' + x.rodada));
    const quem = {};
    f.forEach(x => quem[x.folga[0].id] = 1);
    eq(Object.keys(quem).length, 5, 'cada equipe folga uma vez');
  });
  await t('ids saem em ordem alfabetica = ordem da tabela', () => {
    const j = C.coresTabela(TIMES, { prefixo: 'tz' });
    const ids = j.map(g => g.id);
    eq(ids.slice().sort(), ids, 'a ordem lexicografica tem que bater com a gerada');
  });
  await t('sem horario e com a data pedida', () => {
    const j = C.coresTabela(TIMES, { dt: '2026-09-05' });
    j.forEach(g => { eq(g.tm, ''); eq(g.dt, '2026-09-05'); eq(g.st, 'agendada'); eq(g.fase, 'class'); });
  });
  await t('2 turnos = 20 jogos, ida e volta com o lado trocado', () => {
    const j = C.coresTabela(TIMES, { turnos: 2 });
    eq(j.length, 20);
    const ida = j.filter(g => g.turno === 1), volta = j.filter(g => g.turno === 2);
    eq(ida.length, 10); eq(volta.length, 10);
    ida.forEach(g => {
      const v = volta.find(x => par(x) === par(g));
      ok_(v, 'sem volta para ' + par(g));
      ok_(v.a === g.b && v.b === g.a, 'a volta tem que inverter os lados');
    });
  });
  await t('numero par de equipes: 4 -> 6 jogos, 3 rodadas, sem folga', () => {
    const q = TIMES.slice(0, 4);
    const j = C.coresTabela(q, {});
    eq(j.length, 6);
    eq(C.coresFolgas(q, j).map(x => x.folga.length), [0, 0, 0]);
  });
  await t('2 equipes = 1 jogo; menos que isso = nenhum', () => {
    eq(C.coresTabela(TIMES.slice(0, 2), {}).length, 1);
    eq(C.coresTabela(TIMES.slice(0, 1), {}).length, 0);
    eq(C.coresTabela([], {}).length, 0);
  });
  await t('"pular" nao recria confronto que ja existe (nas duas ordens)', () => {
    const j = C.coresTabela(TIMES, { pular: [['c_azul', 'c_preto'], ['c_cinza', 'c_branco']] });
    eq(j.length, 8);
    j.forEach(g => {
      ok_(par(g) !== 'c_azul|c_preto', 'recriou azul x preto');
      ok_(par(g) !== 'c_branco|c_cinza', 'recriou branco x cinza');
    });
  });
  await t('6 equipes: 15 jogos, 5 rodadas de 3', () => {
    const seis = TIMES.concat([{ id: 'c_verde', n: 'VERDE' }]);
    const j = C.coresTabela(seis, {});
    eq(j.length, 15);
    eq(j[j.length - 1].rodada, 5);
  });
  await t('a tabela alterna o lado A/B (ninguem sempre do mesmo lado)', () => {
    const j = C.coresTabela(TIMES, {}), esq = {}, dir = {};
    j.forEach(g => { esq[g.a] = (esq[g.a] || 0) + 1; dir[g.b] = (dir[g.b] || 0) + 1; });
    CORES.forEach(id => ok_((esq[id] || 0) >= 1 && (dir[id] || 0) >= 1, id + ' ficou sempre do mesmo lado'));
  });


  /* ---------------- volta com 2 sets ---------------- */
  console.log('\n== volta (returno) com 2 sets ==');

  /* a ida como ela fica gravada: sem campo turno nem set (os jogos de ontem) */
  const IDA = C.coresTabela(TIMES, { prefixo: 'ida' }).map(g => ({
    id: g.id, a: g.a, b: g.b, dt: '2026-09-05', tm: '', st: 'finalizada'
  }));

  await t('a volta repete os 10 confrontos, com o mando invertido', () => {
    const v = C.coresTabela(TIMES, { turnos: 2, soTurno: 2, sets: 1, pular: IDA });
    eq(v.length, 10);
    const parIda = {};
    IDA.forEach(g => parIda[par(g)] = g);
    v.forEach(g => {
      const ida = parIda[par(g)];
      ok_(ida, 'confronto que nao existia na ida: ' + par(g));
      ok_(ida.a === g.b && ida.b === g.a, 'a volta tem que inverter o mando');
      eq(g.turno, 2);
    });
  });

  await t('2 sets por confronto = 20 jogos, com set 1 e set 2', () => {
    const v = C.coresTabela(TIMES, { turnos: 2, soTurno: 2, sets: 2, pular: IDA });
    eq(v.length, 20);
    const porPar = {};
    v.forEach(g => { porPar[par(g)] = porPar[par(g)] || []; porPar[par(g)].push(g.set); });
    eq(Object.keys(porPar).length, 10, 'os mesmos dez confrontos');
    Object.keys(porPar).forEach(k => eq(porPar[k].sort(), [1, 2], k));
    v.forEach(g => { eq(g.sets, 2); eq(g.turno, 2); });
  });

  await t('os dois sets do mesmo confronto saem em sequencia', () => {
    const v = C.coresTabela(TIMES, { turnos: 2, soTurno: 2, sets: 2, pular: IDA });
    for (let i = 0; i < v.length; i += 2) {
      eq(par(v[i]), par(v[i + 1]), 'jogo ' + (i + 1) + ' e ' + (i + 2) + ' deviam ser o mesmo confronto');
      eq([v[i].set, v[i + 1].set], [1, 2]);
    }
  });

  await t('a etiqueta do jogo diz VOLTA e o set', () => {
    const v = C.coresTabela(TIMES, { turnos: 2, soTurno: 2, sets: 2, pular: IDA });
    eq(C.coresRotulo(v[0]), 'VOLTA · SET 1');
    eq(C.coresRotulo(v[1]), 'VOLTA · SET 2');
    eq(C.coresRotulo(IDA[0]), '', 'a ida em set unico nao ganha etiqueta');
    eq(C.coresRotulo({ turno: 2, sets: 1, set: 1 }), 'VOLTA', 'volta em set unico so diz VOLTA');
  });

  await t('gerar a volta de novo nao duplica nada', () => {
    const v1 = C.coresTabela(TIMES, { turnos: 2, soTurno: 2, sets: 2, pular: IDA });
    const v2 = C.coresTabela(TIMES, { turnos: 2, soTurno: 2, sets: 2, pular: IDA.concat(v1) });
    eq(v2.length, 0);
  });

  await t('gerar a volta NAO recria a ida', () => {
    const v = C.coresTabela(TIMES, { turnos: 2, soTurno: 2, sets: 2, pular: IDA });
    v.forEach(g => eq(g.turno, 2, 'so pode vir jogo da volta'));
  });

  /* ---- o que o Rodrigo pediu: cada set conta sozinho na classificacao ---- */
  const cfg = { setPoints: 15, vantagem: 2, emQuadra: 4, ptsVitoria: 3, ptsDerrota: 1,
    bonusAte: 10, bonusVit: 1, bonusVant: 1, dedupeMs: 4000 };
  function jogoPronto(id, ta, tb, ptsA, ptsB, extra) {
    /* monta os eventos de um set fechado no placar pedido */
    const ev = {};
    let n = 0, r = 0;
    const bota = (tid) => { ev['-e' + (++n)] = { t: 'act', tid: tid, ak: 'pontonos', oc: 'Ponto', rally: r++, ts: 1757000000000 + n * 20000 }; };
    for (let i = 0; i < ptsA; i++) bota(ta);
    for (let i = 0; i < ptsB; i++) bota(tb);
    const g = { id: id, a: ta, b: tb, dt: '2026-09-06', tm: '', st: 'finalizada', fase: 'class' };
    for (const k in (extra || {})) g[k] = extra[k];
    return { g: g, ev: ev };
  }

  await t('1 set a 1: cada equipe leva uma vitoria e uma derrota', () => {
    const A = TIMES[0].id, B = TIMES[1].id;
    const s1 = jogoPronto('v1', A, B, 15, 9, { turno: 2, set: 1, sets: 2 });
    const s2 = jogoPronto('v2', A, B, 11, 15, { turno: 2, set: 2, sets: 2 });
    const S = C.coresStandings([s1.g, s2.g], TIMES, { v1: s1.ev, v2: s2.ev }, cfg);
    const a = S.find(x => x.tid === A), b = S.find(x => x.tid === B);
    /* A venceu o set 1 por 15x9 (adversaria abaixo de 10): +1 de bonus */
    eq([a.j, a.v, a.d, a.bon, a.pts], [2, 1, 1, 1, cfg.ptsVitoria + cfg.ptsDerrota + 1], 'equipe A');
    eq([b.j, b.v, b.d, b.bon, b.pts], [2, 1, 1, 0, cfg.ptsVitoria + cfg.ptsDerrota], 'equipe B');
    eq(a.pp, 26, 'pontos pro somam os dois sets'); eq(a.pc, 24);
  });

  await t('2 sets a 0: seis pontos para quem levou os dois', () => {
    const A = TIMES[0].id, B = TIMES[1].id;
    const s1 = jogoPronto('w1', A, B, 15, 9, { turno: 2, set: 1, sets: 2 });
    const s2 = jogoPronto('w2', A, B, 15, 12, { turno: 2, set: 2, sets: 2 });
    const S = C.coresStandings([s1.g, s2.g], TIMES, { w1: s1.ev, w2: s2.ev }, cfg);
    const a = S.find(x => x.tid === A), b = S.find(x => x.tid === B);
    /* o set 1 saiu 15x9: um bonus para A */
    eq([a.v, a.d, a.bon, a.pts], [2, 0, 1, 2 * cfg.ptsVitoria + 1]);
    eq([b.v, b.d, b.bon, b.pts], [0, 2, 0, 2 * cfg.ptsDerrota]);
  });

  await t('a ida continua na conta depois da volta', () => {
    const A = TIMES[0].id, B = TIMES[1].id;
    const ida = jogoPronto('i1', A, B, 15, 10, {});                       /* ontem */
    const s1 = jogoPronto('v1', B, A, 15, 9, { turno: 2, set: 1, sets: 2 });
    const s2 = jogoPronto('v2', B, A, 11, 15, { turno: 2, set: 2, sets: 2 });
    const S = C.coresStandings([ida.g, s1.g, s2.g], TIMES,
      { i1: ida.ev, v1: s1.ev, v2: s2.ev }, cfg);
    const a = S.find(x => x.tid === A);
    eq([a.j, a.v, a.d], [3, 2, 1], 'a vitoria de ontem tem que continuar valendo');
    eq(a.pts, 2 * cfg.ptsVitoria + cfg.ptsDerrota);
  });

  /* ---------------- tela do Admin ---------------- */
  console.log('\n== admin, na tela ==');

  const fakeDB = {}, listeners = [];
  const parts = p => p.split('/').filter(Boolean);
  const getAt = p => { let c = fakeDB; for (const k of parts(p)) { if (c == null) return null; c = c[k]; } return c === undefined ? null : c; };
  function setAt(p, v) {
    const a = parts(p); let c = fakeDB;
    for (let i = 0; i < a.length - 1; i++) { if (c[a[i]] == null || typeof c[a[i]] !== 'object') c[a[i]] = {}; c = c[a[i]]; }
    if (v === null) delete c[a[a.length - 1]]; else c[a[a.length - 1]] = JSON.parse(JSON.stringify(v));
    listeners.slice().forEach(l => { try { l.cb({ val: () => getAt(l.path) }); } catch (e) { } });
  }
  const makeRef = p => ({
    on(e, cb) { listeners.push({ path: p, cb }); cb({ val: () => getAt(p) }); },
    off() { },
    once() { return Promise.resolve({ val: () => getAt(p) }); },
    set(v) { setAt(p, v); return Promise.resolve(); },
    remove() { setAt(p, null); return Promise.resolve(); },
    push(v) { const k = '-k' + Object.keys(getAt(p) || {}).length; setAt(p + '/' + k, v); return Promise.resolve({ key: k }); }
  });
  const teams = {};
  TIMES.forEach(x => teams[x.id] = x);
  fakeDB['torneio-cores'] = { config: { nome: 'Mini Minis - Cores', emQuadra: 4 }, teams: teams, games: {} };

  const html = fs.readFileSync('cores.html', 'utf8')
    .replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>/g, '')
    .replace(/<script src="cores-core\.js[^"]*"><\/script>/, '<script>' + fs.readFileSync('cores-core.js', 'utf8') + '</script>')
    .replace('firebase.initializeApp(fc);', 'var firebase=window.fbm; firebase.initializeApp(fc);');

  let CONFIRMOU = true;
  const dom = new JSDOM(html, {
    url: 'http://localhost/cores.html?v=admin', runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w) {
      w.fbm = { initializeApp() { }, database: () => ({ ref: makeRef }) };
      w.confirm = () => CONFIRMOU; w.alert = () => { }; w.scrollTo = () => { };
    }
  });
  const w = dom.window;
  const wait = ms => new Promise(r => setTimeout(r, ms || 40));
  const tela = () => (w.document.querySelector('#app') || w.document.body).textContent.replace(/\s+/g, ' ');
  const botao = s => Array.from(w.document.querySelectorAll('button')).find(b => b.textContent.replace(/\s+/g, ' ').indexOf(s) >= 0);
  const jogos = () => Object.values(getAt('torneio-cores/games') || {});
  await wait();

  await t('a secao TABELA aparece no admin', () => {
    ok_(w.document.querySelector('.tabprev'), 'sem previa na tela');
    ok_(tela().indexOf('todos contra todos') >= 0, 'sem o subtitulo');
  });
  await t('a tela diz 10 jogos, 5 rodadas, 4 por equipe', () => {
    const r = w.document.querySelector('.tabres').textContent.replace(/\s+/g, ' ');
    ok_(/10 jogos/.test(r), 'nao diz 10 jogos: ' + r);
    ok_(/5 rodadas/.test(r), 'nao diz 5 rodadas: ' + r);
    ok_(/4 jogos por equipe/.test(r), 'nao diz 4 por equipe: ' + r);
  });
  await t('a previa mostra 5 rodadas com 10 confrontos e as folgas', () => {
    eq(w.document.querySelectorAll('.tabrod').length, 5);
    eq(w.document.querySelectorAll('.tabjg').length, 10);
    eq(Array.from(w.document.querySelectorAll('.tabrod')).filter(e => /folga:/.test(e.textContent)).length, 5);
  });
  await t('o botao diz quantos jogos vai criar', () => {
    ok_(botao('Gerar tabela — 10 jogos'), 'botao: ' + ((botao('Gerar tabela') || {}).textContent || 'nenhum'));
  });
  await t('trocar para 2 turnos recalcula a previa na hora', () => {
    w.setTab('tn', '2');
    ok_(/20 jogos/.test(w.document.querySelector('.tabres').textContent), 'nao virou 20');
    eq(w.document.querySelectorAll('.tabjg').length, 20);
    ok_(botao('Gerar tabela — 20 jogos'), 'botao nao acompanhou');
    w.setTab('tn', '1');
  });
  await t('clicar em Gerar cria os 10 jogos no banco', async () => {
    eq(jogos().length, 0, 'comecou sujo');
    botao('Gerar tabela').click(); await wait();
    eq(jogos().length, 10);
  });
  await t('os jogos gravados sao todos contra todos, agendados e sem horario', () => {
    const g = jogos(), vis = {};
    g.forEach(x => { vis[par(x)] = (vis[par(x)] || 0) + 1; eq(x.st, 'agendada'); eq(x.tm, ''); eq(x.fase, 'class'); ok_(x.dt, 'sem data'); });
    eq(Object.keys(vis).length, 10);
    Object.keys(vis).forEach(k => eq(vis[k], 1, k));
  });
  await t('o mural mostra os 10 jogos NA ORDEM da tabela', async () => {
    w.go('home'); await wait();
    const cards = Array.from(w.document.querySelectorAll('.gcard'));
    eq(cards.length, 10);
    const naTela = cards.map(c => Array.from(c.querySelectorAll('.gc-nm')).map(e => e.textContent.trim()).join(' x '));
    const esperado = jogos().slice().sort((a, b) => a.id < b.id ? -1 : 1).map(g => teams[g.a].n + ' x ' + teams[g.b].n);
    eq(naTela, esperado, 'o mural tem que seguir a ordem gerada — o proximo jogo fica no topo');
    w.go('admin'); await wait();
  });
  await t('gerar de novo nao duplica nada', () => {
    ok_(!botao('Gerar tabela — '), 'ainda oferece criar jogo repetido');
    ok_(botao('Tudo já criado'), 'devia dizer que ja esta tudo criado');
    ok_(tela().indexOf('Já existem') >= 0, 'sem aviso de jogos existentes');
    eq(jogos().length, 10);
  });
  await t('apagar a tabela remove os 10 agendados', async () => {
    botao('Apagar e refazer').click(); await wait();
    eq(jogos().length, 0);
  });
  await t('jogo com dado marcado NAO e apagado', async () => {
    botao('Gerar tabela').click(); await wait();
    const alvo = jogos()[0], outro = jogos()[1];
    setAt('torneio-cores/events/' + alvo.id + '/-e1', { t: 'act', tid: alvo.a, r: 0 });
    setAt('torneio-cores/games/' + outro.id + '/st', 'finalizada');
    await wait();
    botao('Apagar e refazer').click(); await wait();
    eq(jogos().length, 2, 'devia sobrar o com evento e o finalizado');
    ok_(jogos().some(g => g.id === alvo.id), 'apagou jogo com dado marcado');
  });
  await t('depois de apagar, a tabela recria so os 8 que faltam', async () => {
    ok_(botao('Gerar tabela — 8 jogos'), 'botao: ' + ((botao('Gerar tabela') || {}).textContent || 'nenhum'));
    eq(w.document.querySelectorAll('.tabjg.ja').length, 2, 'os 2 existentes deviam aparecer como "ja criado"');
    botao('Gerar tabela').click(); await wait();
    eq(jogos().length, 10);
    const vis = {};
    jogos().forEach(x => vis[par(x)] = (vis[par(x)] || 0) + 1);
    eq(Object.keys(vis).length, 10, 'nao fechou todos contra todos');
    Object.keys(vis).forEach(k => eq(vis[k], 1, 'confronto duplicado: ' + k));
  });
  await t('cancelar no confirm nao grava nada', async () => {
    jogos().forEach(g => setAt('torneio-cores/games/' + g.id, null));
    setAt('torneio-cores/events', null);
    await wait();
    CONFIRMOU = false;
    botao('Gerar tabela').click(); await wait();
    eq(jogos().length, 0);
    CONFIRMOU = true;
  });

  console.log('\n' + (fail ? '✗ ' + fail + ' FALHA(S) · ' : '✓ TUDO VERDE · ') + ok + ' checagens');
  process.exit(fail ? 1 : 0);
})();
