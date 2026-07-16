// Feature: repetir escalacao (Rodrigo). Dois botoes no setup: "repetir set anterior" (mesmo jogo)
// e "repetir de outro jogo" (traz o ELENCO/relacao de atletas + as POSICOES do jogo escolhido).
const fs=require('fs'); const {JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const fakeDB={}; const listeners={};
function getAt(p){const a=p.split('/');let c=fakeDB;for(const k of a){if(c==null)return null;c=c[k];}return c===undefined?null:c;}
function setAt(p,v){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}c[a[a.length-1]]=JSON.parse(JSON.stringify(v));}
function makeRef(p){return{_path:p,on:function(e,cb){listeners[p]=cb;},once:function(){return Promise.resolve({val:()=>getAt(p)});},set:function(v){setAt(p,v);return Promise.resolve();},update:function(){return Promise.resolve();}};}
global.firebaseMock={initializeApp:()=>{},database:()=>({ref:makeRef}),auth:()=>({onAuthStateChanged:function(cb){setTimeout(()=>cb({uid:'m',email:'rodrigosvolei@gmail.com',displayName:'M'}),0);},signInWithPopup:()=>Promise.resolve(),signOut:()=>Promise.resolve()})};

const seed={'torneio-master-santos':{
  teams:[{id:'trs',n:'RS',c:'#000',roster:[1,2,3,4,5,6,7].map(i=>({aid:'a'+i}))}],
  athletes:[1,2,3,4,5,6,7].map(i=>({aid:'a'+i,nm:'Atleta '+i,po:'Ponteiro(a)',nu:i})),
  tournaments:[{id:'tA',n:'Liga'}],
  games:[
    // gA = origem (mesmo time, ja escalado)
    {id:'gA',tid:'trs',torId:'tA',opp:'Time X',dt:'2026-07-01',st:'done',courtMode:true,ss:[{u:25,t:20}],act:[],
     court:{'1':{pos:['a1','a2','a3','a4','a5','a6'],serving:'us'}},
     lineup:[1,2,3,4,5,6,7].map(i=>({aid:'a'+i,nu:i}))},
    // gO = OUTRO time (nao deve aparecer como fonte)
    {id:'gO',tid:'outro',torId:'tA',opp:'Z',st:'done',courtMode:true,ss:[{u:25,t:10}],act:[],
     court:{'1':{pos:['b1','b2','b3','b4','b5','b6'],serving:'them'}},lineup:[]},
    // gB = atual (sem escalacao)
    {id:'gB',tid:'trs',torId:'tA',opp:'Time Y',st:'live',courtMode:true,ss:[{u:0,t:0}],act:[],
     lineup:[1,2,3,4,5,6,7].map(i=>({aid:'a'+i,nu:i}))}
  ],
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
  w.S={aid:'gB',sp:null,sa:null,cs:1,us:[],tm:0,rn:false,ti:null};
  w._courtDraft=null;

  // fontes: so gA (mesmo time, escalado). gO e outro time; gB e o proprio.
  var srcs=w._courtRepeatSources(w.gF('gB'));
  chk(srcs.length===1 && srcs[0].id==='gA', '_courtRepeatSources lista SO o gA (mesmo time, escalado; ignora outro time e o proprio)');

  // REPETIR DE OUTRO JOGO: traz elenco + posicoes
  w.courtRepeatFromGame('gA');
  var d=w._courtDraft;
  chk(d && d.pos.filter(Boolean).length===6, 'repetir de gA: rascunho com os 6 posicionados');
  chk(d.pos[0]==='a1' && d.pos[5]==='a6', 'repetir de gA: posicoes na ordem do jogo de origem');
  chk(d.serving==='us', 'repetir de gA: saque (serving) copiado');
  var gB2=w.gF('gB');
  chk(gB2.lineup && gB2.lineup.length===7, 'repetir de gA: elenco (relacao de atletas) copiado pro gB');

  // confirmar e conferir que salvou o court no gB
  w.courtConfirmSetup();
  var gB3=w.gF('gB');
  chk(gB3.court && gB3.court['1'] && w._posArr(gB3.court['1'].pos).filter(Boolean).length===6, 'apos confirmar: court[1] escalado gravado no gB');

  // REPETIR SET ANTERIOR: set 2 repete o set 1
  var gB4=w.gF('gB'); gB4.ss=[{u:25,t:20},{u:0,t:0}];
  w.S.cs=2; w._courtDraft=null;
  w.courtRepeatPrevSet();
  var d2=w._courtDraft;
  chk(d2 && d2.pos.filter(Boolean).length===6, 'repetir set anterior: rascunho com os 6');
  chk(d2.pos[0]==='a1' && d2.serving==='us', 'repetir set anterior: mesmas posicoes/saque do set 1');

  // os botoes aparecem no setup
  w.S.cs=1; w._courtDraft=null;
  var setupHtml=w.courtRenderSetup(w.gF('gB'), w._courtGp(w.gF('gB')));
  chk(setupHtml.indexOf('courtRepeatMenu')>=0, 'setup mostra o botao "Repetir de outro jogo"');

  console.log('\n=== test_repetir: '+ok+' OK, '+ko+' FAIL ===');
  process.exit(ko>0?1:0);
 }catch(e){console.log('FAIL exception:',e.message);console.log((e.stack||'').split('\n').slice(0,6).join('\n'));process.exit(1);}
},120);
