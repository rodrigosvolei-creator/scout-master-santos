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
function lineup(tid, ordem, k) { return { k, t: 'lineup', tid, ordem }; }
function sub(tid, out, entra, k) { return { k, t: 'sub', tid, out, in: entra }; }
function first(tid, k) { return { k, t: 'first', tid }; }

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
t('1a vez que a equipe vai sacar: entra o #1 da escalacao dela (sem perguntar)', () => {
  const r = run([serve('tz', 'z1'), act('tz', 'z3', 'ataque', 'Erro', 0)]);
  eq(r.pts, { A: 0, B: 1 });
  eq(r.serve, { side: 'B', jid: 'v1' }, 'sacador = 1o da ordem da VERMELHA');
  eq(r.needServer, null, 'nao para o jogo para perguntar');
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

console.log('\n== escalacao (ordem de saque 1..4) ==');
t('a equipe que abre sacando sai da escalacao: saca o #1', () => {
  const r = run([lineup('tz', ['z3', 'z1', 'z4', 'z2']), first('tz')]);
  eq(r.serve, { side: 'A', jid: 'z3' }, 'quem esta na posicao 1');
  eq(r.firstServeSide, 'A');
});
t('o rodizio segue a ordem POSICIONADA, nao a do cadastro', () => {
  const r = run([
    lineup('tz', ['z3', 'z1', 'z4', 'z2']), first('tz'),
    act('tz', 'z3', 'saque', 'Erro', 0),        // ponto VERM, saque passa
    act('tv', 'v2', 'ataque', 'Erro', 1)        // ponto AZUL: proximo do z3 e o z1
  ]);
  eq(r.serve, { side: 'A', jid: 'z1' });
});
t('a escalacao volta ao #1 depois do ultimo', () => {
  const r = run([
    lineup('tz', ['z3', 'z1']), first('tz'),
    act('tz', 'z3', 'saque', 'Erro', 0), act('tv', 'v1', 'saque', 'Erro', 1),
    act('tz', 'z1', 'saque', 'Erro', 2), act('tv', 'v2', 'saque', 'Erro', 3)
  ]);
  eq(r.serve, { side: 'A', jid: 'z3' }, 'circular');
});
t('escolher a equipe que saca NAO aponta sacador antes de posicionar', () => {
  const r = run([first('tz')]);
  eq(r.serve, null, 'nao chuta um nome que o operador nao escolheu');
  eq(r.lineup.A, ['z1', 'z2', 'z3', 'z4'], 'a ordem do cadastro fica como base');
  eq(r.lineupSet.A, false);
});
t('se marcarem sem escalacao, ai sim usa a ordem do cadastro (nao trava o jogo)', () => {
  const r = run([first('tz'), act('tz', 'z1', 'saque', 'Ace', 0)]);
  eq(r.pts, { A: 1, B: 0 });
  eq(r.serve, { side: 'A', jid: 'z1' });
});
t('a adversaria comeca do #1 dela quando recupera o saque', () => {
  const r = run([
    lineup('tz', ['z1', 'z2', 'z3', 'z4']), lineup('tv', ['v4', 'v3', 'v2', 'v1']), first('tz'),
    act('tz', 'z1', 'saque', 'Erro', 0)
  ]);
  eq(r.serve, { side: 'B', jid: 'v4' }, '1o da ordem da VERMELHA');
});
t('REGRESSAO: escolher quem saca ANTES de posicionar (a ordem dos passos na tela)', () => {
  const r = run([first('tz'), lineup('tz', ['z3', 'z1', 'z4', 'z2'])]);
  eq(r.serve, { side: 'A', jid: 'z3' }, 'sacador = posicao 1 da escalacao, nao a do cadastro');
});
t('com o jogo em andamento, mudar a escalacao NAO reinicia o saque', () => {
  const r = run([
    first('tz'), lineup('tz', ['z1', 'z2', 'z3', 'z4']),
    act('tz', 'z1', 'saque', 'Erro', 0),        // ponto VERM, saque vai para v1
    act('tv', 'v1', 'saque', 'Erro', 1),        // ponto AZUL: rodizio -> z2
    lineup('tz', ['z4', 'z3', 'z2', 'z1'])      // operador corrige a ordem no meio do jogo
  ]);
  eq(r.serve, { side: 'A', jid: 'z2' }, 'segue sacando quem estava');
  eq(r.lineup.A, ['z4', 'z3', 'z2', 'z1'], 'mas a ordem nova vale dali pra frente');
});
t('"girar saque" manual nao e desfeito por uma escalacao posterior', () => {
  const r = run([first('tz'), lineup('tz', ['z1', 'z2', 'z3', 'z4']),
    serve('tz', 'z3'), lineup('tz', ['z4', 'z3', 'z2', 'z1'])]);
  eq(r.serve, { side: 'A', jid: 'z3' }, 'a escolha manual manda');
});
t('trocar a escalacao antes do jogo substitui a anterior', () => {
  const r = run([lineup('tz', ['z1', 'z2', 'z3', 'z4']), lineup('tz', ['z4', 'z3', 'z2', 'z1']), first('tz')]);
  eq(r.lineup.A, ['z4', 'z3', 'z2', 'z1']);
  eq(r.serve, { side: 'A', jid: 'z4' });
});

console.log('\n== falta da equipe (rodizio, posicional, conducao...) ==');
t('falta da equipe da ponto para a adversaria', () => {
  const r = run([lineup('tz', ['z1', 'z2', 'z3', 'z4']), first('tz'),
    { t: 'act', tid: 'tz', jid: null, ak: 'falta', oc: 'Erro', rally: 0 }]);
  eq(r.pts, { A: 0, B: 1 });
});
t('falta nao entra na estatistica de nenhum atleta', () => {
  const r = run([lineup('tz', ['z1', 'z2', 'z3', 'z4']), first('tz'),
    { t: 'act', tid: 'tz', jid: null, ak: 'falta', oc: 'Erro', rally: 0 }]);
  eq(Object.keys(r.stats).length, 0);
});
t('falta passa o saque para a adversaria, como qualquer ponto', () => {
  const r = run([lineup('tz', ['z1', 'z2', 'z3', 'z4']), lineup('tv', ['v3', 'v1', 'v2', 'v4']), first('tz'),
    { t: 'act', tid: 'tz', jid: null, ak: 'falta', oc: 'Erro', rally: 0 }]);
  eq(r.serve, { side: 'B', jid: 'v3' });
});
t('falta entra no dedupe como qualquer acao terminal', () => {
  const T0 = 1757000000000;
  const r = run([lineup('tz', ['z1', 'z2', 'z3', 'z4']), first('tz'),
    { k: '-Ex01', t: 'act', tid: 'tz', jid: null, ak: 'falta', oc: 'Erro', rally: 0, ts: T0 },
    { k: '-Ex02', t: 'act', tid: 'tv', jid: 'v1', ak: 'ataque', oc: 'Ponto', rally: 1, ts: T0 + 1500 }
  ]);
  eq(r.pts, { A: 0, B: 1 }, 'os dois operadores marcaram o mesmo rally');
});
t('a falta NAO aparece no painel de fundamentos', () => {
  eq(C.CORES_FUND.indexOf('falta'), -1);
  eq(C.CORES_FUND.length, 6);
});

console.log('\n== substituicao ==');
const SEIS = { id: 'tz', n: 'AZUL', players: AZUL.players.concat([{ id: 'z5', nm: 'Ivo' }]) };
const T6 = { tz: SEIS, tv: VERM };
function run6(list) { return C.coresComputeGame(GAME, evs(list), T6, CFG); }
t('o reserva entra na POSICAO do titular que sai', () => {
  const r = run6([lineup('tz', ['z1', 'z2', 'z3', 'z4']), first('tz'), sub('tz', 'z2', 'z5')]);
  eq(r.lineup.A, ['z1', 'z5', 'z3', 'z4'], 'z5 assumiu a posicao 2');
  eq(r.subs.length, 1);
});
t('depois da substituicao o rodizio passa por quem entrou', () => {
  const r = run6([
    lineup('tz', ['z1', 'z2', 'z3', 'z4']), first('tz'), sub('tz', 'z2', 'z5'),
    act('tz', 'z1', 'saque', 'Erro', 0),      // ponto VERM
    act('tv', 'v1', 'saque', 'Erro', 1)       // ponto AZUL: depois do z1 vem o z5
  ]);
  eq(r.serve, { side: 'A', jid: 'z5' });
});
t('substituir o proprio sacador passa o saque para quem entrou', () => {
  const r = run6([lineup('tz', ['z1', 'z2', 'z3', 'z4']), first('tz'), sub('tz', 'z1', 'z5')]);
  eq(r.serve, { side: 'A', jid: 'z5' });
  eq(r.lineup.A, ['z5', 'z2', 'z3', 'z4']);
});
t('substituicao de quem nao esta em quadra e ignorada', () => {
  const r = run([lineup('tz', ['z1', 'z2', 'z3', 'z4']), sub('tz', 'zX', 'z9')]);
  eq(r.lineup.A, ['z1', 'z2', 'z3', 'z4']);
  eq(r.subs.length, 0);
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

console.log('\n== fases: classificatoria + mata-mata ==');
/* 4 equipes, todas jogaram entre si — monta uma classificacao de verdade. */
const AM = { id: 'ta', n: 'AMARELA', cor: '#eab308', ordem: 3, players: VERM.players };
const VD = { id: 'tg', n: 'VERDE', cor: '#16a34a', ordem: 2, players: AZUL.players };
const Q4 = [AZUL, VERM, VD, AM];
const Q4BY = { tz: AZUL, tv: VERM, tg: VD, ta: AM };
function jogo(id, a, b, pa, pb, fase) {
  const l = [];
  for (let i = 0; i < pa; i++) l.push(act(a, null, 'ataque', 'Ponto', i));
  for (let i = 0; i < pb; i++) l.push(act(b, null, 'ataque', 'Ponto', pa + i));
  return { g: { id, a, b, st: 'finalizada', fase: fase || 'class' }, ev: evs(l) };
}
/* AZUL 9pts, VERM 7, VERDE 5, AMARELA 3 (ordem de chegada garantida) */
const J = [
  jogo('c1', 'tz', 'tv', 21, 10), jogo('c2', 'tz', 'tg', 21, 11), jogo('c3', 'tz', 'ta', 21, 12),
  jogo('c4', 'tv', 'tg', 21, 13), jogo('c5', 'tv', 'ta', 21, 14), jogo('c6', 'tg', 'ta', 21, 15)
];
const JGAMES = J.map(x => x.g);
const JEV = {}; J.forEach(x => { JEV[x.g.id] = x.ev; });
const TAB = C.coresStandings(JGAMES, Q4, JEV, CFG);

t('a classificacao ficou 1o AZUL, 2o VERMELHA, 3o VERDE, 4o AMARELA', () => {
  eq(TAB.map(r => r.n), ['AZUL', 'VERMELHA', 'VERDE', 'AMARELA']);
});
t('FINAL DIRETA: 1o x 2o', () => {
  const b = C.coresBracket(TAB, 'final', false, { prefixo: 'f' });
  eq(b.length, 1);
  eq(b[0].fase, 'final');
  eq([b[0].a, b[0].b], ['tz', 'tv']);
});
t('SEMIFINAIS: 1o x 4o e 2o x 3o, e a final sai das semis', () => {
  const b = C.coresBracket(TAB, 'semi', false, { prefixo: 'f' });
  eq(b.length, 3);
  eq([b[0].a, b[0].b], ['tz', 'ta'], 'SF1 = 1o x 4o');
  eq([b[1].a, b[1].b], ['tv', 'tg'], 'SF2 = 2o x 3o');
  eq(b[2].fase, 'final');
  eq(b[2].a, '', 'a final nasce sem equipes');
  eq(b[2].srcA, { from: 'f_sf1', tipo: 'win' });
  eq(b[2].labelA, 'Vencedor Semifinal 1');
});
t('com disputa de 3o lugar: perdedores das semis', () => {
  const b = C.coresBracket(TAB, 'semi', true, { prefixo: 'f' });
  eq(b.length, 4);
  const t3 = b.find(x => x.fase === 'terceiro');
  eq(t3.srcA, { from: 'f_sf1', tipo: 'lose' });
  eq(t3.srcB, { from: 'f_sf2', tipo: 'lose' });
});
t('semifinal exige 4 equipes classificadas', () => {
  eq(C.coresBracket(TAB.slice(0, 3), 'semi', false, {}), []);
  eq(C.coresBracket(TAB.slice(0, 1), 'final', false, {}), []);
});

t('a final so mostra as equipes quando as semis terminam', () => {
  const b = C.coresBracket(TAB, 'semi', false, { prefixo: 'f' });
  const todos = JGAMES.concat(b);
  let r = C.coresResolveGames(todos, JEV, Q4BY, CFG);
  let fin = r.find(x => x.fase === 'final');
  eq(fin.a, '', 'semis nem comecaram');
  eq(C.coresLadoLabel(fin, 'A', Q4BY), 'Vencedor Semifinal 1');

  const sf1 = jogo('f_sf1', 'tz', 'ta', 21, 9);          // AZUL vence a SF1
  const sf2 = jogo('f_sf2', 'tv', 'tg', 15, 21);         // VERDE vence a SF2
  const ev2 = Object.assign({}, JEV, { f_sf1: sf1.ev, f_sf2: sf2.ev });
  const gs2 = JGAMES.concat([sf1.g, sf2.g, b[2]]);
  r = C.coresResolveGames(gs2, ev2, Q4BY, CFG);
  fin = r.find(x => x.fase === 'final');
  eq([fin.a, fin.b], ['tz', 'tg'], 'AZUL x VERDE');
  eq(C.coresLadoLabel(fin, 'B', Q4BY), 'VERDE');
});
t('a disputa de 3o pega os PERDEDORES das semis', () => {
  const b = C.coresBracket(TAB, 'semi', true, { prefixo: 'f' });
  const sf1 = jogo('f_sf1', 'tz', 'ta', 21, 9);
  const sf2 = jogo('f_sf2', 'tv', 'tg', 15, 21);
  const ev2 = Object.assign({}, JEV, { f_sf1: sf1.ev, f_sf2: sf2.ev });
  const r = C.coresResolveGames([sf1.g, sf2.g].concat(b.filter(x => x.fase !== 'semi')), ev2, Q4BY, CFG);
  const t3 = r.find(x => x.fase === 'terceiro');
  eq([t3.a, t3.b], ['ta', 'tv'], 'AMARELA x VERMELHA');
});
t('semifinal em andamento ainda nao define a final', () => {
  const b = C.coresBracket(TAB, 'semi', false, { prefixo: 'f' });
  const sf1 = { g: { id: 'f_sf1', a: 'tz', b: 'ta', st: 'ao_vivo' }, ev: evs([act('tz', null, 'ataque', 'Ponto', 0)]) };
  const r = C.coresResolveGames([sf1.g, b[2]], { f_sf1: sf1.ev }, Q4BY, CFG);
  eq(r.find(x => x.fase === 'final').a, '');
});

t('jogo de mata-mata NAO entra na classificacao', () => {
  const fin = jogo('fin', 'tz', 'tv', 21, 5, 'final');
  const antes = C.coresStandings(JGAMES, Q4, JEV, CFG);
  const dep = C.coresStandings(JGAMES.concat([fin.g]), Q4,
    Object.assign({}, JEV, { fin: fin.ev }), CFG);
  eq(dep.map(r => [r.n, r.j, r.pts]), antes.map(r => [r.n, r.j, r.pts]), 'tabela intacta');
});
t('jogo sem o campo fase conta como classificatoria (compatibilidade)', () => {
  const g = { id: 'x', a: 'tz', b: 'tv', st: 'finalizada' };
  eq(C.coresFase(g), 'class');
});
t('campeao = vencedor da final', () => {
  const fin = jogo('fin', 'tz', 'tv', 21, 5, 'final');
  eq(C.coresCampeao([fin.g], { fin: fin.ev }, Q4BY, CFG), 'tz');
  const emAberto = { id: 'f2', a: 'tz', b: 'tv', st: 'ao_vivo', fase: 'final' };
  eq(C.coresCampeao([emAberto], {}, Q4BY, CFG), null);
});
t('o mural poe o mata-mata depois da classificatoria', () => {
  const ord = C.coresOrderGames([
    { id: 'fin', fase: 'final', st: 'agendada', dt: '2026-09-05', tm: '08:00' },
    { id: 'c1', fase: 'class', st: 'agendada', dt: '2026-09-05', tm: '11:00' },
    { id: 'sf', fase: 'semi', st: 'agendada', dt: '2026-09-05', tm: '09:00' }
  ]);
  eq(ord.map(x => x.id), ['c1', 'sf', 'fin']);
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
