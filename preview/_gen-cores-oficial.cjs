/* Demo com as 5 cores OFICIAIS do torneio (azul, amarelo, cinza, branco, preto)
   — as tres neutras sao o caso dificil: branco some no tema claro e preto no
   escuro se nao houver contorno e tinta automatica.
   Roda: node preview/_gen-cores-oficial.cjs                                   */
const fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'cores.html'),'utf8');
const core=fs.readFileSync(path.join(ROOT,'cores-core.js'),'utf8');
const T={
  c_azul:   {id:'c_azul',   n:'AZUL',   cor:'#2563eb',ordem:0,players:[{id:'a1',nm:'ANA',nu:1},{id:'a2',nm:'BIA',nu:2},{id:'a3',nm:'CLARA',nu:3},{id:'a4',nm:'DUDA',nu:4},{id:'a5',nm:'ELIS',nu:5}]},
  c_amarelo:{id:'c_amarelo',n:'AMARELO',cor:'#eab308',ordem:1,players:[{id:'m1',nm:'FLAVIA',nu:1},{id:'m2',nm:'GABI',nu:2},{id:'m3',nm:'HELENA',nu:3},{id:'m4',nm:'IARA',nu:4}]},
  c_cinza:  {id:'c_cinza',  n:'CINZA',  cor:'#6b7280',ordem:2,players:[{id:'z1',nm:'JULIA',nu:1},{id:'z2',nm:'KAROL',nu:2},{id:'z3',nm:'LARA',nu:3},{id:'z4',nm:'MAYA',nu:4}]},
  c_branco: {id:'c_branco', n:'BRANCO', cor:'#f8fafc',ordem:3,players:[{id:'b1',nm:'NINA',nu:1},{id:'b2',nm:'OLIVIA',nu:2},{id:'b3',nm:'PAULA',nu:3},{id:'b4',nm:'RAFA',nu:4}]},
  c_preto:  {id:'c_preto',  n:'PRETO',  cor:'#111827',ordem:4,players:[{id:'p1',nm:'SOFIA',nu:1},{id:'p2',nm:'TAIS',nu:2},{id:'p3',nm:'VIVI',nu:3},{id:'p4',nm:'YARA',nu:4}]}
};
const SEED={'torneio-cores':{
  config:{nome:'Mini Minis - Cores',setPoints:21,vantagem:2,emQuadra:4,ptsVitoria:3,ptsDerrota:1,dedupeMs:4000},
  teams:T,
  games:{
    g1:{id:'g1',a:'c_azul',   b:'c_branco', dt:'2026-09-05',tm:'09:00',st:'ao_vivo'},
    g2:{id:'g2',a:'c_preto',  b:'c_amarelo',dt:'2026-09-05',tm:'09:40',st:'agendada'},
    g3:{id:'g3',a:'c_cinza',  b:'c_azul',   dt:'2026-09-05',tm:'10:20',st:'agendada'},
    g0:{id:'g0',a:'c_preto',  b:'c_branco', dt:'2026-09-05',tm:'08:20',st:'finalizada'}
  }, events:{}
}};
let seq=0; const K=()=>'-Seed'+String(++seq).padStart(5,'0');
let clock=new Date('2026-09-05T08:20:00').getTime();
const ev=(st,o)=>{clock+=14000;o.ts=clock;st[K()]=o;};
const POS=[['ataque','Ponto'],['saque','Ace'],['bloqueio','Ponto']];
const ERR=[['ataque','Erro'],['recepcao','Erro'],['saque','Erro'],['defesa','Erro']];
const TOQ=[['recepcao','A'],['recepcao','A'],['recepcao','B'],['recepcao','C'],['levantamento','A'],
           ['levantamento','B'],['defesa','A'],['defesa','B'],['ataque','Cont'],['saque','Cont']];
function monta(gid,ta,tb,alvoA,alvoB){
  const st=SEED['torneio-cores'].events[gid]={};
  const pa=T[ta].players, pb=T[tb].players;
  let r=7, A=0, B=0, rally=0;
  const rnd=()=>(r=(r*9301+49297)%233280)/233280;
  ev(st,{t:'lineup',tid:ta,ordem:pa.slice(0,4).map(p=>p.id)});
  ev(st,{t:'lineup',tid:tb,ordem:pb.slice(0,4).map(p=>p.id)});
  ev(st,{t:'first',tid:ta});
  while(A<alvoA||B<alvoB){
    const daA=(A<alvoA)&&(B>=alvoB||rnd()<0.52);
    for(let i=0;i<(rnd()<0.55?2:1);i++){
      const ps=rnd()<0.5?pa:pb, tid=ps===pa?ta:tb, q=TOQ[Math.floor(rnd()*TOQ.length)];
      ev(st,{t:'act',tid,jid:ps[Math.floor(rnd()*ps.length)].id,ak:q[0],oc:q[1],rally});
    }
    if(rnd()<0.6){ const ps=daA?pa:pb,tid=daA?ta:tb,x=POS[Math.floor(rnd()*POS.length)];
      ev(st,{t:'act',tid,jid:ps[Math.floor(rnd()*ps.length)].id,ak:x[0],oc:x[1],rally}); }
    else { const ps=daA?pb:pa,tid=daA?tb:ta,x=ERR[Math.floor(rnd()*ERR.length)];
      ev(st,{t:'act',tid,jid:ps[Math.floor(rnd()*ps.length)].id,ak:x[0],oc:x[1],rally}); }
    if(daA)A++;else B++; rally++;
  }
}
monta('g0','c_preto','c_branco',21,15);
monta('g1','c_azul','c_branco',12,10);
const SHIM=`<script>(function(){var DBV=${JSON.stringify(SEED)};var LS=[],seq=0;
function P(p){return String(p).split('/').filter(Boolean);}
function get(p){var c=DBV,a=P(p);for(var i=0;i<a.length;i++){if(c==null)return null;c=c[a[i]];}return c===undefined?null:c;}
function set(p,v){var a=P(p),c=DBV;for(var i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}
 if(v===null)delete c[a[a.length-1]];else c[a[a.length-1]]=JSON.parse(JSON.stringify(v));fire();}
function fire(){LS.slice().forEach(function(l){try{l.cb({val:function(){return get(l.path);}});}catch(e){}});}
function ref(p){return{on:function(e,cb){LS.push({path:p,cb:cb});cb({val:function(){return get(p);}});},
 off:function(){for(var i=LS.length-1;i>=0;i--)if(LS[i].path===p)LS.splice(i,1);},
 once:function(){return Promise.resolve({val:function(){return get(p);}});},
 set:function(v){set(p,v);return Promise.resolve();},remove:function(){set(p,null);return Promise.resolve();},
 push:function(v){seq++;var k='-Zdemo'+('00000'+seq).slice(-6);set(p+'/'+k,v);return Promise.resolve({key:k});}};}
window.firebase={initializeApp:function(){},database:function(){return {ref:ref};}};})();<\/script>`;
const out=html
  .replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>\s*/g,'')
  .replace('<script src="cores-core.js"></script>','<script>'+core+'</script>')
  .replace('var EM_OBRAS=true;','var EM_OBRAS=false;')
  .replace('</head>',SHIM+'</head>');
fs.writeFileSync(path.join(__dirname,'cores-oficial.html'),out);
console.log('gerado: preview/cores-oficial.html');
console.log('equipes:',Object.values(T).map(t=>t.n+' '+t.cor).join(' · '));
