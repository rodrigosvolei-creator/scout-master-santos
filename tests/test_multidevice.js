// REPRO do bug relatado: 2 celulares no MESMO jogo courtMode.
// Usa os CAMINHOS REAIS do usuario: openGameDayCard, modo tablet (localStorage por device),
// escalar tocando banco+celula, courtConfirmSetup, marcar. B entra depois pra VER.
// Firebase mock COMPARTILHADO entre os 2 doms, com propagacao realtime (path pai incluso).
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');

const fakeDB = {};
const listeners = {};
function getAt(p){const a=p.split('/');let c=fakeDB;for(const k of a){if(c==null)return null;c=c[k];}return c===undefined?null:c;}
function setAt(p,v){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}c[a[a.length-1]]=JSON.parse(JSON.stringify(v));}
function fire(writtenPath){
  Object.keys(listeners).forEach(function(lp){
    if(writtenPath===lp || writtenPath.indexOf(lp+'/')===0 || lp.indexOf(writtenPath+'/')===0){
      (listeners[lp]||[]).forEach(function(cb){ cb({val:function(){return getAt(lp);}}); });
    }
  });
}
function makeRef(p){return{_path:p,
  on:function(e,cb){(listeners[p]=listeners[p]||[]).push(cb); cb({val:function(){return getAt(p);}});},
  once:function(){return Promise.resolve({val:function(){return getAt(p);}});},
  set:function(v){setAt(p,v);fire(p);return Promise.resolve();},
  update:function(){return Promise.resolve();}
};}
const mock={initializeApp:function(){},database:function(){return{ref:makeRef};},
  auth:function(){return{onAuthStateChanged:function(cb){setTimeout(function(){cb({uid:'u1',email:'rodrigosvolei@gmail.com',displayName:'Mesa'});},0);},signInWithPopup:function(){return Promise.resolve();},signOut:function(){return Promise.resolve();}};}};

const seed = { 'torneio-master-santos': {
  teams:[{id:'trs',n:'RS FEM',c:'#db2777',roster:[{aid:'a1'},{aid:'a2'},{aid:'a3'},{aid:'a4'},{aid:'a5'},{aid:'a6'},{aid:'a7'}]}],
  athletes:[1,2,3,4,5,6,7].map(function(i){return {aid:'a'+i,nm:'Atleta '+i,po:(i===7?'Libero':'Ponta'),nu:i};}),
  tournaments:[{id:'tRS',n:'Liga',layout:'gameday'}],
  games:[{id:'g1',torId:'tRS',tid:'trs',opp:'Adversario',st:'pending',ss:[{u:0,t:0}],act:[],
          lineup:[1,2,3,4,5,6,7].map(function(i){return {aid:'a'+i,nu:i};})},
         {id:'g2',torId:'tRS',tid:'trs',opp:'Outro Adv',st:'pending',ss:[{u:0,t:0}],act:[],
          lineup:[1,2,3,4,5,6,7].map(function(i){return {aid:'a'+i,nu:i};})}],
  invites:{} } };
Object.assign(fakeDB, JSON.parse(JSON.stringify(seed)));

const htmlMod = html
  .replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>/g,'')
  .replace('firebase.initializeApp(fc);','var firebase=window.__mock; firebase.initializeApp(fc);');

function makeLS(){var m={};return{getItem:function(k){return k in m?m[k]:null;},setItem:function(k,v){m[k]=String(v);},removeItem:function(k){delete m[k];},clear:function(){m={};}};}
function boot(tablet){
  return new JSDOM(htmlMod, { url:'https://master.exemplo.com.br/?app=1', runScripts:'dangerously', pretendToBeVisual:true,
    beforeParse(window){
      window.__mock=mock;
      var ls=makeLS(); if(tablet)ls.setItem('rs_scout_tablet','1');
      try{Object.defineProperty(window,'localStorage',{value:ls,configurable:true});}catch(e){window.__ls=ls;}
      window.AudioContext=function(){return{createOscillator:function(){return{connect:function(){},frequency:{},start:function(){},stop:function(){}};},createGain:function(){return{connect:function(){},gain:{}};},destination:{},currentTime:0};};
      window.navigator.vibrate=function(){};
      window.alert=function(){};
    }});
}
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
let ok=0,ko=0; function chk(c,m){if(c){ok++;console.log('OK   '+m);}else{ko++;console.log('FAIL '+m);}}

(async function(){
 try{
  const A=boot(true);   // dispositivo A: modo tablet LIGADO (como o Rodrigo usa)
  await sleep(140);
  const B=boot(false);  // dispositivo B: modo tablet DESLIGADO (outro celular, so ver)
  await sleep(140);
  const wa=A.window, wb=B.window;
  wa.currentUser={uid:'u1',email:'rodrigosvolei@gmail.com'};
  wb.currentUser={uid:'u2',email:'rodrigosvolei@gmail.com'};

  // ---- A abre pelo GAME DAY card (caminho real), entra no tablet, escala tocando, marca
  wa.openGameDayCard('g1');
  var ga=wa.gF('g1'); ga.st='live';
  wa.render();  // rSctTablet: liga courtMode + save; mostra setup
  chk(ga.courtMode===true, 'A: modo tablet ligou courtMode');
  // escalar os 6 tocando banco -> celula (o fluxo real). idx de celula 0..5 = P1..P6
  ['a1','a2','a3','a4','a5','a6'].forEach(function(aid,i){ wa.courtDraftPlace(aid); wa.courtDraftCell(i); });
  wa.courtDraftServer('us');
  wa.courtConfirmSetup();
  var gaC=wa.gF('g1');
  chk(gaC.court && gaC.court['1'] && gaC.court['1'].pos.filter(Boolean).length===6, 'A: court[1] escalado com 6');
  // marcar 1 acao no tablet (scTap seleciona sacador automatico p/ saque; usa atleta pra ataque)
  wa.S.sp='a2'; wa.S.sa='ataque'; wa.rcO('Ponto');
  await sleep(90);

  console.log('\n--- Dispositivo B (entra depois pra VER) ---');
  var gb=wb.gF('g1');
  chk(!!gb, 'B enxerga o jogo g1');
  chk(gb && gb.courtMode===true, 'B recebeu courtMode=true (sincronizou)');
  chk(gb && gb.court && gb.court['1'] && gb.court['1'].pos && gb.court['1'].pos.filter(Boolean).length===6,
      'B recebeu court[1] com os 6 (NAO precisa reescalar)');
  chk(gb && Array.isArray(gb.act) && gb.act.length>=1, 'B recebeu a acao de A (ONLINE)');
  chk(gb && gb.ss && gb.ss[0] && gb.ss[0].u===1, 'B recebeu o placar 1-0');

  wb.openGameDayCard('g1'); wb.tab='scout'; wb.render();
  var h=wb.document.getElementById('mainApp').innerHTML;
  chk(h.indexOf('Posicionar o time')<0, 'B (scout normal) NAO mostra a tela de posicionar');

  // ---- E se B TAMBEM estiver no modo tablet? (2 tablets)
  console.log('\n--- Dispositivo B no modo TABLET ---');
  wb.localStorage.setItem('rs_scout_tablet','1'); wb.render();
  var h2=wb.document.getElementById('mainApp').innerHTML;
  chk(h2.indexOf('Posicionar o time')<0, 'B (tablet) NAO mostra "Posicionar o time"');
  chk(h2.indexOf('sct-body')>=0 || h2.indexOf('sct-col-l')>=0, 'B (tablet) mostra o scout de verdade (3 colunas)');

  // ---- Realtime: A marca com B aberto
  console.log('\n--- Realtime ---');
  wa.S.sp='a3'; wa.S.sa='ataque'; wa.rcO('Ponto');
  await sleep(90);
  wb.render();
  var gb2=wb.gF('g1');
  chk(gb2 && gb2.act.length>=2, 'B recebe a 2a acao em tempo real');
  chk(gb2 && gb2.ss[0].u===2, 'B recebe o placar 2-0 em tempo real');

  // ---- Persistencia GRANULAR: B marca em OUTRO jogo (g2). Com saveGame por-jogo, isso
  //      NAO pode apagar o court/acoes que A gravou no g1 (o save() do array inteiro apagaria).
  console.log('\n--- Granular: 2 dispositivos em 2 jogos diferentes ---');
  wb.openGameDayCard('g2'); var g2b=wb.gF('g2'); g2b.st='live'; wb.render();
  ['a6','a5','a4','a3','a2','a1'].forEach(function(aid,i){ wb.courtDraftPlace(aid); wb.courtDraftCell(i); });
  wb.courtDraftServer('them'); wb.courtConfirmSetup();
  wb.S.sp='a5'; wb.S.sa='ataque'; wb.rcO('Ponto');
  await sleep(90);
  var fg1=getAt('torneio-master-santos/games/0'); // g1 (A)
  var fg2=getAt('torneio-master-santos/games/1'); // g2 (B)
  chk(fg1 && fg1.id==='g1' && fg1.court && fg1.court['1'] && fg1.act && fg1.act.length>=2,
      'g1 (A) PRESERVADO no Firebase apos B mexer no g2 (court + 2 acoes intactos)');
  chk(fg2 && fg2.id==='g2' && fg2.court && fg2.court['1'] && fg2.act && fg2.act.length>=1,
      'g2 (B) gravado no seu indice (court + 1 acao)');
  var gaFim=wa.gF('g1');
  chk(gaFim && gaFim.court && gaFim.court['1'] && gaFim.act.length>=2, 'A continua vendo o g1 completo (nao foi sobrescrito)');

  console.log('\n=== test_multidevice: '+ok+' OK, '+ko+' FAIL ===');
  process.exit(ko>0?1:0);
 }catch(e){ console.log('FAIL exception: '+e.message); console.log((e.stack||'').split('\n').slice(0,8).join('\n')); process.exit(1); }
})();
