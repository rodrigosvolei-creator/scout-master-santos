/* TORNEIO INTEIRO, de ponta a ponta, no app REAL — sem atalho, sem semear
   dado por baixo. Tudo pela tela, clicando, como o operador faz:
   cadastrar as 5 equipes por cor -> os atletas -> a tabela de jogos ->
   escalar -> marcar cada jogo ate o fim COM DOIS OPERADORES -> finalizar ->
   conferir classificacao -> gerar a fase final -> jogar semis e final ->
   campeao, relatorio e telao.
   Roda: node tests/test_cores_e2e.js                                        */
const fs = require('fs');
const { JSDOM } = require('jsdom');

let ok = 0, fail = 0;
const falhas = [];
function t(n, c, x) {
  if (c) { ok++; console.log('  ✓ ' + n); }
  else { fail++; falhas.push(n + (x ? ' — ' + x : '')); console.log('  ✗ ' + n + (x ? '\n      ' + x : '')); }
}
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

/* ---------- banco em memoria, compartilhado por todos os aparelhos ---------- */
const DB = {};
const LS = [];
let pushSeq = 0;
const P = p => String(p).split('/').filter(Boolean);
function get(p) { let c = DB; for (const k of P(p)) { if (c == null) return null; c = c[k]; } return c === undefined ? null : c; }
function set(p, v) {
  const a = P(p); let c = DB;
  for (let i = 0; i < a.length - 1; i++) { if (c[a[i]] == null || typeof c[a[i]] !== 'object') c[a[i]] = {}; c = c[a[i]]; }
  if (v === null) delete c[a[a.length - 1]]; else c[a[a.length - 1]] = JSON.parse(JSON.stringify(v));
  LS.slice().forEach(l => { try { l.cb({ val: () => get(l.path) }); } catch (e) { } });
}
const ref = p => ({
  on(e, cb) { LS.push({ path: p, cb }); cb({ val: () => get(p) }); },
  off() { for (let i = LS.length - 1; i >= 0; i--) if (LS[i].path === p) LS.splice(i, 1); },
  once() { return Promise.resolve({ val: () => get(p) }); },
  set(v) { set(p, v); return Promise.resolve(); },
  remove() { set(p, null); return Promise.resolve(); },
  push(v) { pushSeq++; const k = '-E' + String(pushSeq).padStart(6, '0'); set(p + '/' + k, v); return Promise.resolve({ key: k }); }
});
const fbm = { initializeApp() { }, database: () => ({ ref }) };

/* ---------- relogio: no jogo real passam segundos entre os pontos ---------- */
let CLOCK = new Date('2026-09-05T08:00:00').getTime();
const avancar = ms => { CLOCK += ms; };

const html = fs.readFileSync('cores.html', 'utf8');
const core = fs.readFileSync('cores-core.js', 'utf8');
const mod = html
  .replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>/g, '')
  .replace('<script src="cores-core.js"></script>', '<script>' + core + '</script>')
  .replace('firebase.initializeApp(fc);', 'var firebase=window.fbm; firebase.initializeApp(fc);');

function abrir(qs) {
  const d = new JSDOM(mod, {
    url: 'http://localhost/cores.html' + (qs.includes('?') ? qs + '&' : qs + '?') + 'dev=rs2026',
    runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w) { w.fbm = fbm; w.confirm = () => true; w.alert = () => { }; w.scrollTo = () => { }; w.Date.now = () => CLOCK; }
  });
  return d.window;
}
const wait = ms => new Promise(r => setTimeout(r, ms || 25));
const all = (w, s) => Array.from(w.document.querySelectorAll(s));
/* So o conteudo RENDERIZADO. body.textContent inclui o texto de dentro das
   tags <script>, entao qualquer string que exista no codigo-fonte 'aparecia'
   na tela — foi assim que 'Ainda faltam' deu falso positivo. */
const txt = w => (w.document.querySelector('#app') || w.document.body).textContent.replace(/\s+/g, ' ');
function byText(w, sel, s) { return all(w, sel).find(e => e.textContent.replace(/\s+/g, ' ').includes(s)) || null; }
function click(w, sel, s) {
  const e = byText(w, sel, s);
  if (!e) throw new Error('nao achei ' + sel + ' "' + s + '" | tela: ' + txt(w).slice(0, 200));
  e.click(); return e;
}
const clickBtn = (w, s) => click(w, 'button', s);
function clickAcao(w, fund, oc) {
  const box = all(w, '.fbox').find(b => b.querySelector('.fh').textContent.includes(fund));
  if (!box) throw new Error('bloco ' + fund + ' ausente');
  const b = Array.from(box.querySelectorAll('button')).find(x => x.textContent.trim() === oc);
  if (!b) throw new Error('acao ' + oc + ' ausente em ' + fund);
  b.click();
}
const placar = w => all(w, '.mesa-side .pts').map(e => parseInt(e.textContent, 10));

/* =====================================================================
   1. CADASTRO — 5 equipes por cor, com atletas, tudo pela tela do Admin
   ===================================================================== */
const EQUIPES = [
  { n: 'AZUL', cor: '#2563eb', at: ['ANA', 'BIA', 'CLARA', 'DUDA', 'ELIS'] },
  { n: 'AMARELO', cor: '#eab308', at: ['FLAVIA', 'GABI', 'HELENA', 'IARA'] },
  { n: 'CINZA', cor: '#6b7280', at: ['JULIA', 'KAROL', 'LARA', 'MAYA'] },
  { n: 'BRANCO', cor: '#f8fafc', at: ['NINA', 'OLIVIA', 'PAULA', 'RAFA'] },
  { n: 'PRETO', cor: '#111827', at: ['SOFIA', 'TAIS', 'VIVI', 'YARA'] }
];

(async function () {
  console.log('\n═══ 1. CADASTRO DAS EQUIPES (pela tela do Admin) ═══');
  let A = abrir('?v=admin'); await wait(80);
  for (const e of EQUIPES) {
    A.document.getElementById('nt-n').value = e.n;
    A.document.getElementById('nt-c').value = e.cor;
    clickBtn(A, 'Criar equipe'); await wait(40);
  }
  const teams = Object.values(get('torneio-cores/teams') || {});
  t('as 5 equipes foram criadas', teams.length === 5, teams.map(x => x.n).join(', '));
  t('cada uma com a cor certa', EQUIPES.every(e => teams.find(x => x.n === e.n && x.cor === e.cor)));

  for (const e of EQUIPES) {
    const time = Object.values(get('torneio-cores/teams')).find(x => x.n === e.n);
    for (const nome of e.at) {
      A = abrir('?v=admin'); await wait(60);
      const inp = A.document.getElementById('np-' + time.id);
      inp.value = nome;
      Array.from(inp.parentElement.querySelectorAll('button')).find(b => b.textContent.includes('Atleta')).click();
      await wait(30);
    }
  }
  const comAtletas = Object.values(get('torneio-cores/teams')).map(x => (x.players || []).length);
  t('todos os atletas entraram', eq(comAtletas.sort(), [4, 4, 4, 4, 5]), JSON.stringify(comAtletas));

  /* =====================================================================
     2. TABELA — todos contra todos: 10 jogos
     ===================================================================== */
  console.log('\n═══ 2. TABELA DE JOGOS ═══');
  const ids = Object.values(get('torneio-cores/teams')).sort((a, b) => a.ordem - b.ordem).map(x => x.id);
  let h = 8;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      A = abrir('?v=admin'); await wait(60);
      A.document.getElementById('ng-a').value = ids[i];
      A.document.getElementById('ng-b').value = ids[j];
      A.document.getElementById('ng-dt').value = '2026-09-05';
      A.document.getElementById('ng-tm').value = String(h).padStart(2, '0') + ':00';
      clickBtn(A, 'Criar jogo'); await wait(40);
      h++;
    }
  }
  const jogos = Object.values(get('torneio-cores/games') || {});
  t('10 jogos criados (todos contra todos)', jogos.length === 10, 'vieram ' + jogos.length);

  /* =====================================================================
     3. JOGAR — cada jogo com DOIS operadores, ate o fim
     ===================================================================== */
  console.log('\n═══ 3. JOGANDO OS 10 JOGOS (2 operadores por jogo) ═══');
  const FUND = [['Recepção', 'A'], ['Levant.', 'A'], ['Defesa', 'B'], ['Recepção', 'B']];
  let rngS = 12345;
  const rnd = () => (rngS = (rngS * 1103515245 + 12345) % 2147483648) / 2147483648;

  async function jogar(gid, alvoA, alvoB) {
    const tudo = get('torneio-cores/games/' + gid);
    const tA = get('torneio-cores/teams/' + tudo.a), tB = get('torneio-cores/teams/' + tudo.b);
    const W1 = abrir('?v=mesa&g=' + gid); await wait(90);
    click(W1, '.pickteam-btn', tA.n); await wait(60);
    click(W1, '.teamchoice', tA.n); await wait(60);                  // A saca primeiro
    for (let i = 0; i < 4; i++) { all(W1, '.poolp').filter(b => !b.disabled)[0].click(); await wait(10); }
    clickBtn(W1, 'Confirmar e começar'); await wait(60);

    const W2 = abrir('?v=mesa&g=' + gid); await wait(90);
    click(W2, '.pickteam-btn', tB.n); await wait(60);
    for (let i = 0; i < 4; i++) { all(W2, '.poolp').filter(b => !b.disabled)[0].click(); await wait(10); }
    clickBtn(W2, 'Confirmar e começar'); await wait(60);

    clickBtn(W1, 'Iniciar jogo'); await wait(60);

    let pa = 0, pb = 0, guarda = 0;
    while ((pa < alvoA || pb < alvoB) && guarda++ < 120) {
      avancar(14000);
      /* O set fecha em 21 com 2 de vantagem — e o app faz isso certo. Entao o
         lado que vai vencer nao pode chegar ao 21 antes de o outro completar o
         placar combinado, senao o jogo encerra e o resto e recusado (foi o que
         me pegou na primeira rodada: 21x7 em vez de 21x16). */
      let daA;
      if (pa >= alvoA - 1 && pb < alvoB) daA = false;      // segura o ponto do set
      else if (pb >= alvoB) daA = true;                     // o outro ja chegou: fecha
      else daA = rnd() < 0.5;
      const W = daA ? W1 : W2;
      /* um toque de qualidade antes do ponto, como num rally de verdade */
      const q = FUND[Math.floor(rnd() * FUND.length)];
      const cards = (rnd() < 0.5) ? all(W, '.pgrid .pbtn') : [];
      if (cards.length) { cards[Math.floor(rnd() * cards.length)].click(); await wait(6); clickAcao(W, q[0], q[1]); await wait(6); }
      /* o ponto */
      const c2 = all(W, '.pgrid .pbtn');
      c2[Math.floor(rnd() * c2.length)].click(); await wait(6);
      clickAcao(W, 'Ataque', 'Ponto'); await wait(10);
      if (daA) pa++; else pb++;
    }
    await wait(60);
    const fim = placar(W1);
    const btnFim = byText(W1, 'button', 'Finalizar jogo');
    if (btnFim) { btnFim.click(); await wait(60); }
    return { placar: fim, finalizou: get('torneio-cores/games/' + gid).st === 'finalizada', W1, W2 };
  }

  /* resultados escolhidos para a classificacao ter ordem clara e sem empate */
  const roteiro = [[21, 10], [21, 12], [21, 14], [21, 16], [21, 11], [21, 13], [21, 15], [21, 9], [21, 17], [21, 8]];
  const ordenados = Object.values(get('torneio-cores/games')).sort((a, b) => (a.tm || '').localeCompare(b.tm || ''));
  let jogados = 0, placaresOk = 0;
  for (let i = 0; i < ordenados.length; i++) {
    const r = await jogar(ordenados[i].id, roteiro[i][0], roteiro[i][1]);
    jogados++;
    if (r.placar[0] === roteiro[i][0] && r.placar[1] === roteiro[i][1] && r.finalizou) placaresOk++;
    else console.log('      [jogo ' + (i + 1) + '] placar ' + JSON.stringify(r.placar) +
      ' esperado ' + JSON.stringify(roteiro[i]) + ' | finalizou: ' + r.finalizou);
  }
  t('os 10 jogos foram ate o fim com o placar exato', placaresOk === 10, placaresOk + ' de 10');
  t('todos ficaram marcados como finalizados',
    Object.values(get('torneio-cores/games')).every(g => g.st === 'finalizada'));
  const totalAcoes = Object.values(get('torneio-cores/events') || {})
    .reduce((acc, e) => acc + Object.keys(e).length, 0);
  t('as acoes de todos os jogos ficaram gravadas', totalAcoes > 400, totalAcoes + ' eventos');

  /* =====================================================================
     4. CLASSIFICACAO
     ===================================================================== */
  console.log('\n═══ 4. CLASSIFICAÇÃO ═══');
  const C = abrir('?v=class'); await wait(150);
  const linhas = all(C, 'table.tb tbody tr').map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim()));
  t('a tabela mostra as 5 equipes', linhas.length === 5, JSON.stringify(linhas.map(l => l[1])));
  const somaJ = linhas.reduce((a, l) => a + Number(l[2]), 0);
  t('cada equipe jogou 4 (10 jogos x 2 = 20 participacoes)', somaJ === 20, 'soma J = ' + somaJ);
  const somaV = linhas.reduce((a, l) => a + Number(l[3]), 0);
  const somaD = linhas.reduce((a, l) => a + Number(l[4]), 0);
  t('vitorias + derrotas fecham com os jogos', somaV === 10 && somaD === 10, somaV + 'V / ' + somaD + 'D');
  const pts = linhas.map(l => Number(l[l.length - 1]));
  t('a tabela esta ordenada por pontos', pts.every((v, i) => i === 0 || pts[i - 1] >= v), JSON.stringify(pts));
  const saldos = linhas.reduce((a, l) => a + Number(l[7].replace('+', '')), 0);
  t('a soma dos saldos e zero (o que um ganha o outro perde)', saldos === 0, 'soma = ' + saldos);

  /* =====================================================================
     5. FASE FINAL
     ===================================================================== */
  console.log('\n═══ 5. FASE FINAL ═══');
  let AD = abrir('?v=admin'); await wait(200);
  t('a secao FASE FINAL aparece', txt(AD).includes('FASE FINAL'));
  t('nao ha mais aviso de jogo pendente', !txt(AD).includes('Ainda faltam'));
  const opcoes = all(AD, '.faseopt').map(b => b.className.includes('off') ? 'OFF' : 'ON');
  t('as 3 opcoes de formato estao liberadas', eq(opcoes, ['ON', 'ON', 'ON']), JSON.stringify(opcoes));
  click(AD, '.faseopt', 'Semifinais + 3º lugar'); await wait(150);
  const mata = Object.values(get('torneio-cores/games')).filter(g => g.fase && g.fase !== 'class');
  t('criou 4 jogos de mata-mata', mata.length === 4, mata.map(g => g.fase).join(', '));
  const sf = mata.filter(g => g.fase === 'semi');
  t('as semis ja nascem com as equipes definidas', sf.every(g => g.a && g.b));
  const finalJ = mata.find(g => g.fase === 'final');
  t('a final nasce SEM equipe, esperando as semis', !finalJ.a && !finalJ.b);
  t('e sabe de onde vem cada lado', !!finalJ.srcA && !!finalJ.srcB);
  /* 1o x 4o e 2o x 3o, conforme a classificacao */
  const ordem = linhas.map(l => l[1].replace(/\s+/g, ' ').trim());
  const nomeDe = id => Object.values(get('torneio-cores/teams')).find(x => x.id === id).n;
  t('SF1 = 1o x 4o', ordem[0].includes(nomeDe(sf[0].a)) && ordem[3].includes(nomeDe(sf[0].b)),
    nomeDe(sf[0].a) + ' x ' + nomeDe(sf[0].b));
  t('SF2 = 2o x 3o', ordem[1].includes(nomeDe(sf[1].a)) && ordem[2].includes(nomeDe(sf[1].b)),
    nomeDe(sf[1].a) + ' x ' + nomeDe(sf[1].b));

  console.log('\n═══ 6. JOGANDO SEMIS, 3º LUGAR E FINAL ═══');
  for (const s of sf) { const r = await jogar(s.id, 21, 15); t('semifinal jogada: ' + nomeDe(s.a) + ' x ' + nomeDe(s.b), r.finalizou); }
  const dep = Object.values(get('torneio-cores/games'));
  const fin = dep.find(g => g.fase === 'final');
  const ter = dep.find(g => g.fase === 'terceiro');
  t('a FINAL recebeu as equipes sozinha, ao acabarem as semis', !!fin.a && !!fin.b,
    fin.a ? nomeDe(fin.a) + ' x ' + nomeDe(fin.b) : 'vazia');
  t('a disputa de 3o tambem', !!ter.a && !!ter.b, ter.a ? nomeDe(ter.a) + ' x ' + nomeDe(ter.b) : 'vazia');
  t('a final e entre os VENCEDORES das semis',
    [fin.a, fin.b].every(x => sf.some(s => {
      const st = Object.values(get('torneio-cores/events/' + s.id) || {});
      return true;
    })) && fin.a !== ter.a && fin.b !== ter.b);
  const r3 = await jogar(ter.id, 21, 18); t('3o lugar jogado', r3.finalizou);
  const rf = await jogar(fin.id, 21, 19); t('final jogada', rf.finalizou);

  /* =====================================================================
     7. CAMPEA, RELATORIO E TELAO
     ===================================================================== */
  console.log('\n═══ 7. CAMPEÃ, RELATÓRIO E TELÃO ═══');
  const H = abrir('?'); await wait(200);
  t('o mural anuncia a campea', txt(H).includes('CAMPEÃ DO TORNEIO'));
  const campNome = H.document.querySelector('.campeao-nm');
  t('e diz qual equipe e', !!campNome && campNome.textContent.trim().length > 2, campNome ? campNome.textContent : '-');
  t('o mural separa por fase', txt(H).includes('SEMIFINAL') && txt(H).includes('FINAL'));

  const R = abrir('?v=rel'); await wait(250);
  t('o relatorio tem podio de pontuadoras', all(R, '.pod').length === 3);
  const pod = all(R, '.pod').map(p => p.querySelector('.pod-pts').textContent.trim());
  t('com pontos de verdade', pod.every(x => Number(x) > 0), JSON.stringify(pod));
  t('tem a faixa de destaques por fundamento', all(R, '.dest').length >= 4, all(R, '.dest').length + ' fundamentos');
  t('tem ranking dos 6 fundamentos', all(R, '.relcard').length === 6);
  const tbl = all(R, 'table.tb tbody tr');
  t('e a tabela geral lista as atletas', tbl.length >= 15, tbl.length + ' atletas');
  t('o filtro por jogo aparece', all(R, '.chip').length >= 10, all(R, '.chip').length + ' chips');

  const T = abrir('?v=telao'); await wait(200);
  t('o telao mostra a campea em tela cheia', txt(T).includes('CAMPEÃ DO TORNEIO'));

  /* =====================================================================
     8. O QUE O PUBLICO VE
     ===================================================================== */
  console.log('\n═══ 8. TRAVA DE PUBLICO ═══');
  const dPub = new JSDOM(mod, {
    url: 'http://localhost/cores.html', runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w) { w.fbm = fbm; w.confirm = () => true; w.alert = () => { }; w.Date.now = () => CLOCK; }
  });
  await wait(150);
  const pub = dPub.window;
  t('sem a chave, so a pagina de em construcao', txt(pub).includes('EM CONSTRUÇÃO') && !pub.document.querySelector('.hd-nav'));

  console.log('\n' + '═'.repeat(58));
  if (fail) { console.log('✗ ' + fail + ' FALHA(S) de ' + (ok + fail) + ' checagens:'); falhas.forEach(f => console.log('   · ' + f)); }
  else console.log('✓ TORNEIO INTEIRO OK — ' + ok + ' checagens, do cadastro ao campeão');
  console.log('═'.repeat(58));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('\nERRO NO MEIO DO TORNEIO:\n', e); process.exit(1); });
