/* Modulo "Torneio por Cores" — motor puro.
   Cobre o que o evento exige: 2 operadores no MESMO jogo sem duplicar ponto e
   sem perder acao, rodizio de saque, ajuste manual, fim de set e classificacao.
   Roda: node tests/test_cores.js  */
const C = require('../cores-core.js');

let ok = 0, fail = 0;
function t(name, fn) {
  try { fn(); ok++; console.log('  ✓ ' + name); }
  catch (e) { fail++; console.log('  ✗ ' + name + '\n      ' + e.message); }
}
function eq(a, b, m) {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A !== B) throw new Error((m ? m + ': ' : '') + 'esperado ' + B + ', veio ' + A);
}

/* --- cenario base: 2 equipes de 4, set unico 21 --- */
const AZUL = { id: 'tz', n: 'AZUL', cor: '#2563eb', ordem: 0, players: [
  { id: 'z1', nm: 'Ana' }, { id: 'z2', nm: 'Bia' }, { id: 'z3', nm: 'Cau' }, { id: 'z4', nm: 'Dora' }] };
const VERM = { id: 'tv', n: 'VERMELHA', cor: '#dc2626', ordem: 1, players: [
  { id: 'v1', nm: 'Edu' }, { id: 'v2', nm: 'Fê' }, { id: 'v3', nm: 'Gui' }, { id: 'v4', nm: 'Hel' }] };
const TEAMS = { tz: AZUL, tv: VERM };
const GAME = { id: 'g1', a: 'tz', b: 'tv', st: 'ao_vivo' };
const CFG = { setPoints: 21, vantagem: 2, emQuadra: 4 };

/* Helper: monta o objeto de eventos como o Firebase entrega (chaves ordenaveis). */
let seq = 0;
function K() { seq++; return '-Ev' + String(seq).padStart(4, '0'); }
function evs(list) { const o = {}; list.forEach(e => { o[e.k || K()] = e; }); return o; }
function act(tid, jid, ak, oc, rally, k) { return { k: k, t: 'act', tid, jid, ak, oc, rally }; }
function serve(tid, jid, k) { return { k: k, t: 'serve', tid, jid }; }
function adj(tid, delta, k) { return { k: k, t: 'adj', tid, delta }; }
function run(list, cfg) { return C.coresComputeGame(GAME, evs(list), TEAMS, cfg || CFG); }

console.log('\n== regra de ponto (mesma do RS-SCOUT) ==');
t('ace / ataque ponto / bloqueio ponto pontuam para quem marcou', () => {
  eq(C.coresTerminal('saque', 'Ace'), 'self');
  eq(C.coresTerminal('ataque', 'Ponto'), 'self');
  eq(C.coresTerminal('bloqueio', 'Ponto'), 'self');
});
t('erro de saque/ataque/bloqueio/recepcao/defesa pontua para a adversaria', () => {
  ['saque', 'ataque', 'bloqueio', 'recepcao', 'defesa'].forEach(ak =>
    eq(C.coresTerminal(ak, 'Erro'), 'opp', ak));
  eq(C.coresTerminal('ataque', 'Bloq'), 'opp', 'ataque bloqueado');
});
t('erro de LEVANTAMENTO nao pontua (regra do Rodrigo, igual ao app)', () => {
  eq(C.coresTerminal('levantamento', 'Erro'), null);
});
t('toque de qualidade (A/B/C/Cont) nao mexe no placar', () => {
  ['A', 'B', 'C'].forEach(oc => eq(C.coresTerminal('recepcao', oc), null, oc));
  eq(C.coresTerminal('saque', 'Cont'), null);
  eq(C.coresTerminal('ataque', 'Cont'), null);
});

console.log('\n== placar derivado das acoes ==');
t('ace do AZUL: 1x0 e o AZUL segue sacando', () => {
  const r = run([serve('tz', 'z1'), act('tz', 'z1', 'saque', 'Ace', 0)]);
  eq(r.pts, { A: 1, B: 0 });
  eq(r.serve, { side: 'A', jid: 'z1' }, 'manteve o saque');
  eq(r.rally, 1);
});
t('erro de ataque do AZUL da o ponto para a VERMELHA', () => {
  const r = run([serve('tz', 'z1'), act('tz', 'z3', 'ataque', 'Erro', 0)]);
  eq(r.pts, { A: 0, B: 1 });
});
t('acoes de toque nao sobem o placar mas entram na estatistica', () => {
  const r = run([serve('tz', 'z1'),
    act('tz', 'z2', 'recepcao', 'A', 0), act('tz', 'z3', 'levantamento', 'B', 0)]);
  eq(r.pts, { A: 0, B: 0 });
  eq(r.stats.z2.n, 1); eq(r.stats.z3.n, 1);
});

console.log('\n== 2 OPERADORES NO MESMO JOGO (o requisito do evento) ==');
t('DEDUPE: A marca "ataque ponto" e B marca "defesa erro" no mesmo rally -> 1 ponto so', () => {
  const r = run([
    serve('tz', 'z1'),
    act('tz', 'z3', 'ataque', 'Ponto', 0, '-Ev9001'),   // operador do AZUL
    act('tv', 'v2', 'defesa', 'Erro', 0, '-Ev9002')     // operador da VERMELHA, mesmo rally
  ]);
  eq(r.pts, { A: 1, B: 0 }, 'placar');
  eq(r.dupes.length, 1, 'a 2a acao terminal do rally nao pontuou');
  eq(r.stats.z3.n, 1, 'acao do AZUL preservada');
  eq(r.stats.v2.n, 1, 'acao da VERMELHA preservada (vira estatistica)');
});
t('DEDUPE em contradicao: ataque-Ponto do AZUL vs bloqueio-Ponto da VERMELHA -> vence quem gravou primeiro', () => {
  const r = run([
    serve('tz', 'z1'),
    act('tv', 'v1', 'bloqueio', 'Ponto', 0, '-Ev9101'),
    act('tz', 'z3', 'ataque', 'Ponto', 0, '-Ev9102')
  ]);
  eq(r.pts, { A: 0, B: 1 }, 'o primeiro na ordem das chaves define o ponto');
  eq(r.dupes.length, 1);
});
t('os DOIS aparelhos calculam o mesmo placar (mesmo com a lista chegando embaralhada)', () => {
  const base = [
    serve('tz', 'z1', '-Ev1000'),
    act('tz', 'z3', 'ataque', 'Ponto', 0, '-Ev1001'),
    act('tv', 'v2', 'defesa', 'Erro', 0, '-Ev1002'),
    act('tv', 'v1', 'saque', 'Erro', 1, '-Ev1003')
  ];
  const aparelhoA = C.coresComputeGame(GAME, evs(base), TEAMS, CFG);
  const emb = [base[3], base[0], base[2], base[1]];           // ordem de chegada diferente
  const aparelhoB = C.coresComputeGame(GAME, evs(emb), TEAMS, CFG);
  eq(aparelhoA.pts, aparelhoB.pts, 'placar identico');
  eq(aparelhoA.serve, aparelhoB.serve, 'sacador identico');
  eq(aparelhoA.pts, { A: 2, B: 0 });
});
t('nenhuma acao se perde: 20 marcacoes intercaladas dos 2 operadores', () => {
  const list = [serve('tz', 'z1', '-Ev2000')];
  for (let i = 0; i < 10; i++) {
    list.push(act('tz', 'z2', 'recepcao', 'A', i, '-Ev' + (2100 + i * 2)));
    list.push(act('tv', 'v2', 'defesa', 'B', i, '-Ev' + (2101 + i * 2)));
  }
  const r = run(list);
  eq(r.stats.z2.n, 10, 'AZUL');
  eq(r.stats.v2.n, 10, 'VERMELHA');
  eq(r.events.length, 21);
});

/* A trava 2: o outro operador marca o fim do MESMO rally alguns segundos depois
   (ja recebeu o evento do colega, entao gravaria no rally seguinte). Sem a
   janela isso viraria 2 pontos para o mesmo rally. */
function actT(tid, jid, ak, oc, rally, k, ts) { return { k, t: 'act', tid, jid, ak, oc, rally, ts }; }
t('JANELA: operador B marca o fim do mesmo rally 2s depois -> continua 1 ponto', () => {
  const T0 = 1757000000000;
  const r = run([
    serve('tz', 'z1', '-Ew0001'),
    actT('tz', 'z3', 'ataque', 'Ponto', 0, '-Ew0002', T0),        // ponto do AZUL
    actT('tv', 'v2', 'defesa', 'Erro', 1, '-Ew0003', T0 + 2000)   // VERM marca o MESMO rally, atrasado
  ]);
  eq(r.pts, { A: 1, B: 0 }, 'nao virou 2 pontos');
  eq(r.dupes.length, 1);
  eq(r.dupes[0]._dupWhy, 'janela');
  eq(r.stats.v2.n, 1, 'acao preservada como estatistica');
});
t('JANELA nao atrapalha rally novo de verdade (6s depois)', () => {
  const T0 = 1757000000000;
  const r = run([
    serve('tz', 'z1', '-Ew0101'),
    actT('tz', 'z3', 'ataque', 'Ponto', 0, '-Ew0102', T0),
    actT('tv', 'v2', 'ataque', 'Ponto', 1, '-Ew0103', T0 + 6000)
  ]);
  eq(r.pts, { A: 1, B: 1 });
  eq(r.dupes.length, 0);
});
t('JANELA nao bloqueia acao seguida do MESMO operador (rally novo dele)', () => {
  const T0 = 1757000000000;
  const r = run([
    serve('tz', 'z1', '-Ew0201'),
    actT('tz', 'z1', 'saque', 'Ace', 0, '-Ew0202', T0),
    actT('tz', 'z1', 'saque', 'Ace', 1, '-Ew0203', T0 + 1500)   // dois aces rapidos do mesmo aparelho
  ]);
  eq(r.pts, { A: 2, B: 0 }, 'sequencia legitima do proprio operador conta');
});
t('JANELA desligavel (dedupeMs=0) volta ao dedupe so por rally', () => {
  const T0 = 1757000000000;
  const r = run([
    serve('tz', 'z1', '-Ew0301'),
    actT('tz', 'z3', 'ataque', 'Ponto', 0, '-Ew0302', T0),
    actT('tv', 'v2', 'defesa', 'Erro', 1, '-Ew0303', T0 + 2000)
  ], { setPoints: 21, vantagem: 2, emQuadra: 4, dedupeMs: 0 });
  eq(r.pts, { A: 2, B: 0 }, 'sem a janela o rally seguinte pontua');
});

console.log('\n== ordem de saque (rodizio) ==');
t('1a vez que a equipe vai sacar: o app PEDE o sacador (nao chuta)', () => {
  const r = run([serve('tz', 'z1'), act('tz', 'z3', 'ataque', 'Erro', 0)]);
  eq(r.pts, { A: 0, B: 1 });
  eq(r.needServer, 'B', 'pede o 1o sacador da VERMELHA');
  eq(r.serve, null);
});
t('depois do 1o sacador definido, o side-out avanca sozinho no rodizio', () => {
  const r = run([
    serve('tz', 'z1'), act('tz', 'z3', 'ataque', 'Erro', 0),   // ponto VERM, pede sacador
    serve('tv', 'v1'), act('tv', 'v3', 'ataque', 'Erro', 1),   // ponto AZUL (ja sacou: z1) -> z2
    act('tz', 'z2', 'saque', 'Erro', 2)                        // ponto VERM (ja sacou: v1) -> v2
  ]);
  eq(r.pts, { A: 1, B: 2 });
  eq(r.serve, { side: 'B', jid: 'v2' }, 'retomou o rodizio da VERMELHA de onde parou');
});
t('quem esta sacando e pontua MANTEM o sacador', () => {
  const r = run([serve('tz', 'z1'),
    act('tz', 'z1', 'saque', 'Ace', 0), act('tz', 'z3', 'ataque', 'Ponto', 1)]);
  eq(r.pts, { A: 2, B: 0 });
  eq(r.serve, { side: 'A', jid: 'z1' });
});
t('o rodizio e circular: depois do 4o volta para o 1o', () => {
  eq(C.coresNextServer(AZUL, 'z4', C.coresCfg(CFG)), 'z1');
  eq(C.coresNextServer(AZUL, 'z1', C.coresCfg(CFG)), 'z2');
});
t('so os N em quadra entram no rodizio (elenco de 6, jogo 4x4)', () => {
  const seis = { id: 'tz', n: 'AZUL', players: AZUL.players.concat([{ id: 'z5', nm: 'Ivo' }, { id: 'z6', nm: 'Jo' }]) };
  const court = C.coresOnCourt(seis, C.coresCfg(CFG));
  eq(court.length, 4);
  eq(C.coresNextServer(seis, 'z4', C.coresCfg(CFG)), 'z1', 'nao passa para o 5o');
});
t('correcao manual de placar NAO mexe no saque (§4.6 do brief)', () => {
  const r = run([serve('tz', 'z1'), act('tz', 'z1', 'saque', 'Ace', 0), adj('tv', 1)]);
  eq(r.pts, { A: 1, B: 1 });
  eq(r.serve, { side: 'A', jid: 'z1' }, 'sacador intacto');
  eq(r.rally, 1, 'ajuste nao cria rally');
});
t('ajuste manual nunca deixa o placar negativo', () => {
  const r = run([serve('tz', 'z1'), adj('tz', -3)]);
  eq(r.pts, { A: 0, B: 0 });
});
t('"girar saque" manual troca o sacador e o rodizio segue dali', () => {
  const r = run([
    serve('tz', 'z1'), serve('tz', 'z3'),                       // girou na mao para z3
    act('tz', 'z2', 'saque', 'Erro', 0),                        // ponto VERM -> pede
    serve('tv', 'v1'), act('tv', 'v2', 'ataque', 'Erro', 1)     // ponto AZUL: retoma de z3 -> z4
  ]);
  eq(r.serve, { side: 'A', jid: 'z4' });
});

console.log('\n== fim do set ==');
t('21x20 NAO encerra (precisa de 2 de vantagem)', () => {
  const l = [serve('tz', 'z1')];
  for (let i = 0; i < 21; i++) l.push(act('tz', 'z1', 'saque', 'Ace', i));
  for (let i = 21; i < 41; i++) l.push(act('tz', 'z3', 'ataque', 'Erro', i));
  const r = run(l);
  eq(r.pts, { A: 21, B: 20 });
  eq(r.done, false);
});
t('22x20 encerra e aponta o vencedor', () => {
  const l = [serve('tz', 'z1')];
  for (let i = 0; i < 22; i++) l.push(act('tz', 'z1', 'saque', 'Ace', i));
  for (let i = 22; i < 42; i++) l.push(act('tz', 'z3', 'ataque', 'Erro', i));
  const r = run(l);
  eq(r.pts, { A: 22, B: 20 });
  eq(r.done, true); eq(r.winner, 'A'); eq(r.winnerTid, 'tz');
});
t('formato parametrizavel: set ate 15 tambem fecha', () => {
  const l = [serve('tz', 'z1')];
  for (let i = 0; i < 15; i++) l.push(act('tz', 'z1', 'saque', 'Ace', i));
  const r = run(l, { setPoints: 15, vantagem: 2, emQuadra: 4 });
  eq(r.pts, { A: 15, B: 0 }); eq(r.done, true);
});

console.log('\n== estatistica do atleta ==');
t('aproveitamento = acertos / (acertos + erros)', () => {
  const r = run([serve('tz', 'z1'),
    act('tz', 'z3', 'ataque', 'Ponto', 0), act('tz', 'z3', 'ataque', 'Ponto', 1),
    act('tz', 'z3', 'ataque', 'Erro', 2)]);
  const li = C.coresPlayerLine(r.stats.z3);
  eq(li.ac, 2); eq(li.er, 1); eq(li.aprov, 67);
});
t('no saque, colocar em jogo (Cont) ja conta como acerto', () => {
  const r = run([serve('tz', 'z1'),
    act('tz', 'z1', 'saque', 'Cont', 0), act('tz', 'z1', 'saque', 'Ace', 1)]);
  const li = C.coresPlayerLine(r.stats.z1);
  eq(li.ac, 2); eq(li.er, 0); eq(li.aprov, 100);
});

console.log('\n== classificacao automatica ==');
const VERDE = { id: 'tg', n: 'VERDE', cor: '#16a34a', ordem: 2, players: [
  { id: 'g1p', nm: 'Ken' }, { id: 'g2p', nm: 'Lia' }, { id: 'g3p', nm: 'Mel' }, { id: 'g4p', nm: 'Ney' }] };
function placar(gid, a, b, pa, pb, st) {
  const l = [], g = { id: gid, a, b, st: st || 'finalizada' };
  for (let i = 0; i < pa; i++) l.push(act(a, null, 'ataque', 'Ponto', i));
  for (let i = 0; i < pb; i++) l.push(act(b, null, 'ataque', 'Ponto', pa + i));
  return { g, ev: evs(l) };
}
t('vitoria=3 derrota=1, com pontos pro/contra e saldo', () => {
  const j1 = placar('j1', 'tz', 'tv', 21, 15);
  const S = C.coresStandings([j1.g], [AZUL, VERM, VERDE], { j1: j1.ev }, CFG);
  eq(S[0].n, 'AZUL'); eq(S[0].pts, 3); eq(S[0].v, 1); eq(S[0].pp, 21); eq(S[0].pc, 15); eq(S[0].saldo, 6);
  eq(S[1].n, 'VERMELHA'); eq(S[1].pts, 1); eq(S[1].d, 1); eq(S[1].saldo, -6);
  eq(S[2].n, 'VERDE'); eq(S[2].j, 0); eq(S[2].pts, 0);
});
t('jogo NAO finalizado fica fora da classificacao', () => {
  const j = placar('j1', 'tz', 'tv', 10, 8, 'ao_vivo');
  const S = C.coresStandings([j.g], [AZUL, VERM], { j1: j.ev }, CFG);
  eq(S[0].j, 0, 'nenhum jogo contado');
});
t('jogo ao vivo que ja bateu 21 com vantagem entra (o motor detecta o fim)', () => {
  const j = placar('j1', 'tz', 'tv', 21, 10, 'ao_vivo');
  const S = C.coresStandings([j.g], [AZUL, VERM], { j1: j.ev }, CFG);
  eq(S[0].j, 1); eq(S[0].v, 1);
});
t('desempate por saldo quando os pontos empatam', () => {
  const j1 = placar('j1', 'tz', 'tg', 21, 5);    // AZUL +16
  const j2 = placar('j2', 'tv', 'tg', 21, 19);   // VERM +2
  const S = C.coresStandings([j1.g, j2.g], [AZUL, VERM, VERDE], { j1: j1.ev, j2: j2.ev }, CFG);
  eq(S[0].n, 'AZUL'); eq(S[1].n, 'VERMELHA');
  eq(S[0].pts, S[1].pts, 'mesmos pontos');
});
t('desempate final por confronto direto', () => {
  const j1 = placar('j1', 'tz', 'tv', 21, 19);   // AZUL bate VERM
  const j2 = placar('j2', 'tv', 'tz', 21, 19);   // VERM bate AZUL (1v1d cada, saldo/pro iguais)
  const S = C.coresStandings([j1.g, j2.g], [AZUL, VERM], { j1: j1.ev, j2: j2.ev }, CFG);
  eq(S[0].pts, S[1].pts); eq(S[0].saldo, S[1].saldo); eq(S[0].pp, S[1].pp);
  eq(S[0].v, 1); eq(S[1].v, 1);
});
t('pontuacao da classificacao e parametrizavel', () => {
  const j1 = placar('j1', 'tz', 'tv', 21, 15);
  const S = C.coresStandings([j1.g], [AZUL, VERM], { j1: j1.ev }, { setPoints: 21, ptsVitoria: 2, ptsDerrota: 0 });
  eq(S[0].pts, 2); eq(S[1].pts, 0);
});

console.log('\n== ordem do mural ==');
t('ao vivo primeiro, agendados por horario, finalizados por ultimo', () => {
  const g = C.coresOrderGames([
    { id: 'f', st: 'finalizada', dt: '2026-09-05', tm: '08:00' },
    { id: 'a2', st: 'agendada', dt: '2026-09-05', tm: '11:00' },
    { id: 'lv', st: 'ao_vivo', dt: '2026-09-05', tm: '10:00' },
    { id: 'a1', st: 'agendada', dt: '2026-09-05', tm: '09:30' }
  ]);
  eq(g.map(x => x.id), ['lv', 'a1', 'a2', 'f']);
});

console.log('\n' + (fail ? '✗ ' + fail + ' FALHA(S) · ' : '✓ TUDO VERDE · ') + ok + ' testes');
process.exit(fail ? 1 : 0);
