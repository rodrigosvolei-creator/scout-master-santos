/* Sanidade do CSS do modulo. Nasceu de um bug real: um "}" orfao sobrou ao
   mover um bloco e o parser descartou a regra SEGUINTE — o .gcard perdeu o
   display:flex e o mural inteiro empilhou na vertical. E um erro invisivel:
   nada quebra, nenhum console reclama, o navegador so ignora em silencio.
   Roda: node tests/test_cores_css.js  */
const fs = require('fs');

let ok = 0, fail = 0;
function t(n, c, extra) {
  if (c) { ok++; console.log('  ✓ ' + n); }
  else { fail++; console.log('  ✗ ' + n + (extra ? '\n      ' + extra : '')); }
}
function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

const html = fs.readFileSync('cores.html', 'utf8');
const css = html.slice(html.indexOf('<style>') + 7, html.indexOf('</style>'));

/* ---- chaves balanceadas ---- */
console.log('\n== chaves do <style> ==');
const linhas = css.split('\n');
let abre = 0, fecha = 0, saldo = 0, linhaRuim = null;
linhas.forEach((ln, i) => {
  const limpo = ln.replace(/\/\*.*?\*\//g, '').replace(/"[^"]*"/g, '').replace(/'[^']*'/g, '');
  for (const ch of limpo) {
    if (ch === '{') { abre++; saldo++; }
    else if (ch === '}') {
      fecha++; saldo--;
      if (saldo < 0 && linhaRuim === null) linhaRuim = i + 1;
    }
  }
});
t('abre e fecha batem (' + abre + ' / ' + fecha + ')', abre === fecha,
  'diferenca de ' + Math.abs(abre - fecha) + ' chave(s)');
t('nenhum "}" sobrando', linhaRuim === null,
  linhaRuim ? 'chave sobrando na linha ' + linhaRuim + ' do <style>: "' + (linhas[linhaRuim - 1] || '').trim() + '"' : '');

/* ---- regras que seguram o layout: se sumirem, a tela empilha sem avisar ---- */
console.log('\n== regras estruturais ==');
[
  ['.gcard', 'display:flex'],
  ['.gc-vs', 'flex:1'],
  ['.mesa-top', 'display:flex'],
  ['.mesa-side', 'flex:1'],
  ['.pgrid', 'display:grid'],
  ['.fgrid', 'display:grid'],
  ['.fbox .fb', 'display:flex'],
  ['.dot', 'display:inline-block'],
  ['.podio', 'display:grid'],
  ['.relgrid', 'display:grid'],
  ['.destgrid', 'display:grid'],
  ['.slots', 'display:grid'],
  ['.pickteam', 'display:grid'],
  ['.obras-tela', 'display:flex'],
  ['.tl', 'display:flex']
].forEach(([sel, prop]) => {
  const re = new RegExp(esc(sel) + '\\s*\\{[^}]*' + esc(prop));
  t(sel + ' mantem ' + prop, re.test(css));
});

/* ---- o tema nao pode sobrescrever componente (a causa do "claro estranho") ---- */
console.log('\n== tema por token, nao por sobrescrita ==');
t('body.claro NAO redefine .btn inteiro', !/body\.claro\s+\.btn\s*\{/.test(css),
  'body.claro .btn vence .btn.pri por especificidade e mata o botao principal');
t('body.claro NAO redefine .slot inteiro', !/body\.claro\s+\.slot\s*\{/.test(css),
  'venceria .slot.filled e a posicao preenchida ficaria igual a vazia');
t('.btn usa var(--btn-bg)', /\.btn\s*\{[^}]*var\(--btn-bg\)/.test(css));

/* ---- tokens definidos nos dois temas ---- */
console.log('\n== tokens nos dois temas ==');
const raiz = (css.match(/:root\s*\{([\s\S]*?)\}/) || [])[1] || '';
const claro = (css.match(/body\.claro\s*\{([\s\S]*?)\}/) || [])[1] || '';
['--btn-bg', '--surf', '--linha', '--halo', '--ok', '--bad', '--info', '--faint', '--mute', '--acc'].forEach(tk => {
  t(tk + ' existe no escuro e no claro', raiz.includes(tk + ':') && claro.includes(tk + ':'));
});

console.log('\n' + (fail ? '✗ ' + fail + ' FALHA(S) · ' : '✓ TUDO VERDE · ') + ok + ' checagens');
process.exit(fail ? 1 : 0);
