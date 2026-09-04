/* Gera preview/cores-demo.html — o modulo "Torneio por Cores" com um Firebase
   FALSO em memoria e dados de exemplo. Serve para ver e clicar a interface sem
   depender das regras do RTDB e sem gravar nada em lugar nenhum.
   Roda: node preview/_gen-cores-demo.cjs                                     */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'cores.html'), 'utf8');
const core = fs.readFileSync(path.join(ROOT, 'cores-core.js'), 'utf8');

const SEED = {
  'torneio-cores': {
    config: { nome: 'MINIS POR CORES', setPoints: 21, vantagem: 2, emQuadra: 4, ptsVitoria: 3, ptsDerrota: 1, dedupeMs: 4000 },
    teams: {
      c_az: { id: 'c_az', n: 'AZUL', cor: '#2563eb', ordem: 0, players: [
        { id: 'a1', nm: 'ANA', nu: 1 }, { id: 'a2', nm: 'BIA', nu: 2 }, { id: 'a3', nm: 'CAUÃ', nu: 3 },
        { id: 'a4', nm: 'DORA', nu: 4 }, { id: 'a5', nm: 'ENZO', nu: 5 }] },
      c_vm: { id: 'c_vm', n: 'VERMELHA', cor: '#dc2626', ordem: 1, players: [
        { id: 'v1', nm: 'EDU', nu: 1 }, { id: 'v2', nm: 'FERNANDA', nu: 2 }, { id: 'v3', nm: 'GUI', nu: 3 },
        { id: 'v4', nm: 'HELOÍSA', nu: 4 }, { id: 'v5', nm: 'IGOR', nu: 5 }] },
      c_vd: { id: 'c_vd', n: 'VERDE', cor: '#16a34a', ordem: 2, players: [
        { id: 'g1', nm: 'JOÃO', nu: 1 }, { id: 'g2', nm: 'KAUANE', nu: 2 }, { id: 'g3', nm: 'LARA', nu: 3 },
        { id: 'g4', nm: 'MURILO', nu: 4 }] },
      c_am: { id: 'c_am', n: 'AMARELA', cor: '#eab308', ordem: 3, players: [
        { id: 'y1', nm: 'NINA', nu: 1 }, { id: 'y2', nm: 'OTTO', nu: 2 }, { id: 'y3', nm: 'PAULA', nu: 3 },
        { id: 'y4', nm: 'RAFA', nu: 4 }] }
    },
    games: {
      j1: { id: 'j1', a: 'c_az', b: 'c_vm', dt: '2026-09-05', tm: '09:00', st: 'ao_vivo' },
      j2: { id: 'j2', a: 'c_vd', b: 'c_am', dt: '2026-09-05', tm: '09:40', st: 'agendada' },
      j3: { id: 'j3', a: 'c_az', b: 'c_vd', dt: '2026-09-05', tm: '10:20', st: 'agendada' },
      j0: { id: 'j0', a: 'c_am', b: 'c_vm', dt: '2026-09-05', tm: '08:20', st: 'finalizada' }
    },
    events: {}
  }
};

/* --- jogo j0 ja encerrado (21x17) e o j1 em andamento (13x11), com acoes
       distribuidas entre os atletas para a tela nascer com cara de uso real --- */
let seq = 0;
const K = () => '-Seed' + String(++seq).padStart(5, '0');
let clock = new Date('2026-09-05T08:20:00').getTime();
function ev(store, o) { clock += 14000; o.ts = clock; store[K()] = o; }

const AK_POS = [['ataque', 'Ponto'], ['saque', 'Ace'], ['bloqueio', 'Ponto']];
const AK_ERR = [['ataque', 'Erro'], ['recepcao', 'Erro'], ['saque', 'Erro'], ['defesa', 'Erro']];
const AK_TOQ = [['recepcao', 'A'], ['recepcao', 'B'], ['levantamento', 'A'], ['defesa', 'B'], ['ataque', 'Cont']];

function monta(gid, tidA, tidB, psA, psB, alvoA, alvoB) {
  const store = SEED['torneio-cores'].events[gid] = {};
  let pa = 0, pb = 0, rally = 0;
  let r = 1;
  const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  ev(store, { t: 'serve', tid: tidA, jid: psA[0].id });
  while (pa < alvoA || pb < alvoB) {
    const daA = (pa < alvoA) && (pb >= alvoB || rnd() < 0.52);
    /* alguns toques antes do ponto, para a estatistica nao ficar so de pontos */
    if (rnd() < 0.7) {
      const ps = rnd() < 0.5 ? psA : psB, tid = ps === psA ? tidA : tidB;
      const tq = AK_TOQ[Math.floor(rnd() * AK_TOQ.length)];
      ev(store, { t: 'act', tid, jid: ps[Math.floor(rnd() * ps.length)].id, ak: tq[0], oc: tq[1], rally });
    }
    if (rnd() < 0.6) {   /* ponto por acao positiva de quem venceu */
      const ps = daA ? psA : psB, tid = daA ? tidA : tidB;
      const p = AK_POS[Math.floor(rnd() * AK_POS.length)];
      ev(store, { t: 'act', tid, jid: ps[Math.floor(rnd() * ps.length)].id, ak: p[0], oc: p[1], rally });
    } else {             /* ponto por erro de quem perdeu */
      const ps = daA ? psB : psA, tid = daA ? tidB : tidA;
      const e = AK_ERR[Math.floor(rnd() * AK_ERR.length)];
      ev(store, { t: 'act', tid, jid: ps[Math.floor(rnd() * ps.length)].id, ak: e[0], oc: e[1], rally });
    }
    if (daA) pa++; else pb++;
    rally++;
  }
}
const T = SEED['torneio-cores'].teams;
monta('j0', 'c_am', 'c_vm', T.c_am.players, T.c_vm.players, 21, 17);
monta('j1', 'c_az', 'c_vm', T.c_az.players, T.c_vm.players, 13, 11);

/* --- shim: firebase falso, em memoria, com os mesmos metodos que o app usa --- */
const SHIM = `
<script>
(function(){
  var DBV=${JSON.stringify(SEED)};
  var LS=[]; var seq=0;
  function P(p){return String(p).split('/').filter(Boolean);}
  function get(p){var c=DBV;var a=P(p);for(var i=0;i<a.length;i++){if(c==null)return null;c=c[a[i]];}return c===undefined?null:c;}
  function set(p,v){var a=P(p),c=DBV;for(var i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}
    if(v===null)delete c[a[a.length-1]];else c[a[a.length-1]]=JSON.parse(JSON.stringify(v));fire();}
  function fire(){LS.slice().forEach(function(l){try{l.cb({val:function(){return get(l.path);}});}catch(e){}});}
  function ref(p){return{
    on:function(e,cb){LS.push({path:p,cb:cb});cb({val:function(){return get(p);}});},
    off:function(){for(var i=LS.length-1;i>=0;i--)if(LS[i].path===p)LS.splice(i,1);},
    once:function(){return Promise.resolve({val:function(){return get(p);}});},
    set:function(v){set(p,v);return Promise.resolve();},
    remove:function(){set(p,null);return Promise.resolve();},
    /* prefixo depois de '-Seed' na ordem alfabetica: no RTDB real as chaves de
       push sao cronologicas, e a demo precisa imitar isso para o feed nao inverter */
    push:function(v){seq++;var k='-Zdemo'+('00000'+seq).slice(-6);set(p+'/'+k,v);return Promise.resolve({key:k});}
  };}
  window.firebase={initializeApp:function(){},database:function(){return {ref:ref};}};
})();
</script>
<div style="position:fixed;left:0;right:0;bottom:0;z-index:999;background:#7c2d12;color:#fed7aa;
  font:700 11px Inter,sans-serif;padding:7px 14px;text-align:center;letter-spacing:.4px">
  DEMONSTRAÇÃO — dados de exemplo, nada é salvo. Recarregar a página zera tudo.
</div>
`;

const out = html
  .replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>\s*/g, '')
  .replace('<script src="cores-core.js"></script>', '<script>' + core + '</script>')
  .replace('</head>', SHIM.split('<div style="position:fixed')[0] + '</head>')
  .replace('<div id="app"></div>', '<div id="app"></div>' + '<div style="position:fixed' + SHIM.split('<div style="position:fixed')[1]);

fs.writeFileSync(path.join(__dirname, 'cores-demo.html'), out);
console.log('gerado: preview/cores-demo.html  (' + Math.round(out.length / 1024) + ' KB)');
console.log('jogos:', Object.keys(SEED['torneio-cores'].games).join(', '));
console.log('acoes j1:', Object.keys(SEED['torneio-cores'].events.j1).length,
            '| acoes j0:', Object.keys(SEED['torneio-cores'].events.j0).length);
