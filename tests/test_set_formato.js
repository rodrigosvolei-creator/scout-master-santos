// Formato da partida (bo3/bo5/fixed3) + fim de set automatico (banner) + libero some ao escolher fundamento.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');

const fakeDB = {};
const listeners = {};
function getAt(p){const a=p.split('/');let c=fakeDB;for(const k of a){if(c==null)return null;c=c[k];}return c===undefined?null:c;}
function makeRef(p){return{on:(e,cb)=>{listeners[p]=cb;},once:()=>Promise.resolve({val:()=>getAt(p)}),set:()=>Promise.resolve(),update:()=>Promise.resolve()};}
global.firebaseMock={initializeApp:()=>{},database:()=>({ref:makeRef}),auth:()=>({onAuthStateChanged:cb=>setTimeout(()=>cb({uid:'tester',email:'rodrigosvolei@gmail.com',displayName:'Tester'}),0),signInWithPopup:()=>Promise.resolve(),signOut:()=>Promise.resolve()})};

fakeDB['torneio-master-santos']={
  teams:[{id:'t',n:'RS',c:'#db2777',roster:[{aid:'a1'}]}],
  athletes:[{aid:'a1',nm:'Ana',po:'Ponteira'},{aid:'a2',nm:'Bia',po:'C'},{aid:'a3',nm:'Lui',po:'L'},{aid:'a4',nm:'Car',po:'C'},{aid:'a5',nm:'Dud',po:'O'},{aid:'a6',nm:'Fer',po:'P'},{aid:'a7',nm:'Gi',po:'Líbero'}],
  tournaments:[{id:'tA',n:'L'}],
  games:[
    {id:'g_bo3',torId:'tA',tid:'t',opp:'X',st:'live',format:'bo3',maxSets:3,ss:[{u:0,t:0}],act:[],lineup:[{aid:'a1',nu:1}]},
    {id:'g_bo5',torId:'tA',tid:'t',opp:'Y',st:'live',format:'bo5',maxSets:5,ss:[{u:0,t:0}],act:[],lineup:[{aid:'a1',nu:1}]},
    {id:'g_fix',torId:'tA',tid:'t',opp:'Z',st:'live',format:'fixed3',maxSets:3,ss:[{u:0,t:0}],act:[],lineup:[{aid:'a1',nu:1}]},
    {id:'g_old',torId:'tA',tid:'t',opp:'W',st:'live',maxSets:5,ss:[{u:0,t:0}],act:[],lineup:[{aid:'a1',nu:1}]},
    {id:'g_court',torId:'tA',tid:'t',opp:'Q',st:'live',courtMode:true,format:'bo3',court:{"1":{pos:['a1','a2','a3','a4','a5','a6'],serving:'us'}},ss:[{u:0,t:0}],act:[],lineup:[{aid:'a1',nu:1},{aid:'a2',nu:2},{aid:'a3',nu:3},{aid:'a4',nu:4},{aid:'a5',nu:5},{aid:'a6',nu:6},{aid:'a7',nu:7}]}
  ],invites:{}
};

const mod=html.replace(/<script src="https:\/\/www\.gstatic[^"]*"><\/script>/g,'').replace('firebase.initializeApp(fc);','var firebase=window.firebaseMock;firebase.initializeApp(fc);');
const dom=new JSDOM(mod,{url:'https://x/',runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){w.firebaseMock=global.firebaseMock;w.AudioContext=function(){return{createOscillator:()=>({connect:()=>{},frequency:{},start:()=>{},stop:()=>{}}),createGain:()=>({connect:()=>{},gain:{}}),destination:{},currentTime:0};};w.navigator.vibrate=()=>{};}});
const w=dom.window;
let ok=0,ko=0;function chk(c,m){if(c){ok++;console.log('OK   '+m);}else{ko++;console.log('FAIL '+m);}}

setTimeout(()=>{
 try{
  ['teams','games','tournaments','athletes','invites'].forEach(k=>{const p='torneio-master-santos/'+k;if(listeners[p])listeners[p]({val:()=>getAt(p)});});
  w.isScouter=true;

  // 1. gameFmt / maxSets / target
  chk(w.gameFmt(w.gF('g_bo3'))==='bo3' && w.gameMaxSets(w.gF('g_bo3'))===3,'bo3: 3 sets');
  chk(w.gameFmt(w.gF('g_bo5'))==='bo5' && w.gameMaxSets(w.gF('g_bo5'))===5,'bo5: 5 sets');
  chk(w.gameFmt(w.gF('g_fix'))==='fixed3','fixed3 reconhecido');
  chk(w.gameFmt(w.gF('g_old'))==='bo5','compat: jogo antigo maxSets=5 vira bo5');

  // 2. setTarget — tie no ultimo set de bo3/bo5; fixed3 sempre 25
  chk(w.setTarget(w.gF('g_bo3'),1)===25 && w.setTarget(w.gF('g_bo3'),3)===15,'bo3: set 1=25, set 3=15 (tie)');
  chk(w.setTarget(w.gF('g_bo5'),4)===25 && w.setTarget(w.gF('g_bo5'),5)===15,'bo5: set 4=25, set 5=15 (tie)');
  chk(w.setTarget(w.gF('g_fix'),3)===25,'fixed3: set 3 = 25 (sem tie)');

  // 3. setIsOver — regra 25 com 2 de vantagem
  var g=w.gF('g_bo3');
  g.ss=[{u:25,t:23}]; chk(w.setIsOver(g,1),'25-23 = set encerrado');
  g.ss=[{u:25,t:24}]; chk(!w.setIsOver(g,1),'25-24 = NAO encerrado (precisa 2 de vantagem)');
  g.ss=[{u:26,t:24}]; chk(w.setIsOver(g,1),'26-24 = encerrado');
  g.ss=[{u:24,t:23}]; chk(!w.setIsOver(g,1),'24-23 = NAO encerrado (nao atingiu 25)');
  // tie break set 3 (alvo 15)
  g.ss=[{u:25,t:20},{u:20,t:25},{u:15,t:13}]; chk(w.setIsOver(g,3),'tie: 15-13 = encerrado');
  g.ss=[{u:25,t:20},{u:20,t:25},{u:15,t:14}]; chk(!w.setIsOver(g,3),'tie: 15-14 = NAO (precisa 2)');
  g.ss=[{u:25,t:20},{u:20,t:25},{u:16,t:14}]; chk(w.setIsOver(g,3),'tie: 16-14 = encerrado');

  // 4. gameIsDecided — bo3 decide com 2 sets; fixed3 nunca cedo
  var gd=w.gF('g_bo3'); gd.ss=[{u:25,t:10},{u:25,t:12}]; chk(w.gameIsDecided(gd),'bo3: 2-0 = jogo decidido');
  gd.ss=[{u:25,t:10},{u:10,t:25}]; chk(!w.gameIsDecided(gd),'bo3: 1-1 = nao decidido');
  var gf=w.gF('g_fix'); gf.ss=[{u:25,t:10},{u:25,t:12}]; chk(!w.gameIsDecided(gf),'fixed3: 2-0 NAO decide (joga os 3)');

  // 5. nxS respeita o limite do formato
  var gb=w.gF('g_bo3'); gb.ss=[{u:25,t:10},{u:25,t:12},{u:15,t:13}]; w.S={aid:'g_bo3',sp:null,sa:null,cs:3,us:[],tm:0,rn:false,ti:null};
  w.nxS(); chk(w.gF('g_bo3').ss.length===3,'bo3: nxS bloqueia 4o set');
  // set atual precisa estar jogado (25-20) — nxS trava se ainda esta 0-0 (fix dos sets fantasma, ver test_sets.js)
  var gb5=w.gF('g_bo5'); gb5.ss=[{u:25,t:20}]; w.S={aid:'g_bo5',sp:null,sa:null,cs:1,us:[],tm:0,rn:false,ti:null};
  w.nxS(); chk(w.gF('g_bo5').ss.length===2,'bo5: nxS permite ate 5 sets (set atual jogado)');
  // e TRAVA se o set atual ainda esta 0-0 (nao empilha set fantasma)
  var gb5b=w.gF('g_bo5'); gb5b.ss=[{u:25,t:20},{u:0,t:0}]; gb5b.act=[]; w.S={aid:'g_bo5',sp:null,sa:null,cs:2,us:[],tm:0,rn:false,ti:null};
  w.nxS(); chk(w.gF('g_bo5').ss.length===2,'bo5: nxS TRAVA em set 0-0 (nao cria fantasma)');

  // 6. Banner de fim de set no rSct (jogo com set encerrado)
  var gban=w.gF('g_bo3'); gban.ss=[{u:25,t:23}]; w.S={aid:'g_bo3',sp:null,sa:null,cs:1,us:[],tm:0,rn:false,ti:null};
  var hb=w.rSct();
  chk(hb.indexOf('set-end-banner')>=0,'rSct: banner de fim de set aparece (25-23)');
  chk(hb.indexOf('Iniciar Set 2')>=0,'banner: botao "Iniciar Set 2" (jogo nao decidido)');
  // jogo decidido -> botao Finalizar
  gban.ss=[{u:25,t:10},{u:25,t:12}]; w.S.cs=2;
  var hb2=w.rSct();
  chk(hb2.indexOf('Finalizar jogo')>=0,'banner: 2-0 em bo3 -> botao Finalizar jogo');
  // set NAO encerrado -> sem banner
  gban.ss=[{u:10,t:8}]; w.S.cs=1;
  chk(w.rSct().indexOf('set-end-banner')<0,'set em andamento: SEM banner');

  // 7. Item libero: faixa some ao escolher fundamento (S.sa setado)
  w.S={aid:'g_court',sp:'a1',sa:null,cs:1,us:[],tm:0,rn:false,ti:null}; // atleta selecionado, sem fundamento
  var hc=w.courtRenderPanel(w.gF('g_court'),[{id:'a1',nu:1,nm:'Ana',po:'P'},{id:'a2',nu:2,nm:'Bia',po:'C'},{id:'a3',nu:3,nm:'Lui',po:'L'},{id:'a4',nu:4,nm:'Car',po:'C'},{id:'a5',nu:5,nm:'Dud',po:'O'},{id:'a6',nu:6,nm:'Fer',po:'P'},{id:'a7',nu:7,nm:'Gi',po:'Líbero'}],{c:'#db2777'});
  chk(hc.indexOf('court-lib-swap')>=0,'libero: faixa aparece ao selecionar atleta (sem fundamento)');
  w.S.sa='ataque'; // escolheu fundamento
  var hc2=w.courtRenderPanel(w.gF('g_court'),[{id:'a1',nu:1,nm:'Ana',po:'P'},{id:'a2',nu:2,nm:'Bia',po:'C'},{id:'a3',nu:3,nm:'Lui',po:'L'},{id:'a4',nu:4,nm:'Car',po:'C'},{id:'a5',nu:5,nm:'Dud',po:'O'},{id:'a6',nu:6,nm:'Fer',po:'P'},{id:'a7',nu:7,nm:'Gi',po:'Líbero'}],{c:'#db2777'});
  chk(hc2.indexOf('court-lib-swap')<0,'libero: faixa SOME ao escolher fundamento (S.sa setado)');

  console.log('\n=== '+ok+' ok, '+ko+' falhas ===');
  console.log(ko===0?'OK SET/FORMATO APROVADO':'FAIL SET/FORMATO REPROVADO');
  process.exit(ko===0?0:1);
 }catch(e){console.log('ERRO:',e.message);console.log(e.stack);process.exit(1);}
},700);
