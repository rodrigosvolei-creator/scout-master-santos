/* Modo celular — a tela de marcação que cabe inteira no aparelho.
   Sobe DOIS aparelhos no mesmo banco fake: um no modo celular e outro na mesa
   normal, para provar que gravam o MESMO evento e enxergam o mesmo placar.
   Roda: node tests/test_cores_celular.js  */
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

/* ---------- banco fake compartilhado ---------- */
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
  push(v) { seq++; const k = '-Cel' + String(seq).padStart(5, '0'); setAt(p + '/' + k, v); return Promise.resolve({ key: k }); }
});
const firebaseMock = { initializeApp() { }, database: () => ({ ref: makeRef }) };

const PRETO = { id: 'tp', n: 'PRETO', cor: '#111827', ordem: 0, players: [
  { id: 'p1', nm: 'LUIZA' }, { id: 'p2', nm: 'VINNY' }, { id: 'p3', nm: 'ORELHA' },
  { id: 'p4', nm: 'JOSE' }, { id: 'p5', nm: 'KEL' }] };
const AMAR = { id: 'ta', n: 'AMARELO', cor: '#eab308', ordem: 1, players: [
  { id: 'a1', nm: 'BRUNA' }, { id: 'a2', nm: 'JOAO' }, { id: 'a3', nm: 'ADAL' },
  { id: 'a4', nm: 'ANGEL' }, { id: 'a5', nm: 'GI' }] };
fakeDB['torneio-cores'] = {
  config: { nome: 'Mini Minis - Cores', setPoints: 21, vantagem: 2, emQuadra: 4, ptsVitoria: 3, ptsDerrota: 1, dedupeMs: 4000 },
  teams: { tp: PRETO, ta: AMAR },
  games: { j1: { id: 'j1', a: 'tp', b: 'ta', dt: '2026-09-05', tm: '', st: 'agendada', fase: 'class' } },
  events: {}
};

const html = fs.readFileSync('cores.html', 'utf8')
  .replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>/g, '')
  .replace(/<script src="cores-core\.js[^"]*"><\/script>/, '<script>' + fs.readFileSync('cores-core.js', 'utf8') + '</script>')
  .replace('firebase.initializeApp(fc);', 'var firebase=window.firebaseMock; firebase.initializeApp(fc);');

let CLOCK = 1757000000000;
function aparelho(qs) {
  const dom = new JSDOM(html, {
    url: 'http://localhost/cores.html' + qs, runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w) {
      w.Date.now = () => CLOCK;
      w.firebaseMock = firebaseMock;
      w.confirm = () => true; w.alert = () => { }; w.scrollTo = () => { };
    }
  });
  return dom.window;
}
const wait = ms => new Promise(r => setTimeout(r, ms || 30));
const all = (w, s) => Array.from(w.document.querySelectorAll(s));
const txt = w => (w.document.querySelector('#app') || w.document.body).textContent.replace(/\s+/g, ' ');
function clicaTxt(w, sel, s) {
  const e = all(w, sel).find(x => x.textContent.replace(/\s+/g, ' ').indexOf(s) >= 0);
  if (!e) throw new Error('nao achei ' + sel + ' com "' + s + '" | tela: ' + txt(w).slice(0, 200));
  e.click(); return e;
}

(async () => {
  console.log('\n== modo celular ==');

  const C = aparelho('?v=mesac&g=j1');
  await wait(60);

  await t('a tela abre em modo celular, sem cabecalho do site', () => {
    ok_(C.document.querySelector('.cel'), 'sem o container .cel');
    ok_(!C.document.querySelector('.hd-nav'), 'o menu do site nao devia aparecer aqui');
    ok_(C.document.body.className.indexOf('celular') >= 0, 'falta a classe celular no body');
  });
  await t('o body trava a rolagem', () => {
    const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
    ok_(/body\.celular\{[^}]*overflow:hidden/.test(css), 'body.celular precisa de overflow:hidden');
    ok_(/\.cel\{[^}]*height:100dvh/.test(css), '.cel precisa ocupar a altura da tela');
  });
  await t('pergunta qual equipe eu marco', () => {
    ok_(txt(C).indexOf('Qual equipe você vai marcar') >= 0, txt(C).slice(0, 120));
    eq(all(C, '.cel-esc button').length, 2);
  });

  await t('escolhida a equipe, pede quem saca e a ordem', async () => {
    clicaTxt(C, '.cel-esc button', 'PRETO'); await wait(60);
    ok_(txt(C).indexOf('Qual equipe saca primeiro') >= 0, txt(C).slice(0, 140));
    eq(all(C, '.cel-slot').length, 4, 'quatro posicoes');
    eq(all(C, '.cel-pool button').length, 5, 'os cinco atletas no elenco');
  });

  await t('sem quem saca e sem ordem, nao deixa comecar', () => {
    const b = all(C, '.cel-x').find(x => /Confirmar/.test(x.textContent));
    ok_(b && b.disabled, 'o botao de confirmar tinha que estar travado');
  });

  await t('escolher quem saca e posicionar 4 libera o comeco', async () => {
    clicaTxt(C, '.cel-esc button', 'PRETO'); await wait(60);   /* passo 1 */
    for (let i = 0; i < 4; i++) {
      const livres = all(C, '.cel-pool button').filter(b => !b.disabled);
      livres[0].click(); await wait(25);
    }
    eq(all(C, '.cel-slot.ok').length, 4);
    const b = all(C, '.cel-x').find(x => /Confirmar/.test(x.textContent));
    ok_(b && !b.disabled, 'devia ter liberado');
    b.click(); await wait(70);
    ok_(txt(C).indexOf('Escalação pronta') >= 0, txt(C).slice(0, 140));
  });

  await t('a escalacao gravada e a mesma que a mesa normal grava', () => {
    const evs = Object.values(getAt('torneio-cores/events/j1') || {});
    const lu = evs.find(e => e.t === 'lineup');
    ok_(lu, 'nenhum evento de escalacao');
    eq(lu.tid, 'tp');
    eq(lu.ordem, ['p1', 'p2', 'p3', 'p4']);
    ok_(evs.some(e => e.t === 'first' && e.tid === 'tp'), 'sem o evento de quem saca');
  });

  await t('iniciar o jogo mostra os 6 fundamentos', async () => {
    clicaTxt(C, '.cel-x', 'Iniciar jogo'); await wait(80);
    eq(all(C, '.cel-fund').length, 6, 'os seis fundamentos ficam na tela');
    eq(all(C, '.cel-out').length, 0, 'o resultado so aparece depois de escolher o fundamento');
    eq(all(C, '.cel-p').length, 4, 'os quatro em quadra');
  });

  await t('o sacador ja vem selecionado (o 1o toque do rally e o saque)', () => {
    const sel = all(C, '.cel-p.on');
    eq(sel.length, 1);
    ok_(/LUIZA/.test(sel[0].textContent), sel[0].textContent);
    ok_(/SACA/.test(all(C, '.cel-p.saca')[0].textContent), 'o card do sacador precisa dizer SACA');
  });

  await t('marcar um ace sobe o placar e grava o evento certo', async () => {
    /* atleta -> fundamento -> resultado, como no scout 6x6 */
    all(C, '.cel-fund').find(b => /Saque/.test(b.textContent)).click(); await wait(60);
    eq(all(C, '.cel-out').map(b => b.textContent), ['Ace', 'Erro', 'Cont'], 'so os resultados do saque');
    all(C, '.cel-out').find(b => b.textContent === 'Ace').click();
    await wait(90);
    const ev = Object.values(getAt('torneio-cores/events/j1')).slice(-1)[0];
    eq({ t: ev.t, tid: ev.tid, jid: ev.jid, ak: ev.ak, oc: ev.oc }, { t: 'act', tid: 'tp', jid: 'p1', ak: 'saque', oc: 'Ace' });
    ok_(/1×0|1 × 0/.test(C.document.querySelector('.cel-pl .sc').textContent.replace(/\s+/g, '')) ||
      C.document.querySelector('.cel-pl .sc').textContent.replace(/\D/g, '') === '10', 'placar: ' + C.document.querySelector('.cel-pl .sc').textContent);
  });

  await t('a mesa NORMAL enxerga o mesmo jogo e o mesmo placar', async () => {
    const M = aparelho('?v=mesa&g=j1'); await wait(90);
    ok_(txt(M).indexOf('QUEM VOCÊ VAI MARCAR') >= 0 || txt(M).indexOf('PRETO') >= 0, txt(M).slice(0, 120));
    clicaTxt(M, '.pickteam-btn', 'AMARELO'); await wait(70);
    const placar = all(M, '.mesa-side .pts').map(e => parseInt(e.textContent, 10));
    eq(placar, [1, 0], 'a mesa normal tem que ver o ponto marcado no celular');
  });

  await t('os botoes de ponto sem jogada estao na tela', () => {
    const b = all(C, '.cel-bot .cel-x').map(x => x.textContent.replace(/\s+/g, ' ').trim());
    eq(b.length, 4);
    ok_(b.some(x => /PRETO/.test(x)), b.join(' | '));
    ok_(b.some(x => /AMARELO/.test(x)), b.join(' | '));
    ok_(b.some(x => /Falta/.test(x)), b.join(' | '));
  });

  await t('o painel de baixo abre por cima e traz o que nao coube', async () => {
    C.celAbrirMenu(); await wait(50);
    ok_(C.document.querySelector('.cel-menu'), 'painel nao abriu');
    const bs = all(C, '.cel-menu .mb').map(b => b.textContent.replace(/\s+/g, ' ').trim());
    ['+1 PRETO', '−1 PRETO', '+1 AMARELO', '↻ Girar saque', '⇄ Substituir', '✎ Escalação'].forEach(x =>
      ok_(bs.some(b => b.indexOf(x) >= 0), 'faltou "' + x + '" no painel: ' + bs.join(' | ')));
    ok_(C.document.querySelector('.cel-funds'), 'o painel nao pode substituir a tela de marcacao');
  });

  await t('corrigir placar pelo painel funciona', async () => {
    all(C, '.cel-menu .mb').find(b => /\+1 AMARELO/.test(b.textContent)).click(); await wait(70);
    C.celFecharMenu(); await wait(50);
    const n = C.document.querySelector('.cel-pl .sc').textContent.replace(/\D/g, '');
    eq(n, '11', 'placar depois do +1 no adversario');
  });

  await t('substituir: quem entra assume a posicao de quem saiu', async () => {
    C.celSub(); await wait(60);
    ok_(txt(C).indexOf('Quem sai') >= 0, txt(C).slice(0, 120));
    all(C, '.cel-p')[3].click(); await wait(60);          /* sai o da posicao 4 */
    ok_(txt(C).indexOf('Quem entra') >= 0, txt(C).slice(0, 140));
    all(C, '.cel-aviso .cel-pool button')[0].click(); await wait(110);
    const nomes = all(C, '.cel-p .pn').map(e => e.textContent.trim());
    eq(nomes, ['LUIZA', 'VINNY', 'ORELHA', 'KEL'], 'KEL tinha que entrar na posicao 4');
    eq(all(C, '.cel-fund').length, 6, 'volta para a marcacao depois da troca');
  });

  await t('desfazer apaga so a minha ultima acao', async () => {
    const antes = Object.keys(getAt('torneio-cores/events/j1')).length;
    all(C, '.cel-bot .cel-x').find(b => b.textContent.indexOf('↩') >= 0).click();
    await wait(110);
    eq(Object.keys(getAt('torneio-cores/events/j1')).length, antes - 1);
  });

  await t('fim de set: aparece o aviso e o botao de finalizar', async () => {
    for (let i = 0; i < 25; i++) {
      CLOCK += 14000;
      const b = all(C, '.cel-bot .cel-x').find(x => /\+ PRETO/.test(x.textContent));
      if (!b || b.disabled) break;
      b.click(); await wait(45);
    }
    ok_(txt(C).indexOf('Set encerrado') >= 0, txt(C).slice(0, 160));
    ok_(all(C, '.cel-x').some(b => /Finalizar jogo/.test(b.textContent)), 'faltou o botao de finalizar');
    ok_(!C.document.querySelector('.cel-funds'), 'com o set fechado a grade de acoes sai da tela');
  });

  await t('finalizar joga o resultado na classificacao', async () => {
    all(C, '.cel-x').find(b => /Finalizar jogo/.test(b.textContent)).click(); await wait(120);
    eq(getAt('torneio-cores/games/j1/st'), 'finalizada');
  });

  await t('o mural mostra "Marcar celular" em cada jogo por jogar', async () => {
    setAt('torneio-cores/games/j2', { id: 'j2', a: 'tp', b: 'ta', dt: '2026-09-05', tm: '', st: 'agendada', fase: 'class' });
    const H = aparelho('?'); await wait(110);
    const cards = all(H, '.gcard');
    ok_(cards.length >= 2, 'faltam jogos no mural');
    const porJogar = cards.filter(c => /AGENDADO/.test(c.textContent));
    porJogar.forEach(c => ok_(/Marcar celular/.test(c.textContent), 'card sem o botao: ' + c.textContent.slice(0, 60)));
    const fim = cards.find(c => /FIM/.test(c.textContent));
    if (fim) ok_(!/Marcar celular/.test(fim.textContent), 'jogo encerrado nao precisa do botao');
  });

  await t('o mural no celular nao empilha o placar em cima do nome', () => {
    const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
    const media = css.slice(css.indexOf('@media (max-width:560px)'));
    ok_(/\.gcard\{[^}]*display:grid/.test(media), 'o card do mural precisa virar grade no celular');
    const iBase = css.indexOf('.gcard{display:flex');
    const iCel = css.indexOf('@media (max-width:560px)');
    ok_(iCel > iBase, 'a regra do celular tem que vir DEPOIS da base, senao nao vale');
  });

  await t('zerar o jogo devolve tudo ao estado de agendado', async () => {
    /* nasceu de um caso real: as equipes testam o app antes de comecar e nao
       havia como desfazer sem apagar o jogo e refazer a tabela */
    setAt('torneio-cores/games/j2/st', 'ao_vivo');
    setAt('torneio-cores/events/j2/-x1', { t: 'first', tid: 'tp' });
    setAt('torneio-cores/events/j2/-x2', { t: 'lineup', tid: 'tp', ordem: ['p1','p2','p3','p4'] });
    const Z = aparelho('?v=mesac&g=j2'); await wait(90);
    Z.zerarJogo(); await wait(140);
    eq(getAt('torneio-cores/games/j2/st'), 'agendada');
    eq(getAt('torneio-cores/events/j2'), null, 'as marcacoes tem que sair junto');
  });
  await t('o Admin oferece Zerar so em jogo que ja comecou', async () => {
    setAt('torneio-cores/games/j2/st', 'ao_vivo'); await wait(40);
    const A2 = aparelho('?v=admin'); await wait(140);
    const zerar = all(A2, 'button').filter(b => /Zerar/.test(b.textContent));
    ok_(zerar.length >= 1, 'faltou o botao Zerar no Admin');
    ok_(zerar.every(b => /j1|j2/.test(b.getAttribute('onclick') || '')), 'o botao tem que apontar para um jogo');
  });
  console.log('\n' + (fail ? '✗ ' + fail + ' FALHA(S) · ' : '✓ TUDO VERDE · ') + ok + ' checagens');
  process.exit(fail ? 1 : 0);
})();
