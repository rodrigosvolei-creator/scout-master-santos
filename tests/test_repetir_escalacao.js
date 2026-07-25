// Repetir escalacao nos DEMAIS jogos do torneio (Rodrigo 2026-07-24):
// "repita a escalacao ... do jogo contra volei esperanca, para os demais jogos desse torneio".
// A escalacao do jogo modelo (aberta na tela) e copiada pros outros jogos POR JOGAR
// do mesmo torneio (nem ao vivo, nem finalizado, nem de outro torneio).
const fs=require('fs'); const {JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const fakeDB={}; const listeners={};
function getAt(p){const a=p.split('/');let c=fakeDB;for(const k of a){if(c==null)return null;c=c[k];}return c===undefined?null:c;}
function setAt(p,v){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}c[a[a.length-1]]=JSON.parse(JSON.stringify(v));}
function makeRef(p){return{_path:p,on:function(e,cb){listeners[p]=cb;},once:function(){return Promise.resolve({val:()=>getAt(p)});},set:function(v){setAt(p,v);return Promise.resolve();},update:function(){return Promise.resolve();}};}
global.firebaseMock={initializeApp:()=>{},database:()=>({ref:makeRef}),auth:()=>({onAuthStateChanged:function(cb){setTimeout(()=>cb({uid:'m',email:'rodrigosvolei@gmail.com',displayName:'M'}),0);},signInWithPopup:()=>Promise.resolve(),signOut:()=>Promise.resolve()})};

const seed={'torneio-master-santos':{
  teams:[{id:'trs',n:'RS ADULTO',c:'#0e254c',roster:[{aid:'a1'},{aid:'a2'},{aid:'a3'}]}],
  athletes:[{aid:'a1',nm:'Ana',po:'Ponteiro(a)'},{aid:'a2',nm:'Bia',po:'Central'},{aid:'a3',nm:'Carol',po:'Levantador(a)'}],
  tournaments:[{id:'tA',n:'Taça Mauricio Borges'},{id:'tB',n:'Outro Torneio'}],
  games:[
    // modelo: escalacao curada (contra VOLEI ESPERANCA)
    {id:'gm',torId:'tA',tid:'trs',opp:'VOLEI ESPERANÇA',dt:'2026-07-25',tm:'14:30',st:'pending',lineup:[{aid:'a1',nu:7},{aid:'a2',nu:10},{aid:'a3',nu:4}]},
    // demais jogos do MESMO torneio, ainda por jogar (com escalacao "cheia" diferente)
    {id:'g2',torId:'tA',tid:'trs',opp:'RENEGADOS',dt:'2026-07-25',tm:'17:10',st:'pending',lineup:[{aid:'a1',nu:1}]},
    {id:'g3',torId:'tA',tid:'trs',opp:'SIDE OUT',dt:'2026-07-25',tm:'19:20',st:'pending',lineup:[{aid:'a1',nu:1},{aid:'a2',nu:2}]},
    // NAO devem ser tocados:
    {id:'gDone',torId:'tA',tid:'trs',opp:'JA JOGOU',dt:'2026-07-24',tm:'10:00',st:'done',lineup:[{aid:'a1',nu:9}]},
    {id:'gLive',torId:'tA',tid:'trs',opp:'AO VIVO',dt:'2026-07-25',tm:'12:00',st:'live',lineup:[{aid:'a1',nu:8}]},
    {id:'gOutro',torId:'tB',tid:'trs',opp:'DE OUTRO TORNEIO',dt:'2026-07-26',tm:'10:00',st:'pending',lineup:[{aid:'a1',nu:5}]}
  ],
  invites:{}}};
Object.assign(fakeDB,JSON.parse(JSON.stringify(seed)));

const mod=html.replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>/g,'').replace('firebase.initializeApp(fc);','var firebase=window.firebaseMock; firebase.initializeApp(fc);');
const dom=new JSDOM(mod,{url:'https://master.exemplo.com.br/',runScripts:'dangerously',pretendToBeVisual:true,
  beforeParse(window){window.firebaseMock=global.firebaseMock;
    window.AudioContext=function(){return{createOscillator:()=>({connect:()=>{},frequency:{},start:()=>{},stop:()=>{}}),createGain:()=>({connect:()=>{},gain:{}}),destination:{},currentTime:0};};
    window.navigator.vibrate=()=>{};window.alert=()=>{};}});
const w=dom.window;
let ok=0,ko=0; function chk(c,m){if(c){ok++;console.log('OK   '+m);}else{ko++;console.log('FAIL '+m);}}
function lu(id){var g=w.gF(id);return (g&&g.lineup?g.lineup:[]).map(function(e){return e.aid+':'+e.nu;}).join(',');}

setTimeout(function(){
 try{
  ['teams','games','tournaments','athletes','invites'].forEach(function(k){var p='torneio-master-santos/'+k;if(listeners[p])listeners[p]({val:function(){return getAt(p);}});});
  w.isScouter=true; w.currentUser={uid:'m',email:'rodrigosvolei@gmail.com'};
  var saved=0; var _save=w.save; w.save=function(){saved++;return _save&&_save.apply(this,arguments);};

  chk(typeof w.repeatLineupToOthers==='function','repeatLineupToOthers existe');
  chk(typeof w._lineupRepeatTargets==='function','_lineupRepeatTargets existe');

  // 1) alvos = so os pendentes do MESMO torneio (exclui self, done, live, outro torneio)
  var alvos=w._lineupRepeatTargets(w.gF('gm')).map(function(g){return g.id;}).sort().join(',');
  chk(alvos==='g2,g3','alvos = g2,g3 (exclui self/done/live/outro torneio) — deu '+alvos);

  // 2) botao aparece na tela de escalacao do modelo (tem outros jogos por jogar)
  //    OBS: body.innerHTML inclui o codigo-fonte do <script> (runScripts) — por isso
  //    checa o ELEMENTO renderizado do modal, nao o body inteiro.
  w.openLineup('gm');
  var mm=w.document.getElementById('lineupModal');
  chk(mm && mm.querySelector('[onclick*="repeatLineupToOthers"]'),'botao "Repetir nos outros jogos" aparece na escalacao do modelo');
  chk(mm && /outros 2 jogos/.test(mm.innerHTML),'botao diz "outros 2 jogos"');

  // estado ANTES
  var g2Antes=lu('g2'), g3Antes=lu('g3'), doneAntes=lu('gDone'), liveAntes=lu('gLive'), outroAntes=lu('gOutro');
  chk(g2Antes==='a1:1' && g3Antes==='a1:1,a2:2','antes: g2/g3 tinham a escalacao antiga');

  // 3) confirmModal mock: captura o texto e confirma
  var modalBody=null; w.confirmModal=function(o){modalBody=o.body;o&&o.onConfirm&&o.onConfirm();};
  // (o modelo esta aberto com as 3 rows marcadas = a1,a2,a3)
  w.repeatLineupToOthers('gm');

  chk(/3 atletas/.test(modalBody||''),'confirmacao mostra "3 atletas"');
  chk(/RENEGADOS/.test(modalBody||'') && /SIDE OUT/.test(modalBody||''),'confirmacao lista os 2 jogos alvo pelo nome');
  chk(/substitu/i.test(modalBody||''),'confirmacao avisa que a escalacao atual sera substituida');

  // 4) EFEITO: g2 e g3 ficaram com a escalacao do modelo (3 atletas: a1:7,a2:10,a3:4)
  var esperado='a1:7,a2:10,a3:4';
  chk(lu('g2')===esperado,'g2 recebeu a escalacao do modelo (deu '+lu('g2')+')');
  chk(lu('g3')===esperado,'g3 recebeu a escalacao do modelo (deu '+lu('g3')+')');
  chk(lu('gm')===esperado,'o modelo continua com a sua escalacao');

  // 5) NAO tocou nos que nao devia
  chk(lu('gDone')===doneAntes,'jogo FINALIZADO nao foi alterado');
  chk(lu('gLive')===liveAntes,'jogo AO VIVO nao foi alterado');
  chk(lu('gOutro')===outroAntes,'jogo de OUTRO torneio nao foi alterado');

  // 6) copia PROFUNDA (mexer no alvo depois nao reflete no modelo)
  w.gF('g2').lineup[0].nu=99;
  chk(w.gF('gm').lineup[0].nu===7,'copia profunda: alterar g2 nao muda o modelo');
  chk(saved>0,'save() foi chamado (persiste logado)');

  // 7) sem outros jogos por jogar -> nao mostra o botao / avisa
  //    (gOutro e o unico do torneio tB) -> alvos vazio
  chk(w._lineupRepeatTargets(w.gF('gOutro')).length===0,'torneio com 1 jogo so: sem alvos');
  w.closeLineup&&w.closeLineup();
  w.openLineup('gOutro');
  var mo=w.document.getElementById('lineupModal');
  chk(mo && !mo.querySelector('[onclick*="repeatLineupToOthers"]'),'sem outros jogos: botao NAO aparece');

  console.log('\n=== test_repetir_escalacao: '+ok+' OK, '+ko+' FAIL ===');
  process.exit(ko>0?1:0);
 }catch(e){console.log('FAIL exception:',e.message);console.log((e.stack||'').split('\n').slice(0,6).join('\n'));process.exit(1);}
},250);
