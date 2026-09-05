/* Confere a trava de publico do modulo, no cenario coerente com a bandeira
   EM_OBRAS do cores.html: se estiver ligada, o publico so pode ver a pagina de
   "em construcao"; se desligada, todo mundo entra em todas as telas.
   Roda: node preview/_obras-check.cjs                                        */
const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('cores.html', 'utf8');
const core = fs.readFileSync('cores-core.js', 'utf8');
const FECHADA = /var EM_OBRAS=true/.test(html);

const mod = html
  .replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>/g, '')
  .replace(/<script src="cores-core\.js[^"]*"><\/script>/, '<script>' + core + '</script>')
  .replace('firebase.initializeApp(fc);', 'var firebase=window.fbm; firebase.initializeApp(fc);');

const db = { 'torneio-cores': { config: { nome: 'Mini Minis - Cores' }, teams: {}, games: {} } };
const ref = p => ({
  on(e, cb) { cb({ val: () => { let c = db; for (const k of p.split('/').filter(Boolean)) { if (c == null) return null; c = c[k]; } return c === undefined ? null : c; } }); },
  off() { }, once() { return Promise.resolve({ val: () => null }); },
  set() { return Promise.resolve(); }, remove() { return Promise.resolve(); }, push() { return Promise.resolve({ key: 'x' }); }
});
const fbm = { initializeApp() { }, database: () => ({ ref }) };

function abrir(qs) {
  const d = new JSDOM(mod, {
    url: 'http://localhost/cores.html' + qs, runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w) { w.fbm = fbm; w.confirm = () => true; w.alert = () => { }; }
  });
  return d.window;
}
const wait = ms => new Promise(r => setTimeout(r, ms || 60));
const lido = w => (w.document.querySelector('#app') || w.document.body).textContent.replace(/\s+/g, ' ');

let ok = 0, fail = 0;
const t = (n, c) => { if (c) { ok++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n); } };

(async () => {
  const pub = abrir('?'); await wait();
  console.log('\n== pagina ' + (FECHADA ? 'FECHADA ao publico' : 'ABERTA ao publico') + ' ==');

  if (FECHADA) {
    t('mostra "EM CONSTRUÇÃO"', lido(pub).includes('EM CONSTRUÇÃO'));
    t('mostra o nome do torneio', lido(pub).includes('Mini Minis'));
    t('leva de volta ao site', !!pub.document.querySelector('a[href*="rsvoleibol.com.br"]'));
    t('NAO mostra o app', !pub.document.querySelector('.hd-nav'));
    t('mesa bloqueada por URL', !abrir('?v=mesa&g=j1').document.querySelector('.mesa-top'));
    t('admin bloqueado por URL', !abrir('?v=admin').document.querySelector('#nt-n'));
    t('telao bloqueado por URL', !abrir('?v=telao').document.querySelector('.tl-main'));
    const dev = abrir('?dev=rs2026'); await wait();
    t('com a chave, entra no app', !!dev.document.querySelector('.hd-nav'));
    t('e o aparelho fica liberado', dev.localStorage.getItem('cores_dev') === '1');
    t('com o selo EM OBRAS no topo', !!dev.document.querySelector('.hd-obras'));
  } else {
    t('o publico entra direto, sem chave', !!pub.document.querySelector('.hd-nav'));
    t('sumiu o aviso de "em construcao"', !lido(pub).includes('EM CONSTRU'));
    t('sumiu o selo EM OBRAS do topo', !pub.document.querySelector('.hd-obras'));
    t('telao abre sem chave', !!abrir('?v=telao').document.querySelector('.tl'));
    t('classificacao abre sem chave', !abrir('?v=class').document.querySelector('.obras-tela'));
    t('relatorio abre sem chave', !abrir('?v=rel').document.querySelector('.obras-tela'));
    t('admin abre sem chave', !abrir('?v=admin').document.querySelector('.obras-tela'));
    t('as abas de navegacao aparecem', pub.document.querySelectorAll('.hd-nav a').length >= 4);
  }

  console.log('\n' + (fail ? '✗ ' + fail + ' FALHA(S) · ' : '✓ TUDO VERDE · ') + ok + ' checagens');
  process.exit(fail ? 1 : 0);
})();
