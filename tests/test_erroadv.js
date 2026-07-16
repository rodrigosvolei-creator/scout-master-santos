// Feature: botao "Erro adv" (Rodrigo). Ponto do NOSSO time por erro do adversario, independente
// de marcar a acao da outra equipe. Sobe o placar + roda a quadra + entra nos "pontos ganhos"
// (NAO na estatistica por atleta). Undo reverte.
const fs=require('fs'); const {JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const fakeDB={}; const listeners={};
function getAt(p){const a=p.split('/');let c=fakeDB;for(const k of a){if(c==null)return null;c=c[k];}return c===undefined?null:c;}
function setAt(p,v){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}c[a[a.length-1]]=JSON.parse(JSON.stringify(v));}
function makeRef(p){return{_path:p,on:function(e,cb){listeners[p]=cb;},once:function(){return Promise.resolve({val:()=>getAt(p)});},set:function(v){setAt(p,v);return Promise.resolve();},update:function(){return Promise.resolve();}};}
global.firebaseMock={initializeApp:()=>{},database:()=>({ref:makeRef}),auth:()=>({onAuthStateChanged:function(cb){setTimeout(()=>cb({uid:'m',email:'rodrigosvolei@gmail.com',displayName:'M'}),0);},signInWithPopup:()=>Promise.resolve(),signOut:()=>Promise.resolve()})};

const seed={'torneio-master-santos':{
  teams:[{id:'trs',n:'RS',c:'#000',roster:[1,2,3,4,5,6].map(i=>({aid:'a'+i}))}],
  athletes:[1,2,3,4,5,6].map(i=>({aid:'a'+i,nm:'Atleta '+i,po:'Ponteiro(a)',nu:i})),
  tournaments:[{id:'tA',n:'Liga'}],
  games:[{id:'g1',tid:'trs',torId:'tA',opp:'X',st:'live',courtMode:true,ss:[{u:0,t:0,sq:[]}],act:[],
    court:{'1':{pos:['a1','a2','a3','a4','a5','a6'],serving:'us'}},
    lineup:[1,2,3,4,5,6].map(i=>({aid:'a'+i,nu:i}))}],
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
  w.S={aid:'g1',sp:null,sa:null,cs:1,us:[],tm:0,rn:false,ti:null};

  chk(typeof w.scErrAdv==='function','scErrAdv existe');
  // marca 1 ponto NOSSO por erro adv (sem selecionar atleta)
  w.scErrAdv();
  var g=w.gF('g1');
  chk(g.ss[0].u===1 && g.ss[0].t===0, 'scErrAdv: placar 1-0 (ponto do nosso time)');
  chk(g.act.length===1 && g.act[0].ak==='erroadv' && g.act[0].oc==='Ponto' && g.act[0].pid===null, 'scErrAdv: acao {ak:erroadv, oc:Ponto, pid:null}');
  chk((g.ss[0].sq||[]).slice(-1)[0]==='u', 'scErrAdv: sequencia de pontos recebe "u" (nosso)');

  // ENTRA na estatistica -> pontos ganhos do PDF
  var charts=w.pdfChartsHTML(w.gF('g1'));
  chk(charts.indexOf('Erro do adv')>=0, 'PDF: pontos ganhos mostram "Erro do adv"');
  chk(charts.indexOf('Pontos ganhos · 1')>=0, 'PDF: 1 ponto ganho contabilizado');

  // NAO entra na estatistica POR ATLETA (nao cria atleta nulo)
  var lps=w.livePanelStats(w.gF('g1'),'game',1);
  chk(lps && lps.players && !lps.players.some(function(p){return !p.pid;}), 'livePanelStats: NAO cria "atleta" nulo pro erro adv');

  // marca mais um (ataque de atleta) e confere que os dois tipos convivem
  w.S.sp='a1'; w.S.sa='ataque'; w.rcO('Ponto');
  var g3=w.gF('g1');
  chk(g3.ss[0].u===2, 'ataque-ponto de atleta soma normal (2-0)');
  var charts2=w.pdfChartsHTML(w.gF('g1'));
  chk(charts2.indexOf('Pontos ganhos · 2')>=0, 'PDF: 2 pontos ganhos (1 erro adv + 1 ataque)');

  // UNDO reverte o erro adv (desfaz ate voltar)
  w.undo(); // desfaz o ataque
  w.undo(); // desfaz o erro adv
  var g4=w.gF('g1');
  chk(g4.ss[0].u===0, 'undo: placar volta pra 0-0');
  chk(g4.act.length===0, 'undo: acoes removidas (inclusive o erro adv)');

  // o botao aparece no scout (arena) e no tablet
  chk(html.indexOf('scErrAdv()')>=0 && html.indexOf('erro do adversário')>=0, 'botao "Erro adv" presente no HTML (scErrAdv)');

  console.log('\n=== test_erroadv: '+ok+' OK, '+ko+' FAIL ===');
  process.exit(ko>0?1:0);
 }catch(e){console.log('FAIL exception:',e.message);console.log((e.stack||'').split('\n').slice(0,6).join('\n'));process.exit(1);}
},120);
