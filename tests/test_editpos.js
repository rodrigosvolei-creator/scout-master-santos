// Feature: trocar a POSICAO/funcao do atleta na escalacao (ex: Ponteiro -> Libero).
// courtSetPos muda no CADASTRO (athlete.po) E no JOGO (lineup[i].po). _courtGp prioriza le.po,
// entao _isLibero passa a reconhecer o atleta como libero neste jogo.
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
  games:[{id:'g1',torId:'tA',tid:'trs',opp:'X',st:'live',courtMode:true,ss:[{u:0,t:0}],act:[],
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

  // ANTES: a2 e Ponteiro, nao e libero
  var p0=w._gpFind(w._courtGp(w.gF('g1')),'a2');
  chk(p0 && p0.po.toLowerCase().indexOf('pont')===0, 'antes: a2 e Ponteiro');
  chk(!w._isLibero(p0), 'antes: a2 NAO e reconhecido como libero');
  chk(typeof w.courtEditPos==='function' && typeof w.courtSetPos==='function', 'courtEditPos/courtSetPos existem');

  // TROCAR a2 -> Libero
  w.courtSetPos('a2','Líbero');

  // CADASTRO (athlete global) mudou
  var ath=w.aFind('a2'); chk(ath && ath.po==='Líbero', 'cadastro: athlete a2 po = Líbero');
  // JOGO (lineup) mudou
  var le=(w.gF('g1').lineup||[]).filter(function(x){return x.aid==='a2';})[0];
  chk(le && le.po==='Líbero', 'jogo: lineup do a2 po = Líbero');
  // _courtGp reflete + _isLibero reconhece
  var p1=w._gpFind(w._courtGp(w.gF('g1')),'a2');
  chk(p1 && p1.po==='Líbero', '_courtGp reflete Líbero pro a2');
  chk(w._isLibero(p1), '_isLibero agora TRUE pro a2 (tratado como libero no jogo)');
  // os outros continuam Ponteiro
  var p3=w._gpFind(w._courtGp(w.gF('g1')),'a3');
  chk(p3 && !w._isLibero(p3), 'a3 continua NAO-libero (so o a2 mudou)');

  // O icone de editar aparece no setup (banco/quadra)
  w.render();
  var setupHtml=w.courtRenderSetup(w.gF('g1'), w._courtGp(w.gF('g1')));
  chk(setupHtml.indexOf('court-pos-edit')>=0 && setupHtml.indexOf('courtEditPos')>=0, 'setup mostra o icone ✏️ (court-pos-edit) pra trocar posicao');

  console.log('\n=== test_editpos: '+ok+' OK, '+ko+' FAIL ===');
  process.exit(ko>0?1:0);
 }catch(e){console.log('FAIL exception:',e.message);console.log((e.stack||'').split('\n').slice(0,6).join('\n'));process.exit(1);}
},120);
