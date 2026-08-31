// "3 sets obrigatorios" no card rapido de criar jogo (Rodrigo): o 3o set segue os
// demais (a 25) e NAO acaba em 15 como o tie-break do "melhor de 3". A logica fixed3
// ja existia (setTarget/gameIsDecided) — faltava a opcao no form openTorneioNovoJogo.
// Bug real que motivou: um jogo parou em 15x2 porque estava como bo3 (3o = tie 15).
const fs=require('fs'); const {JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const fakeDB={}; const listeners={};
function getAt(p){const a=p.split('/');let c=fakeDB;for(const k of a){if(c==null)return null;c=c[k];}return c===undefined?null:c;}
function setAt(p,v){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}c[a[a.length-1]]=JSON.parse(JSON.stringify(v));}
function makeRef(p){return{_path:p,on:function(e,cb){listeners[p]=cb;},once:function(){return Promise.resolve({val:()=>getAt(p)});},set:function(v){setAt(p,v);return Promise.resolve();},update:function(){return Promise.resolve();}};}
global.firebaseMock={initializeApp:()=>{},database:()=>({ref:makeRef}),auth:()=>({onAuthStateChanged:function(cb){setTimeout(()=>cb({uid:'m',email:'rodrigosvolei@gmail.com',displayName:'M'}),0);},signInWithPopup:()=>Promise.resolve(),signOut:()=>Promise.resolve()})};

const seed={'torneio-master-santos':{
  teams:[{id:'trs',n:'RS ADULTO',c:'#0e254c',roster:[{aid:'a1'},{aid:'a2'}]}],
  athletes:[{aid:'a1',nm:'Ana',po:'Ponteiro(a)'},{aid:'a2',nm:'Bia',po:'Central'}],
  tournaments:[{id:'tA',n:'Copa Teste',cat:'Adulto'}],
  games:[], invites:{}}};
Object.assign(fakeDB,JSON.parse(JSON.stringify(seed)));

const mod=html.replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>/g,'').replace('firebase.initializeApp(fc);','var firebase=window.firebaseMock; firebase.initializeApp(fc);');
const dom=new JSDOM(mod,{url:'https://master.exemplo.com.br/',runScripts:'dangerously',pretendToBeVisual:true,
  beforeParse(window){window.firebaseMock=global.firebaseMock;
    window.AudioContext=function(){return{createOscillator:()=>({connect:()=>{},frequency:{},start:()=>{},stop:()=>{}}),createGain:()=>({connect:()=>{},gain:{}}),destination:{},currentTime:0};};
    window.navigator.vibrate=()=>{};window.alert=()=>{};}});
const w=dom.window;
let ok=0,ko=0; function chk(c,m){if(c){ok++;console.log('OK   '+m);}else{ko++;console.log('FAIL '+m);}}
function fmtCreate(fmt,opp){
  w.openTorneioNovoJogo();
  var setV=function(id,v){var el=w.document.getElementById(id);if(el)el.value=v;};
  setV('tnj-opp',opp); setV('tnj-dt','2026-08-01'); setV('tnj-tm','20:00');
  setV('tnj-team','trs'); setV('tnj-fmt',fmt);
  w.salvarTorneioJogo();
  var gs=w.D.games; return gs[gs.length-1];
}

setTimeout(function(){
 try{
  ['teams','games','tournaments','athletes','invites'].forEach(function(k){var p='torneio-master-santos/'+k;if(listeners[p])listeners[p]({val:function(){return getAt(p);}});});
  w.currentUser={uid:'m',email:'rodrigosvolei@gmail.com'};
  w.isCoord=true; w.torneioMode=false; w.selTor='tA'; w.render=function(){};

  // 1) o form agora oferece as 3 opcoes, incluindo "3 sets obrigatorios"
  w.openTorneioNovoJogo();
  var sel=w.document.getElementById('tnj-fmt');
  chk(!!sel,'form de novo jogo tem o select de formato');
  var vals=sel?Array.prototype.map.call(sel.options,function(o){return o.value;}):[];
  chk(vals.indexOf('bo3')>=0 && vals.indexOf('bo5')>=0 && vals.indexOf('fixed3')>=0,'opcoes: bo3, bo5 e fixed3 — deu ['+vals.join(',')+']');
  chk(/3 sets obrigat[óo]rios/.test(sel.innerHTML) && /todos a 25/.test(sel.innerHTML),'rotulo "3 sets obrigatorios (todos a 25)"');
  if(w.cancelTorneioModal)w.cancelTorneioModal();

  // 2) criar com fixed3 -> jogo grava format=fixed3 + maxSets=3
  var gFix=fmtCreate('fixed3','ITAPEVA FIX');
  chk(gFix && gFix.format==='fixed3' && gFix.maxSets===3,'criar fixed3: format=fixed3, maxSets=3 — deu format='+(gFix&&gFix.format)+' maxSets='+(gFix&&gFix.maxSets));

  // 3) A REGRA: no fixed3 o set 3 vai a 25 (NAO 15) e o jogo nao decide em 2-0
  chk(w.setTarget(gFix,1)===25 && w.setTarget(gFix,3)===25,'fixed3: set 1 e set 3 ambos a 25 (3o NAO e tie de 15)');
  chk(w.gameMaxSets(gFix)===3,'fixed3: 3 sets');
  gFix.ss=[{u:25,t:20},{u:25,t:18}];
  chk(w.gameIsDecided(gFix)===false,'fixed3: 2-0 NAO decide o jogo (joga os 3 sets)');
  // o bug do 15x2: no set 3, 15-2 NAO encerra (falta chegar a 25); 25-x encerra
  gFix.ss=[{u:25,t:20},{u:25,t:18},{u:15,t:2}];
  chk(w.setIsOver(gFix,3)===false,'fixed3: set 3 em 15-2 NAO encerra (o bug do Rodrigo nao repete)');
  gFix.ss=[{u:25,t:20},{u:25,t:18},{u:25,t:23}];
  chk(w.setIsOver(gFix,3)===true,'fixed3: set 3 encerra em 25-23');
  chk(w.gameIsDecided(gFix)===true,'fixed3: com os 3 sets fechados, o jogo decide');

  // 4) bo3 continua com tie 15 no 3o (nao quebrou o padrao antigo)
  var gBo3=fmtCreate('bo3','ITAPEVA BO3');
  chk(gBo3.format==='bo3' && gBo3.maxSets===3,'criar bo3: format=bo3, maxSets=3');
  chk(w.setTarget(gBo3,3)===15,'bo3: 3o set = tie 15 (padrao mantido)');
  gBo3.ss=[{u:25,t:20},{u:25,t:18}];
  chk(w.gameIsDecided(gBo3)===true,'bo3: 2-0 decide o jogo');

  // 5) bo5 -> 5 sets
  var gBo5=fmtCreate('bo5','ITAPEVA BO5');
  chk(gBo5.format==='bo5' && gBo5.maxSets===5,'criar bo5: format=bo5, maxSets=5');

  // 6) EDICAO: reabrir o jogo fixed3 pre-seleciona "fixed3" no select
  w._tnjEditId=gFix.id; w.openTorneioNovoJogo();
  var sel2=w.document.getElementById('tnj-fmt');
  chk(sel2 && sel2.value==='fixed3','editar jogo fixed3: o select volta em "fixed3" (nao cai pra bo3)');
  w._tnjEditId=null; if(w.cancelTorneioModal)w.cancelTorneioModal();

  console.log('\n=== test_formato_fixo: '+ok+' OK, '+ko+' FAIL ===');
  process.exit(ko>0?1:0);
 }catch(e){console.log('FAIL exception:',e.message);console.log((e.stack||'').split('\n').slice(0,6).join('\n'));process.exit(1);}
},250);
