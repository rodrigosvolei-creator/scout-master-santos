/* Modulo "Torneio por Cores" — teste de INTEGRACAO da tela.
   Sobe DOIS aparelhos (duas instancias do cores.html) ligados no MESMO banco
   fake e faz o caminho real do operador: escolher a equipe, iniciar o jogo,
   definir o sacador, clicar no atleta e clicar na acao. Verifica o que aparece
   NA TELA dos dois — nao so o estado interno.
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

/* ---------- banco fake compartilhado pelos dois aparelhos ---------- */
const fakeDB = {};
const listeners = [];        // {path, cb}
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
function btnByText(w, s) {
  const bs = Array.from(w.document.querySelectorAll('button'));
  return bs.find(b => b.textContent.replace(/\s+/g, ' ').indexOf(s) >= 0) || null;
}
function clickText(w, s) {
  const b = btnByText(w, s);
  if (!b) throw new Error('botao nao encontrado na tela: "' + s + '" | tela: ' + txt(w).slice(0, 300));
  b.click();
  return b;
}
/* Botao de acao dentro do bloco do fundamento (ha varios "Erro" na tela). */
function clickAcao(w, fundamento, oc) {
  const boxes = Array.from(w.document.querySelectorAll('.fbox'));
  const box = boxes.find(b => b.querySelector('.fh').textContent.indexOf(fundamento) >= 0);
  if (!box) throw new Error('bloco "' + fundamento + '" nao existe na tela');
  const b = Array.from(box.querySelectorAll('button')).find(x => x.textContent.trim() === oc);
  if (!b) throw new Error('acao "' + oc + '" nao existe em ' + fundamento);
  b.click();
}
/* Placar que ESTA na tela (os dois <div class="pts">). */
function placarNaTela(w) {
  return Array.from(w.document.querySelectorAll('.mesa-side .pts')).map(e => parseInt(e.textContent, 10));
}

/* ---------- semente ---------- */
const AZ = { id: 'tz', n: 'AZUL', cor: '#2563eb', ordem: 0, players: [
  { id: 'z1', nm: 'ANA', nu: 1 }, { id: 'z2', nm: 'BIA', nu: 2 }, { id: 'z3', nm: 'CAU', nu: 3 }, { id: 'z4', nm: 'DORA', nu: 4 }] };
const VM = { id: 'tv', n: 'VERMELHA', cor: '#dc2626', ordem: 1, players: [
  { id: 'v1', nm: 'EDU', nu: 1 }, { id: 'v2', nm: 'FE', nu: 2 }, { id: 'v3', nm: 'GUI', nu: 3 }, { id: 'v4', nm: 'HEL', nu: 4 }] };
fakeDB['torneio-cores'] = {
  config: { nome: 'MINIS POR CORES', setPoints: 21, vantagem: 2, emQuadra: 4, ptsVitoria: 3, ptsDerrota: 1 },
  teams: { tz: AZ, tv: VM },
  games: { j1: { id: 'j1', a: 'tz', b: 'tv', dt: '2026-09-05', tm: '09:00', st: 'agendada' } }
};

(async function () {
  console.log('\n== a tela carrega ==');
  let A, B;
  await t('o app sobe sem erro de JS e mostra o nome do torneio', async () => {
    A = aparelho('?v=mesa&g=j1'); await wait();
    inc(txt(A), 'MINIS POR CORES');
  });
  await t('a mesa pergunta qual equipe este aparelho vai marcar', async () => {
    inc(txt(A), 'QUEM VOCÊ VAI MARCAR?');
    inc(txt(A), 'AZUL'); inc(txt(A), 'VERMELHA');
  });

  console.log('\n== os dois operadores entram ==');
  await t('aparelho 1 escolhe AZUL e ve os atletas dela', async () => {
    clickText(A, 'AZUL'); await wait();
    inc(txt(A), 'VOCÊ MARCA');
    inc(txt(A), 'ANA'); inc(txt(A), 'CAU');
  });
  await t('aparelho 2 abre o MESMO jogo e escolhe VERMELHA', async () => {
    B = aparelho('?v=mesa&g=j1'); await wait();
    clickText(B, 'VERMELHA'); await wait();
    inc(txt(B), 'EDU'); inc(txt(B), 'FE');
  });
  await t('cada aparelho lembra a sua equipe (localStorage separado)', async () => {
    eq(A.localStorage.getItem('cores_tid_j1'), 'tz');
    eq(B.localStorage.getItem('cores_tid_j1'), 'tv');
  });

  console.log('\n== iniciar e definir o saque ==');
  await t('aparelho 1 inicia o jogo e o aparelho 2 recebe em tempo real', async () => {
    clickText(A, 'Iniciar jogo'); await wait();
    eq(getAt('torneio-cores/games/j1/st'), 'ao_vivo');
    if (btnByText(B, 'Iniciar jogo')) throw new Error('aparelho 2 ainda mostra "Iniciar jogo"');
  });
  await t('o app PEDE o sacador e grava ao tocar no atleta', async () => {
    inc(txt(A), 'Toque no atleta que vai sacar');
    clickText(A, 'ANA'); await wait();
    inc(txt(A), 'SACANDO');
  });
  await t('o aparelho 2 tambem ve quem esta sacando', async () => {
    inc(txt(B), 'SACANDO');
    inc(txt(B), 'ANA');
  });

  console.log('\n== marcacao (caminho real: atleta -> acao) ==');
  await t('marcar sem escolher o atleta nao grava', async () => {
    const antes = Object.keys(getAt('torneio-cores/events/j1') || {}).length;
    clickAcao(A, 'Ataque', 'Ponto'); await wait();
    eq(Object.keys(getAt('torneio-cores/events/j1') || {}).length, antes, 'nada gravado');
  });
  await t('AZUL marca ataque-Ponto: 1x0 na tela dos DOIS aparelhos', async () => {
    avancar(12000);
    clickText(A, 'CAU'); await wait();
    clickAcao(A, 'Ataque', 'Ponto'); await wait();
    eq(placarNaTela(A), [1, 0], 'tela do aparelho 1');
    eq(placarNaTela(B), [1, 0], 'tela do aparelho 2');
  });

  console.log('\n== 2 OPERADORES NO MESMO RALLY (o risco do evento) ==');
  await t('VERMELHA marca defesa-Erro do mesmo rally: continua 1x0 (nao vira 2)', async () => {
    avancar(1500);                       // o outro operador marca o MESMO rally, 1,5s depois
    clickText(B, 'FE'); await wait();
    clickAcao(B, 'Defesa', 'Erro'); await wait();
    eq(placarNaTela(A), [1, 0], 'tela do aparelho 1');
    eq(placarNaTela(B), [1, 0], 'tela do aparelho 2');
  });
  await t('as DUAS acoes ficaram gravadas (nenhum operador apagou o outro)', async () => {
    const evs = Object.values(getAt('torneio-cores/events/j1') || {}).filter(e => e.t === 'act');
    eq(evs.length, 2, 'total de acoes');
    eq(evs.filter(e => e.jid === 'z3').length, 1, 'acao do AZUL');
    eq(evs.filter(e => e.jid === 'v2').length, 1, 'acao da VERMELHA');
  });
  await t('a tela avisa que a 2a acao foi so estatistica', async () => {
    inc(txt(B), 'só estatística');
  });
  await t('o saque passou para a VERMELHA e o app pede o 1o sacador dela', async () => {
    avancar(12000);                      // rally seguinte, ritmo de jogo
    clickText(A, 'CAU'); await wait();
    clickAcao(A, 'Ataque', 'Erro'); await wait();          // erro do AZUL = ponto da VERMELHA
    eq(placarNaTela(A), [1, 1]);
    inc(txt(B), 'Toque no atleta que vai sacar');
    inc(txt(A), 'Aguardando o operador');
  });
  await t('definido o sacador da VERMELHA, o rodizio anda sozinho depois', async () => {
    clickText(B, 'EDU'); await wait();
    inc(txt(B), 'SACANDO');
    avancar(12000);
    clickText(B, 'FE'); await wait();
    clickAcao(B, 'Ataque', 'Erro'); await wait();          // erro da VERM = ponto do AZUL
    eq(placarNaTela(A), [2, 1]);
    inc(txt(A), 'SACANDO');
    inc(txt(A), 'BIA');                                     // rodizio do AZUL: ANA -> BIA
  });

  console.log('\n== correcoes ==');
  await t('+1 manual sobe o placar sem mexer no sacador', async () => {
    clickText(A, '+1 AZUL'); await wait();
    eq(placarNaTela(A), [3, 1]);
    inc(txt(A), 'BIA');
  });
  await t('−1 manual desfaz o ajuste', async () => {
    clickText(A, '−1 AZUL'); await wait();
    eq(placarNaTela(A), [2, 1]);
  });
  await t('"desfazer minha ultima" remove SO uma acao do proprio operador', async () => {
    const antes = Object.values(getAt('torneio-cores/events/j1') || {});
    const meusAntes = antes.filter(e => e.tid === 'tz').length;
    const dosOutrosAntes = antes.filter(e => e.tid === 'tv').length;
    clickText(A, 'Desfazer minha última'); await wait();
    const dep = Object.values(getAt('torneio-cores/events/j1') || {});
    eq(dep.filter(e => e.tid === 'tz').length, meusAntes - 1, 'tirou 1 do AZUL');
    eq(dep.filter(e => e.tid === 'tv').length, dosOutrosAntes, 'nao encostou na VERMELHA');
  });

  console.log('\n== fim de jogo e classificacao ==');
  await t('ao bater 21 com vantagem a tela oferece finalizar', async () => {
    for (let i = 0; i < 25; i++) {
      avancar(12000);
      clickText(A, 'CAU'); await wait(2);
      clickAcao(A, 'Ataque', 'Ponto'); await wait(2);
    }
    await wait();
    inc(txt(A), 'Set encerrado');
    if (!btnByText(A, 'Finalizar jogo')) throw new Error('sem botao de finalizar');
  });
  await t('finalizar joga o resultado na classificacao', async () => {
    clickText(A, 'Finalizar jogo'); await wait();
    eq(getAt('torneio-cores/games/j1/st'), 'finalizada');
    const C = aparelho('?v=class'); await wait();
    const tela = txt(C);
    inc(tela, 'CLASSIFICAÇÃO');
    inc(tela, 'AZUL'); inc(tela, 'VERMELHA');
    const linhas = Array.from(C.document.querySelectorAll('table.tb tbody tr'))
      .map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim()));
    if (linhas[0][1].indexOf('AZUL') < 0) throw new Error('AZUL deveria liderar, veio: ' + JSON.stringify(linhas[0]));
    eq(linhas[0][linhas[0].length - 1], '3', 'vitoria vale 3');
    eq(linhas[1][linhas[1].length - 1], '1', 'derrota vale 1');
  });
  await t('o telao mostra o placar e a classificacao', async () => {
    const T = aparelho('?v=telao'); await wait();
    const tela = txt(T);
    inc(tela, 'MINIS POR CORES');
    inc(tela, 'CLASSIFICAÇÃO');
  });

  console.log('\n== admin ==');
  await t('criar equipe por cor pela tela', async () => {
    const AD = aparelho('?v=admin'); await wait();
    AD.document.getElementById('nt-n').value = 'verde';
    AD.document.getElementById('nt-c').value = '#16a34a';
    clickText(AD, 'Criar equipe'); await wait();
    const ts = Object.values(getAt('torneio-cores/teams') || {});
    const nova = ts.find(x => x.n === 'VERDE');
    if (!nova) throw new Error('equipe nao criada. tem: ' + ts.map(x => x.n).join(','));
    eq(nova.cor, '#16a34a');
    eq(nova.players, []);
  });
  await t('adicionar atleta e a ordem da lista virar ordem de saque', async () => {
    const ts = Object.values(getAt('torneio-cores/teams') || {});
    const verde = ts.find(x => x.n === 'VERDE');
    const AD = aparelho('?v=admin'); await wait();
    AD.document.getElementById('np-' + verde.id).value = 'ken';
    const box = AD.document.getElementById('np-' + verde.id).parentElement;
    Array.from(box.querySelectorAll('button')).find(b => b.textContent.indexOf('Atleta') >= 0).click();
    await wait();
    const ps = getAt('torneio-cores/teams/' + verde.id + '/players');
    eq(ps.length, 1); eq(ps[0].nm, 'KEN');
  });
  await t('criar jogo entre duas equipes pela tela', async () => {
    const AD = aparelho('?v=admin'); await wait();
    AD.document.getElementById('ng-a').value = 'tz';
    AD.document.getElementById('ng-b').value = 'tv';
    AD.document.getElementById('ng-dt').value = '2026-09-05';
    clickText(AD, 'Criar jogo'); await wait();
    const gs = Object.values(getAt('torneio-cores/games') || {});
    if (gs.length !== 2) throw new Error('esperava 2 jogos, tem ' + gs.length);
  });

  console.log('\n' + (fail ? '✗ ' + fail + ' FALHA(S) · ' : '✓ TUDO VERDE · ') + ok + ' testes');
  process.exit(fail ? 1 : 0);
})();
