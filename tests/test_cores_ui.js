/* Modulo "Torneio por Cores" — teste de INTEGRACAO da tela.
   Sobe DOIS aparelhos (duas instancias do cores.html) ligados no MESMO banco
   fake e faz o caminho real do operador: escolher a equipe, dizer quem saca,
   posicionar a ordem de saque 1..4, iniciar, marcar, substituir. Verifica o que
   aparece NA TELA dos dois — nao so o estado interno.
   Roda: node tests/test_cores_ui.js  */
const fs = require('fs');
const { JSDOM } = require('jsdom');

let ok = 0, fail = 0;
function t(name, fn) {
  return fn().then(() => { ok++; console.log('  ✓ ' + name); })
    .catch(e => { fail++; console.log('  ✗ ' + name + '\n      ' + (e && e.message)); });
}
function eq(a, b, m) {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A !== B) throw new Error((m ? m + ': ' : '') + 'esperado ' + B + ', veio ' + A);
}
function inc(hay, needle, m) {
  if (String(hay).indexOf(needle) < 0) throw new Error((m ? m + ': ' : '') + 'nao achei "' + needle + '"');
}
function nao(hay, needle, m) {
  if (String(hay).indexOf(needle) >= 0) throw new Error((m ? m + ': ' : '') + 'nao devia ter "' + needle + '"');
}

/* ---------- banco fake compartilhado pelos dois aparelhos ---------- */
const fakeDB = {};
const listeners = [];
let pushSeq = 0;
function parts(p) { return p.split('/').filter(Boolean); }
function getAt(p) { let c = fakeDB; for (const k of parts(p)) { if (c == null) return null; c = c[k]; } return c === undefined ? null : c; }
function setAt(p, v) {
  const a = parts(p); let c = fakeDB;
  for (let i = 0; i < a.length - 1; i++) { if (c[a[i]] == null || typeof c[a[i]] !== 'object') c[a[i]] = {}; c = c[a[i]]; }
  if (v === null) delete c[a[a.length - 1]]; else c[a[a.length - 1]] = JSON.parse(JSON.stringify(v));
  fire();
}
function fire() { listeners.slice().forEach(l => { try { l.cb({ val: () => getAt(l.path) }); } catch (e) { } }); }
function makeRef(p) {
  return {
    _path: p,
    on(ev, cb) { listeners.push({ path: p, cb }); cb({ val: () => getAt(p) }); },
    off() { for (let i = listeners.length - 1; i >= 0; i--) if (listeners[i].path === p) listeners.splice(i, 1); },
    once() { return Promise.resolve({ val: () => getAt(p) }); },
    set(v) { setAt(p, v); return Promise.resolve(); },
    remove() { setAt(p, null); return Promise.resolve(); },
    push(v) { pushSeq++; const k = '-Fake' + String(pushSeq).padStart(6, '0'); setAt(p + '/' + k, v); return Promise.resolve({ key: k }); }
  };
}
const firebaseMock = { initializeApp: () => { }, database: () => ({ ref: makeRef }) };

/* ---------- sobe um "aparelho" ---------- */
const html = fs.readFileSync('cores.html', 'utf8');
const core = fs.readFileSync('cores-core.js', 'utf8');
const htmlMod = html
  .replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>/g, '')
  .replace('<script src="cores-core.js"></script>', '<script>' + core + '</script>')
  .replace('firebase.initializeApp(fc);', 'var firebase=window.firebaseMock; firebase.initializeApp(fc);');

/* Relogio controlado. Sem isso o teste roda tudo em milissegundos e a janela
   anti-ponto-duplo (4s) engoliria pontos legitimos — no jogo real passam
   10-20s entre um ponto e o proximo. avancar() simula esse ritmo. */
let CLOCK = 1757000000000;
function avancar(ms) { CLOCK += ms; }

function aparelho(qs) {
  const dom = new JSDOM(htmlMod, {
    url: 'http://localhost/cores.html' + (qs || ''),
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(w) {
      w.Date.now = () => CLOCK;
      w.firebaseMock = firebaseMock;
      w.confirm = () => true;
      w.alert = () => { };
      w.scrollTo = () => { };
    }
  });
  return dom.window;
}
const wait = (ms) => new Promise(r => setTimeout(r, ms || 25));

/* ---------- helpers de tela ---------- */
function txt(w) { return w.document.body.textContent.replace(/\s+/g, ' '); }
function all(w, sel) { return Array.from(w.document.querySelectorAll(sel)); }
function byText(w, sel, s) {
  return all(w, sel).find(e => e.textContent.replace(/\s+/g, ' ').indexOf(s) >= 0) || null;
}
function click(w, sel, s) {
  const e = byText(w, sel, s);
  if (!e) throw new Error('nao achei ' + sel + ' com "' + s + '" | tela: ' + txt(w).slice(0, 260));
  e.click();
  return e;
}
function clickBtn(w, s) { return click(w, 'button', s); }
/* Botao de acao dentro do bloco do fundamento (ha varios "Erro" na tela). */
function clickAcao(w, fundamento, oc) {
  const box = all(w, '.fbox').find(b => b.querySelector('.fh').textContent.indexOf(fundamento) >= 0);
  if (!box) throw new Error('bloco "' + fundamento + '" nao existe na tela');
  const b = Array.from(box.querySelectorAll('button')).find(x => x.textContent.trim() === oc);
  if (!b) throw new Error('acao "' + oc + '" nao existe em ' + fundamento);
  b.click();
}
function placar(w) { return all(w, '.mesa-side .pts').map(e => parseInt(e.textContent, 10)); }
/* Quem esta em cada posicao, lido dos cards da tela. */
function quadra(w) {
  return all(w, '.pgrid .pbtn').map(b => ({
    pos: b.querySelector('.pos') ? b.querySelector('.pos').textContent.trim() : null,
    nm: b.querySelector('.pn') ? b.querySelector('.pn').textContent.trim() : null,
    saca: b.className.indexOf('serving') >= 0
  }));
}
function slots(w) {
  return all(w, '.slot').map(s => (s.querySelector('.slot-nm') || s.querySelector('.slot-empty')).textContent.trim());
}

/* ---------- semente ---------- */
const AZ = { id: 'tz', n: 'AZUL', cor: '#2563eb', ordem: 0, players: [
  { id: 'z1', nm: 'ANA', nu: 1 }, { id: 'z2', nm: 'BIA', nu: 2 }, { id: 'z3', nm: 'CAUA', nu: 3 },
  { id: 'z4', nm: 'DORA', nu: 4 }, { id: 'z5', nm: 'ENZO', nu: 5 }] };
const VM = { id: 'tv', n: 'VERMELHA', cor: '#dc2626', ordem: 1, players: [
  { id: 'v1', nm: 'EDU', nu: 1 }, { id: 'v2', nm: 'FE', nu: 2 }, { id: 'v3', nm: 'GUI', nu: 3 },
  { id: 'v4', nm: 'HEL', nu: 4 }] };
fakeDB['torneio-cores'] = {
  config: { nome: 'MINIS POR CORES', setPoints: 21, vantagem: 2, emQuadra: 4, ptsVitoria: 3, ptsDerrota: 1 },
  teams: { tz: AZ, tv: VM },
  games: { j1: { id: 'j1', a: 'tz', b: 'tv', dt: '2026-09-05', tm: '09:00', st: 'agendada' } }
};

(async function () {
  let A, B;

  console.log('\n== a tela carrega e pergunta a equipe do aparelho ==');
  await t('o app sobe sem erro de JS e mostra o nome do torneio', async () => {
    A = aparelho('?v=mesa&g=j1'); await wait();
    inc(txt(A), 'MINIS POR CORES');
    inc(txt(A), 'QUEM VOCÊ VAI MARCAR?');
  });
  await t('aparelho 1 escolhe AZUL', async () => {
    click(A, '.pickteam-btn', 'AZUL'); await wait();
    inc(txt(A), 'ANTES DE COMEÇAR');
  });

  console.log('\n== passo 1: qual equipe saca primeiro ==');
  await t('a tela pergunta qual EQUIPE saca (nao qual atleta)', async () => {
    inc(txt(A), 'Qual equipe saca primeiro?');
    eq(all(A, '.teamchoice').length, 2, 'as duas equipes como opcao');
  });
  await t('nao deixa confirmar enquanto nao escolher', async () => {
    const b = byText(A, 'button', 'Confirmar e começar');
    if (!b || !b.disabled) throw new Error('o botao de confirmar deveria estar travado');
  });
  await t('escolher AZUL marca a opcao nos DOIS aparelhos', async () => {
    click(A, '.teamchoice', 'AZUL'); await wait();
    inc(txt(A), '✓ definido');
    eq(getAt('torneio-cores/events/j1') && Object.values(getAt('torneio-cores/events/j1'))[0].t, 'first');
  });

  console.log('\n== passo 2: ordem de saque posicionada 1..4 ==');
  await t('comeca com as 4 posicoes livres', async () => {
    eq(slots(A), ['livre', 'livre', 'livre', 'livre']);
  });
  await t('tocar nos atletas preenche as posicoes na ordem', async () => {
    click(A, '.poolp', 'CAUA'); await wait(5);
    click(A, '.poolp', 'ANA'); await wait(5);
    eq(slots(A), ['CAUA', 'ANA', 'livre', 'livre'], 'posicao 1 e 2');
  });
  await t('tocar na posicao preenchida devolve o atleta para o elenco', async () => {
    click(A, '.slot', 'CAUA'); await wait(5);
    eq(slots(A), ['ANA', 'livre', 'livre', 'livre'], 'a lista compacta');
  });
  await t('completa as 4 posicoes e confirma', async () => {
    click(A, '.poolp', 'BIA'); await wait(5);
    click(A, '.poolp', 'CAUA'); await wait(5);
    click(A, '.poolp', 'DORA'); await wait(5);
    eq(slots(A), ['ANA', 'BIA', 'CAUA', 'DORA']);
    clickBtn(A, 'Confirmar e começar'); await wait();
    const evs = Object.values(getAt('torneio-cores/events/j1'));
    const lu = evs.find(e => e.t === 'lineup');
    eq(lu.ordem, ['z1', 'z2', 'z3', 'z4']);
  });
  await t('o 5o atleta ficou de fora: aparece como RESERVA', async () => {
    inc(txt(A), 'RESERVAS');
    inc(txt(A), 'ENZO');
  });
  await t('quem esta na posicao 1 ja aparece como sacador — sem escolher em lista', async () => {
    const q = quadra(A);
    eq(q.map(x => x.pos), ['1', '2', '3', '4']);
    eq(q[0].nm, 'ANA');
    eq(q[0].saca, true, 'a #1 saca');
    inc(txt(A), '🏐 SACA · ANA');
  });

  console.log('\n== o segundo operador ==');
  await t('aparelho 2 abre o mesmo jogo e ja ve quem saca definido', async () => {
    B = aparelho('?v=mesa&g=j1'); await wait();
    click(B, '.pickteam-btn', 'VERMELHA'); await wait();
    inc(txt(B), '✓ definido', 'passo 1 ja resolvido pelo outro operador');
  });
  await t('aparelho 2 monta a ordem da VERMELHA', async () => {
    ['HEL', 'GUI', 'FE', 'EDU'].forEach(n => click(B, '.poolp', n));
    await wait();
    eq(slots(B), ['HEL', 'GUI', 'FE', 'EDU']);
    clickBtn(B, 'Confirmar e começar'); await wait();
    eq(quadra(B).map(x => x.nm), ['HEL', 'GUI', 'FE', 'EDU']);
  });
  await t('cada aparelho lembra a sua equipe (localStorage separado)', async () => {
    eq(A.localStorage.getItem('cores_tid_j1'), 'tz');
    eq(B.localStorage.getItem('cores_tid_j1'), 'tv');
  });

  console.log('\n== marcacao (atleta -> acao) ==');
  await t('aparelho 1 inicia o jogo e o 2 recebe em tempo real', async () => {
    clickBtn(A, 'Iniciar jogo'); await wait();
    eq(getAt('torneio-cores/games/j1/st'), 'ao_vivo');
    if (byText(B, 'button', 'Iniciar jogo')) throw new Error('aparelho 2 ainda mostra "Iniciar jogo"');
  });
  await t('o sacador ja vem selecionado (o 1o toque do rally e o saque)', async () => {
    const sel = A.document.querySelector('.pbtn.on');
    if (!sel) throw new Error('nenhum atleta pre-selecionado');
    inc(sel.textContent, 'ANA', 'a #1 da escalacao, que esta sacando');
  });
  await t('a selecao volta para o sacador a cada rally novo', async () => {
    avancar(12000);
    click(A, '.pbtn', 'DORA'); await wait();              // operador escolhe outro atleta
    eq(A.document.querySelector('.pbtn.on').textContent.indexOf('DORA') >= 0, true);
    clickAcao(A, 'Saque', 'Ace'); await wait();           // ponto: rally novo
    inc(A.document.querySelector('.pbtn.on').textContent, 'ANA', 'voltou para quem saca');
    clickBtn(A, 'Desfazer minha última'); await wait();   // desfaz para nao mexer no resto
  });
  await t('AZUL marca ataque-Ponto: 1x0 na tela dos DOIS aparelhos', async () => {
    avancar(12000);
    click(A, '.pbtn', 'CAUA'); await wait();
    clickAcao(A, 'Ataque', 'Ponto'); await wait();
    eq(placar(A), [1, 0], 'tela do aparelho 1');
    eq(placar(B), [1, 0], 'tela do aparelho 2');
  });

  console.log('\n== 2 OPERADORES NO MESMO RALLY (o risco do evento) ==');
  await t('VERMELHA marca defesa-Erro do mesmo rally: continua 1x0 (nao vira 2)', async () => {
    avancar(1500);
    click(B, '.pbtn', 'FE'); await wait();
    clickAcao(B, 'Defesa', 'Erro'); await wait();
    eq(placar(A), [1, 0], 'tela do aparelho 1');
    eq(placar(B), [1, 0], 'tela do aparelho 2');
  });
  await t('as DUAS acoes ficaram gravadas (nenhum operador apagou o outro)', async () => {
    const evs = Object.values(getAt('torneio-cores/events/j1') || {}).filter(e => e.t === 'act');
    eq(evs.length, 2);
    eq(evs.filter(e => e.jid === 'z3').length, 1, 'acao do AZUL');
    eq(evs.filter(e => e.jid === 'v2').length, 1, 'acao da VERMELHA');
  });
  await t('a tela avisa que a 2a acao foi so estatistica', async () => {
    inc(txt(B), 'só estatística');
  });

  console.log('\n== rodizio de saque ==');
  await t('perdendo o rally o saque vai para o #1 da adversaria, sem perguntar', async () => {
    avancar(12000);
    click(A, '.pbtn', 'CAUA'); await wait();
    clickAcao(A, 'Ataque', 'Erro'); await wait();          // erro do AZUL = ponto da VERMELHA
    eq(placar(A), [1, 1]);
    inc(txt(A), '🏐 SACA · HEL', 'a #1 da VERMELHA assumiu o saque');
    nao(txt(A), 'Toque no atleta que vai sacar');
  });
  await t('recuperando o saque, o rodizio anda para o #2 da propria equipe', async () => {
    avancar(12000);
    click(B, '.pbtn', 'FE'); await wait();
    clickAcao(B, 'Ataque', 'Erro'); await wait();          // erro da VERM = ponto do AZUL
    eq(placar(A), [2, 1]);
    inc(txt(A), '🏐 SACA · BIA', 'depois de ANA vem BIA');
    eq(quadra(A)[1].saca, true, 'o card da posicao 2 esta marcado como sacador');
  });

  console.log('\n== substituicao ==');
  await t('o botao de substituir aparece quando ha reserva', async () => {
    inc(txt(A), 'RESERVAS');
    if (!byText(A, 'button', 'Substituir')) throw new Error('sem botao de substituir');
  });
  await t('substituir pede quem SAI e depois quem ENTRA', async () => {
    clickBtn(A, 'Substituir'); await wait();
    inc(txt(A), 'toque em quem SAI');
    click(A, '.pbtn', 'CAUA'); await wait();               // sai a da posicao 3
    inc(txt(A), 'Sai CAUA');
    click(A, '.poolp', 'ENZO'); await wait();              // entra o reserva
  });
  await t('o reserva entra na POSICAO de quem saiu', async () => {
    const q = quadra(A);
    eq(q.map(x => x.nm), ['ANA', 'BIA', 'ENZO', 'DORA']);
    eq(q[2].pos, '3');
    inc(txt(A), 'CAUA', 'quem saiu vira reserva');
  });
  await t('o aparelho 2 tambem ve a substituicao (mesmo estado nos dois)', async () => {
    const evs = Object.values(getAt('torneio-cores/events/j1')).filter(e => e.t === 'sub');
    eq(evs.length, 1);
    eq({ out: evs[0].out, in: evs[0].in, tid: evs[0].tid }, { out: 'z3', in: 'z5', tid: 'tz' });
  });
  await t('o rodizio passa por quem entrou', async () => {
    avancar(12000);
    click(A, '.pbtn', 'ANA'); await wait();
    clickAcao(A, 'Saque', 'Erro'); await wait();           // ponto VERM, saque passa
    avancar(12000);
    click(B, '.pbtn', 'HEL'); await wait();
    clickAcao(B, 'Saque', 'Erro'); await wait();           // ponto AZUL: volta o saque
    inc(txt(A), '🏐 SACA · ENZO', 'depois de BIA vem quem entrou na posicao 3');
  });

  console.log('\n== correcoes ==');
  await t('+1 e −1 manuais mexem no placar sem mexer no sacador', async () => {
    const antes = placar(A);
    const bs = all(A, '.ctrls button');
    bs[0].click(); await wait();                    // +1 da propria equipe
    eq(placar(A)[0], antes[0] + 1);
    inc(txt(A), '🏐 SACA · ENZO');
    bs[1].click(); await wait();                    // −1
    eq(placar(A)[0], antes[0]);
  });
  await t('da para corrigir tambem o placar da ADVERSARIA (o operador nao fica preso)', async () => {
    const antes = placar(A);
    const bs = all(A, '.ctrls button');
    bs[2].click(); await wait();                    // +1 da adversaria
    eq(placar(A)[1], antes[1] + 1);
    bs[3].click(); await wait();
    eq(placar(A), antes);
  });
  await t('"Falta da AZUL" da ponto para a VERMELHA sem escolher atleta', async () => {
    avancar(12000);
    const antes = placar(A);
    clickBtn(A, 'Falta da AZUL'); await wait();
    eq(placar(A), [antes[0], antes[1] + 1], 'ponto para a adversaria');
    eq(placar(B), [antes[0], antes[1] + 1], 'igual no outro aparelho');
    const f = Object.values(getAt('torneio-cores/events/j1')).filter(e => e.ak === 'falta');
    eq(f.length, 1); eq(f[0].jid, null, 'sem atleta');
  });
  await t('"desfazer minha ultima" remove SO uma acao do proprio operador', async () => {
    const antes = Object.values(getAt('torneio-cores/events/j1') || {});
    const meus = antes.filter(e => e.tid === 'tz').length;
    const outros = antes.filter(e => e.tid === 'tv').length;
    clickBtn(A, 'Desfazer minha última'); await wait();
    const dep = Object.values(getAt('torneio-cores/events/j1') || {});
    eq(dep.filter(e => e.tid === 'tz').length, meus - 1, 'tirou 1 do AZUL');
    eq(dep.filter(e => e.tid === 'tv').length, outros, 'nao encostou na VERMELHA');
  });
  await t('da para reabrir a escalacao com o jogo em andamento', async () => {
    clickBtn(A, 'Escalação'); await wait();
    inc(txt(A), 'Ordem de saque da AZUL');
    clickBtn(A, 'Cancelar'); await wait();
    inc(txt(A), 'AÇÃO');
  });

  console.log('\n== fim de jogo e classificacao ==');
  await t('ao bater 21 com vantagem a tela oferece finalizar', async () => {
    for (let i = 0; i < 25; i++) {
      avancar(12000);
      click(A, '.pbtn', 'DORA'); await wait(2);
      clickAcao(A, 'Ataque', 'Ponto'); await wait(2);
    }
    await wait();
    inc(txt(A), 'Set encerrado');
    if (!byText(A, 'button', 'Finalizar jogo')) throw new Error('sem botao de finalizar');
  });
  await t('finalizar joga o resultado na classificacao', async () => {
    clickBtn(A, 'Finalizar jogo'); await wait();
    eq(getAt('torneio-cores/games/j1/st'), 'finalizada');
    const C = aparelho('?v=class'); await wait();
    inc(txt(C), 'CLASSIFICAÇÃO');
    const linhas = all(C, 'table.tb tbody tr').map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim()));
    if (linhas[0][1].indexOf('AZUL') < 0) throw new Error('AZUL deveria liderar, veio: ' + JSON.stringify(linhas[0]));
    eq(linhas[0][linhas[0].length - 1], '3', 'vitoria vale 3');
    eq(linhas[1][linhas[1].length - 1], '1', 'derrota vale 1');
  });
  await t('o telao mostra o placar e a classificacao', async () => {
    const T = aparelho('?v=telao'); await wait();
    inc(txt(T), 'MINIS POR CORES');
    inc(txt(T), 'CLASSIFICAÇÃO');
  });

  console.log('\n== admin ==');
  await t('criar equipe por cor pela tela', async () => {
    const AD = aparelho('?v=admin'); await wait();
    AD.document.getElementById('nt-n').value = 'verde';
    AD.document.getElementById('nt-c').value = '#16a34a';
    clickBtn(AD, 'Criar equipe'); await wait();
    const ts = Object.values(getAt('torneio-cores/teams') || {});
    const nova = ts.find(x => x.n === 'VERDE');
    if (!nova) throw new Error('equipe nao criada. tem: ' + ts.map(x => x.n).join(','));
    eq(nova.cor, '#16a34a');
    eq(nova.players, []);
  });
  await t('adicionar atleta na equipe', async () => {
    const verde = Object.values(getAt('torneio-cores/teams') || {}).find(x => x.n === 'VERDE');
    const AD = aparelho('?v=admin'); await wait();
    const inp = AD.document.getElementById('np-' + verde.id);
    inp.value = 'ken';
    Array.from(inp.parentElement.querySelectorAll('button')).find(b => b.textContent.indexOf('Atleta') >= 0).click();
    await wait();
    const ps = getAt('torneio-cores/teams/' + verde.id + '/players');
    eq(ps.length, 1); eq(ps[0].nm, 'KEN');
  });
  await t('criar jogo entre duas equipes pela tela', async () => {
    const AD = aparelho('?v=admin'); await wait();
    AD.document.getElementById('ng-a').value = 'tz';
    AD.document.getElementById('ng-b').value = 'tv';
    AD.document.getElementById('ng-dt').value = '2026-09-05';
    clickBtn(AD, 'Criar jogo'); await wait();
    eq(Object.values(getAt('torneio-cores/games') || {}).length, 2);
  });

  console.log('\n== navegacao ==');
  await t('trocar de tela nao recarrega a pagina (mantem o banco carregado)', async () => {
    const N = aparelho('?v=mesa&g=j1'); await wait();
    const marca = { v: 1 }; N.__marca = marca;              // sobrevive se nao recarregar
    N.go('home'); await wait();
    if (N.__marca !== marca) throw new Error('a pagina recarregou');
    inc(txt(N), 'JOGOS');
    eq(N.location.search.indexOf('v=home') >= 0, true, 'a URL acompanha');
  });
  await t('ao abrir OUTRO jogo a equipe do jogo anterior nao vaza', async () => {
    const gs = Object.values(getAt('torneio-cores/games') || {});
    const outro = gs.find(g => g.id !== 'j1');
    const N = aparelho('?v=mesa&g=' + outro.id); await wait();
    click(N, '.pickteam-btn', 'AZUL'); await wait();
    inc(txt(N), 'você marca a AZUL');                        // jogo novo: cai no setup
    N.go('mesa', '&g=j1'); await wait();
    inc(txt(N), 'QUEM VOCÊ VAI MARCAR?', 'pergunta de novo no outro jogo');
  });
  await t('o botao de trocar equipe existe tambem no setup', async () => {
    const outro = Object.values(getAt('torneio-cores/games') || {}).find(g => g.id !== 'j1');
    const N = aparelho('?v=mesa&g=' + outro.id); await wait();
    click(N, '.pickteam-btn', 'AZUL'); await wait();
    if (!byText(N, 'button', 'Marcar a outra equipe')) throw new Error('sem saida da equipe escolhida');
    clickBtn(N, 'Marcar a outra equipe'); await wait();
    inc(txt(N), 'QUEM VOCÊ VAI MARCAR?');
  });

  console.log('\n' + (fail ? '✗ ' + fail + ' FALHA(S) · ' : '✓ TUDO VERDE · ') + ok + ' testes');
  process.exit(fail ? 1 : 0);
})();
