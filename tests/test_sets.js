// Bug real (Rodrigo): jogo 3-0 (25-19/25-14/25-13) foi parar no "SET 5" com 2 sets vazios,
// porque "Prox Set" (nxS) empilhava set novo sem travar, e nao havia como voltar.
// Correcao: nxS trava se o set atual esta 0-0 sem acoes + confirma se a partida ja foi decidida;
// delLastSet remove um set vazio (0-0 sem acoes).
const fs=require('fs'); const {JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const fakeDB={}; const listeners={};
function getAt(p){const a=p.split('/');let c=fakeDB;for(const k of a){if(c==null)return null;c=c[k];}return c===undefined?null:c;}
function setAt(p,v){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}c[a[a.length-1]]=JSON.parse(JSON.stringify(v));}
function makeRef(p){return{_path:p,on:function(e,cb){listeners[p]=cb;},once:function(){return Promise.resolve({val:()=>getAt(p)});},set:function(v){setAt(p,v);return Promise.resolve();},update:function(){return Promise.resolve();}};}
global.firebaseMock={initializeApp:()=>{},database:()=>({ref:makeRef}),auth:()=>({onAuthStateChanged:function(cb){setTimeout(()=>cb({uid:'m',email:'rodrigosvolei@gmail.com',displayName:'M'}),0);},signInWithPopup:()=>Promise.resolve(),signOut:()=>Promise.resolve()})};

function act(set,pid){return {id:pid+set+Math.random(),pid:pid,ak:'ataque',oc:'Ponto',set:set};}
const seed={'torneio-master-santos':{
  teams:[{id:'trs',n:'RS',c:'#000',roster:[{aid:'a1'}]}],
  athletes:[{aid:'a1',nm:'Atleta 1',po:'Ponteiro(a)',nu:1}],
  tournaments:[{id:'tA',n:'Liga'}],
  games:[{id:'g1',tid:'trs',torId:'tA',opp:'ITAPEVI',st:'live',format:'bo5',
    ss:[{u:25,t:19,sq:[]},{u:25,t:14,sq:[]},{u:25,t:13,sq:[]}],
    act:[act(1,'a1'),act(2,'a1'),act(3,'a1')],
    lineup:[{aid:'a1',nu:1}]}],
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
  ['teams','games','tournaments','athletes','invites'].forEach(k=>{var p='torneio-master-santos/'+k;if(listeners[p])listeners[p]({val:()=>getAt(p)});});
  w.currentUser={uid:'m',email:'rodrigosvolei@gmail.com'};
  w.S={aid:'g1',sp:null,sa:null,cs:3,us:[],tm:0,rn:false,ti:null};
  // mocks: toast captura ultima msg; confirmModal auto-confirma (simula o operador clicando "sim")
  var lastToast=null; w.toast=function(m,t){lastToast={m:m,t:t};};
  var confirms=0; w.confirmModal=function(o){confirms++;o&&o.onConfirm&&o.onConfirm();};

  chk(typeof w.nxS==='function' && typeof w.delLastSet==='function','nxS e delLastSet existem');
  chk(w.gameIsDecided(w.gF('g1'))===true,'jogo 3-0 em bo5 = decidido');

  // 1) nxS com set atual PREENCHIDO e jogo decidido -> confirma -> cria set 4
  lastToast=null; w.nxS();
  var g=w.gF('g1');
  chk(g.ss.length===4 && confirms===1,'nxS (jogo decidido): confirma e abre set 4');
  chk(w.S.cs===4,'S.cs acompanhou (=4)');

  // 2) nxS de novo com set 4 VAZIO (0-0 sem acoes) -> TRAVA, nao cria set 5
  lastToast=null; var before=w.gF('g1').ss.length; w.nxS();
  var g2=w.gF('g1');
  chk(g2.ss.length===before,'nxS TRAVA em set vazio (nao empilha set 5) — o bug do Rodrigo nao repete');
  chk(lastToast && /0-0/.test(lastToast.m),'nxS: avisa que o set ainda esta 0-0');

  // 3) delLastSet remove o set 4 (vazio) e volta pro set 3
  lastToast=null; w.delLastSet();
  var g3=w.gF('g1');
  chk(g3.ss.length===3 && w.S.cs===3,'delLastSet: remove set vazio e volta pro set 3');

  // 4) delLastSet NAO remove um set com placar/acoes (set 3 = 25-13 com acao)
  lastToast=null; w.delLastSet();
  var g4=w.gF('g1');
  chk(g4.ss.length===3,'delLastSet: NAO remove set jogado (25-13 com acoes)');
  chk(lastToast && /placar|ações|acoes/i.test(lastToast.m),'delLastSet: avisa que o set tem placar/acoes');

  // 5) o botao aparece no scout quando ha set vazio no fim
  chk(html.indexOf('delLastSet()')>=0 && html.indexOf('Remover set')>=0,'botao "Remover set (vazio)" presente no HTML');

  console.log('\n=== test_sets: '+ok+' OK, '+ko+' FAIL ===');
  process.exit(ko>0?1:0);
 }catch(e){console.log('FAIL exception:',e.message);console.log((e.stack||'').split('\n').slice(0,6).join('\n'));process.exit(1);}
},150);
