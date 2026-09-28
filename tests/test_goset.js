// Remarcar um set anterior pelo chip de set (goSet).
const fs=require('fs'); const {JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const fakeDB={}; const listeners={};
function getAt(p){const a=p.split('/');let c=fakeDB;for(const k of a){if(c==null)return null;c=c[k];}return c===undefined?null:c;}
function setAt(p,v){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}c[a[a.length-1]]=JSON.parse(JSON.stringify(v));}
function makeRef(p){return{_path:p,on:function(e,cb){listeners[p]=cb;},once:function(){return Promise.resolve({val:()=>getAt(p)});},set:function(v){setAt(p,v);return Promise.resolve();},update:function(){return Promise.resolve();}};}
global.firebaseMock={initializeApp:()=>{},database:()=>({ref:makeRef}),auth:()=>({onAuthStateChanged:function(cb){setTimeout(()=>cb({uid:'m',email:'rodrigosvolei@gmail.com',displayName:'M'}),0);},signInWithPopup:()=>Promise.resolve(),signOut:()=>Promise.resolve()})};

function act(set,pid){return {id:pid+set+Math.random(),pid:pid,ak:"ataque",oc:"Ponto",set:set};}
// Caso real (27/09, RS x FENERBOUAS 1, fixed3): set 1 ficou incompleto (0-4), sets 2 e 3 jogados.
// Set 1 zerado no banco -> operador volta no set 1 pelo chip e remarca pela filmagem.
const seed={"torneio-master-santos":{
  teams:[{id:"trs",n:"RS",c:"#000",roster:[{aid:"a1"}]}],
  athletes:[{aid:"a1",nm:"Atleta 1",po:"Ponteiro(a)",nu:1}],
  tournaments:[{id:"tA",n:"Taca SP"}],
  games:[{id:"g1",tid:"trs",torId:"tA",opp:"FENERBOUAS 1",st:"live",format:"fixed3",maxSets:3,courtMode:false,
    ss:[{u:0,t:0},{u:25,t:18,sq:[]},{u:25,t:15,sq:[]}],
    act:[act(2,"a1"),act(3,"a1")],
    lineup:[{aid:"a1",nu:1}]}],
  invites:{}}};
Object.assign(fakeDB,JSON.parse(JSON.stringify(seed)));
const htmlMod=html.replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>/g,'').replace('firebase.initializeApp(fc);','var firebase=window.firebaseMock; firebase.initializeApp(fc);');
const dom=new JSDOM(htmlMod,{url:'https://master.exemplo.com.br/',runScripts:'dangerously',pretendToBeVisual:true,
  beforeParse(window){window.firebaseMock=global.firebaseMock;
    window.AudioContext=function(){return{createOscillator:()=>({connect:()=>{},frequency:{},start:()=>{},stop:()=>{}}),createGain:()=>({connect:()=>{},gain:{}}),destination:{},currentTime:0};};
    window.navigator.vibrate=()=>{};window.alert=()=>{};}});
const w=dom.window;
let ok=0,ko=0; function chk(c,m){if(c){ok++;console.log('OK   '+m);}else{ko++;console.log('FAIL '+m);}}

setTimeout(()=>{
 try{
  ["teams","games","tournaments","athletes","invites"].forEach(k=>{var p="torneio-master-santos/"+k;if(listeners[p])listeners[p]({val:()=>getAt(p)});});
  w.currentUser={uid:"m",email:"rodrigosvolei@gmail.com"};
  w.tab="scout"; w.S={aid:"g1",sp:null,sa:null,cs:3,us:[],tm:0,rn:false,ti:null};
  var lastToast=null; w.toast=function(m,t){lastToast={m:m,t:t};};
  var modal=null; w.confirmModal=function(o){modal=o;};
  chk(typeof w.goSet==="function","goSet existe");
  // chips clicaveis no scout
  w.render(); var html1=w.document.body.innerHTML;
  chk(html1.indexOf('onclick="goSet(1)"')>=0,"chip do set 1 clicavel (goSet(1)) no scout ao vivo");
  chk(html1.indexOf('onclick="goSet(3)"')<0,"chip do set atual (3) NAO e clicavel");
  // volta pro set 1
  w.goSet(1);
  chk(w.S.cs===1,"goSet(1): S.cs=1");
  chk(w.gF("g1").ss.length===3,"goSet nao cria/apaga set (continua 3)");
  // marca pontos no set 1: vao pro set 1, sets 2/3 intactos
  for(var i=0;i<24;i++)w.scUp("u"); for(var i=0;i<20;i++)w.scUp("t");
  var g=w.gF("g1");
  chk(g.ss[0].u===24&&g.ss[0].t===20,"pontos entraram no set 1 (24-20)");
  chk(g.ss[1].u===25&&g.ss[1].t===18&&g.ss[2].u===25&&g.ss[2].t===15,"sets 2 e 3 intactos (25-18, 25-15)");
  chk(g.ss[0].sq&&g.ss[0].sq.length===44,"sequencia do set 1 gravada (44 pontos)");
  // acao de atleta grava set:1
  w.S.sp="a1";w.S.sa="ataque";w.rcO("Ponto");
  var a1=(w.gF("g1").act||[]).filter(a=>a.set===1);
  chk(a1.length===1,"acao marcada no set 1 grava set:1");
  // fechou 25-20: jogo fixed3 com os 3 sets encerrados -> PARTIDA ENCERRADA (nao abre set 4)
  w._setCloseShownFor=null; modal=null; w._maybeSetClose();
  chk(w.gF("g1").ss[0].u===25,"set 1 fechou 25-20");
  chk(modal&&/PARTIDA ENCERRAD/i.test(modal.title),"set 1 fechado com 3 sets jogados -> oferece finalizar");
  // bo3 incompleto: remarcar set 1 e fechar -> "Voltar pro set N", nunca nxS
  var gb=w.gF("g1"); gb.format="bo3"; gb.ss=[{u:24,t:10,sq:[]},{u:10,t:20,sq:[]}]; gb.act=[];
  w.S.cs=2; w.goSet(1); w.scUp("u"); w._setCloseShownFor=null; modal=null; w._maybeSetClose();
  chk(modal&&/Voltar pro set 2/.test(modal.confirmLabel||""),"bo3: set anterior fechado -> botao \"Voltar pro set 2\"");
  modal.onConfirm();
  chk(w.S.cs===2&&w.gF("g1").ss.length===2,"confirmar volta pro set 2 sem criar set novo");
  // navegar ate set encerrado nao abre modal
  var gc=w.gF("g1"); gc.ss=[{u:25,t:10,sq:[]},{u:5,t:5,sq:[]}]; w.S.cs=2; modal=null; w.goSet(1); w._maybeSetClose();
  chk(modal===null,"navegar ate set ja encerrado NAO abre modal sozinho");
  // jogo finalizado: goSet bloqueia
  gc.st="done"; w.S.cs=1; w.goSet(2);
  chk(w.S.cs===1,"jogo finalizado: goSet bloqueado");
  console.log("\n=== test_goset: "+ok+" OK, "+ko+" FAIL ===");
  process.exit(ko>0?1:0);
 }catch(e){console.log("FAIL exception:",e.message);console.log((e.stack||"").split("\n").slice(0,6).join("\n"));process.exit(1);}
},150);
