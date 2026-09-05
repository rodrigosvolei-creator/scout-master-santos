/* App de DEMONSTRACAO para as imagens do manual: mesmas equipes, mesmos atletas
   e a mesma tabela de 10 jogos do torneio de verdade, mas com banco FALSO — as
   telas do manual saem identicas as reais sem tocar em producao.
   Roda: node preview/_gen-manual.cjs                                          */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'cores.html'), 'utf8');
const core = fs.readFileSync(path.join(ROOT, 'cores-core.js'), 'utf8');
const C = require(path.join(ROOT, 'cores-core.js'));

const P = (pref, ns) => ns.map((nm, i) => ({ id: pref + (i + 1), nm: nm, nu: '' }));
const T = {
  c_azul: { id: 'c_azul', n: 'AZUL', cor: '#2563eb', ordem: 0, players: P('az', ['RODRIGO', 'REGIS', 'LU', 'LOBATO', 'POLY']) },
  c_amarelo: { id: 'c_amarelo', n: 'AMARELO', cor: '#eab308', ordem: 1, players: P('am', ['BRUNA', 'JOAO', 'ADAL', 'ANGEL', 'GI']) },
  c_cinza: { id: 'c_cinza', n: 'CINZA', cor: '#6b7280', ordem: 2, players: P('cz', ['MOTTA', 'MIKA', 'IANNAE', 'JOICE', 'CLAUDIO']) },
  c_branco: { id: 'c_branco', n: 'BRANCO', cor: '#f8fafc', ordem: 3, players: P('br', ['GEO', 'FUBA', 'BOLINA', 'MICHELE', 'BILA']) },
  c_preto: { id: 'c_preto', n: 'PRETO', cor: '#111827', ordem: 4, players: P('pr', ['LUIZA', 'VINNY', 'ORELHA', 'JOSE', 'KEL']) }
};

const ts = Object.values(T).sort((a, b) => a.ordem - b.ordem);
const jogos = C.coresTabela(ts, { dt: '2026-09-05', prefixo: 'demo' });
const games = {};
jogos.forEach(g => games[g.id] = g);

const SEED = {
  'torneio-cores': {
    config: { nome: 'Mini Minis - Cores', setPoints: 21, vantagem: 2, emQuadra: 4, ptsVitoria: 3, ptsDerrota: 1, dedupeMs: 4000 },
    teams: T, games: games, events: {}
  }
};

const SHIM = `<script>(function(){var DBV=${JSON.stringify(SEED)};var LS=[],seq=0;
function P(p){return String(p).split('/').filter(Boolean);}
function get(p){var c=DBV,a=P(p);for(var i=0;i<a.length;i++){if(c==null)return null;c=c[a[i]];}return c===undefined?null:c;}
function set(p,v){var a=P(p),c=DBV;for(var i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}
 if(v===null)delete c[a[a.length-1]];else c[a[a.length-1]]=JSON.parse(JSON.stringify(v));fire();}
function fire(){LS.slice().forEach(function(l){try{l.cb({val:function(){return get(l.path);}});}catch(e){}});}
function ref(p){return{on:function(e,cb){LS.push({path:p,cb:cb});cb({val:function(){return get(p);}});},
 off:function(){for(var i=LS.length-1;i>=0;i--)if(LS[i].path===p)LS.splice(i,1);},
 once:function(){return Promise.resolve({val:function(){return get(p);}});},
 set:function(v){set(p,v);return Promise.resolve();},remove:function(){set(p,null);return Promise.resolve();},
 push:function(v){seq++;var k='-Zman'+('00000'+seq).slice(-6);set(p+'/'+k,v);return Promise.resolve({key:k});}};}
window.firebase={initializeApp:function(){},database:function(){return {ref:ref};}};})();<\/script>`;

const out = html
  .replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>\s*/g, '')
  .replace(/<script src="cores-core\.js[^"]*"><\/script>/, '<script>' + core + '</script>')
  .replace('var EM_OBRAS=true;', 'var EM_OBRAS=false;')
  .replace(/rs-leao.png/g, '../rs-leao.png')   /* o arquivo fica em preview/ */
  .replace('</head>', SHIM + '</head>');

fs.writeFileSync(path.join(__dirname, 'manual-app.html'), out);
console.log('gerado: preview/manual-app.html');
console.log('equipes: ' + ts.map(t => t.n + '(' + t.players.length + ')').join(' · '));
console.log('jogos: ' + jogos.length + ' — ' + jogos.map(g => T[g.a].n + 'x' + T[g.b].n).join(', '));
