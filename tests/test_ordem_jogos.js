// Ordem do mural de jogos (Rodrigo 2026-07-24): "deixar SEMPRE o proximo jogo como
// primeiro card, e ir na sequencia de data e hora... apos finalizado, ir la pra baixo".
// Antes ordenava DECRESCENTE (19:20, 17:10, 14:30) e o "proximo" (14:30) caia por ultimo.
// Regra nova (orderGamesForBoard): AO VIVO no topo -> PROXIMO JOGO -> demais pendentes
// em ordem CRESCENTE de data/hora -> FINALIZADOS la pra baixo.
const fs=require('fs'); const {JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const fakeDB={}; const listeners={};
function getAt(p){const a=p.split('/');let c=fakeDB;for(const k of a){if(c==null)return null;c=c[k];}return c===undefined?null:c;}
function makeRef(p){return{_path:p,on:function(e,cb){listeners[p]=cb;},once:function(){return Promise.resolve({val:()=>getAt(p)});},set:function(){return Promise.resolve();},update:function(){return Promise.resolve();}};}
global.firebaseMock={initializeApp:()=>{},database:()=>({ref:makeRef}),auth:()=>({onAuthStateChanged:function(cb){setTimeout(()=>cb({uid:'m',email:'rodrigosvolei@gmail.com',displayName:'M'}),0);},signInWithPopup:()=>Promise.resolve(),signOut:()=>Promise.resolve()})};

fakeDB['torneio-master-santos']={teams:[],athletes:[],tournaments:[],games:[],invites:{}};
const mod=html.replace(/<script src="https:\/\/www\.gstatic[^"]*"><\/script>/g,'').replace('firebase.initializeApp(fc);','var firebase=window.firebaseMock;firebase.initializeApp(fc);');
const dom=new JSDOM(mod,{url:'https://x/',runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){w.firebaseMock=global.firebaseMock;w.AudioContext=function(){return{createOscillator:()=>({connect:()=>{},frequency:{},start:()=>{},stop:()=>{}}),createGain:()=>({connect:()=>{},gain:{}}),destination:{},currentTime:0};};w.navigator.vibrate=()=>{};w.alert=()=>{};}});
const w=dom.window;
let ok=0,ko=0; function chk(c,m){if(c){ok++;console.log('OK   '+m);}else{ko++;console.log('FAIL '+m);}}
function ids(r){return r.games.map(function(g){return g.id;}).join(',');}

setTimeout(function(){
 try{
  ['teams','games','tournaments','athletes','invites'].forEach(function(k){var p='torneio-master-santos/'+k;if(listeners[p])listeners[p]({val:function(){return getAt(p);}});});
  chk(typeof w.orderGamesForBoard==='function','orderGamesForBoard existe');

  // datas no FUTURO (2030) sao todas "a jogar de agora em diante"; 2019 ja passou.
  // Reproduz a screenshot: 3 jogos "A JOGAR" em 19:20, 17:10, 14:30 (fora de ordem).
  var late ={id:'late', st:'pending',dt:'2030-01-01',tm:'19:20'};
  var mid  ={id:'mid',  st:'pending',dt:'2030-01-01',tm:'17:10'};
  var next ={id:'next', st:'pending',dt:'2030-01-01',tm:'14:30'};

  // 1) So os 3 pendentes: proximo (14:30) primeiro, depois crescente
  var r1=w.orderGamesForBoard([late,mid,next]);
  chk(r1.nextId==='next','proximo jogo = o mais cedo a partir de agora (14:30)');
  chk(ids(r1)==='next,mid,late','ordem: proximo primeiro, depois 14:30<17:10<19:20 crescente (deu '+ids(r1)+')');

  // 2) Com um jogo AO VIVO: live no topo, proximo em seguida
  var live={id:'live',st:'live',dt:'2030-01-01',tm:'20:00'};
  var r2=w.orderGamesForBoard([late,mid,next,live]);
  chk(ids(r2)==='live,next,mid,late','ao vivo no topo, depois o proximo e a fila (deu '+ids(r2)+')');
  chk(r2.nextId==='next','o proximo continua sendo o pendente mais cedo (live nao conta)');

  // 3) Finalizados vao LA PRA BAIXO (mesmo com data mais recente)
  var done1={id:'done1',st:'done',dt:'2030-01-02',tm:'10:00'}; // data futura, mas finalizado
  var done2={id:'done2',st:'done',dt:'2019-05-01',tm:'09:00'};
  var r3=w.orderGamesForBoard([done1,late,next,done2,mid,live]);
  chk(ids(r3)==='live,next,mid,late,done2,done1','vivo>proximo>pendentes(cresc)>finalizados(cresc) (deu '+ids(r3)+')');
  chk(r3.games[r3.games.length-1].st==='done' && r3.games[r3.games.length-2].st==='done','os 2 ultimos cards sao os finalizados');
  chk(r3.games[0].st==='live','o 1o card e o ao vivo');

  // 4) Sem ao vivo: o proximo jogo e literalmente o PRIMEIRO card (pedido do Rodrigo)
  var r4=w.orderGamesForBoard([done1,late,mid,next]);
  chk(r4.games[0].id==='next','sem live, o PROXIMO jogo e o primeiro card');
  chk(r4.games[0].id===r4.nextId,'o primeiro card e exatamente o nextId (ganha a tag PROXIMO JOGO)');

  // 5) Pendentes ATRASADOS (horario ja passou) nao roubam o topo do proximo destacado
  //    Aqui todos os pendentes estao no passado -> nextId = o de horario mais tarde (fallback existente),
  //    e ele deve vir antes dos outros pendentes mesmo tendo data maior.
  var p1={id:'p1',st:'pending',dt:'2019-01-01',tm:'10:00'};
  var p2={id:'p2',st:'pending',dt:'2019-01-01',tm:'12:00'};
  var r5=w.orderGamesForBoard([p1,p2]);
  chk(r5.nextId==='p2','fallback: sem jogo futuro, o "proximo" e o de horario mais tarde');
  chk(r5.games[0].id==='p2','o destacado (nextId) e o primeiro card mesmo sendo o mais tarde');

  // 6) nao muta o array de entrada
  var entrada=[late,mid,next]; var antes=entrada.map(function(g){return g.id;}).join(',');
  w.orderGamesForBoard(entrada);
  chk(entrada.map(function(g){return g.id;}).join(',')===antes,'orderGamesForBoard nao muta o array recebido');

  console.log('\n=== test_ordem_jogos: '+ok+' OK, '+ko+' FAIL ===');
  process.exit(ko>0?1:0);
 }catch(e){console.log('FAIL exception:',e.message);console.log((e.stack||'').split('\n').slice(0,6).join('\n'));process.exit(1);}
},250);
