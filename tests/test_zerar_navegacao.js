// BUG "tela orfa" (galeria-first): zerar/finalizar NAO pode jogar o usuario na
// renderScoutSelection (a aba Scout escondida = sem porta de entrada). O estado orfao
// e (tab==='scout' && S.aid===null). resetG deve MANTER no jogo; enG volta pra galeria.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');

const fakeDB = {};
const listeners = {};
function getAt(p){const a=p.split('/');let c=fakeDB;for(const k of a){if(c==null)return null;c=c[k];}return c===undefined?null:c;}
function setAt(p,v){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}c[a[a.length-1]]=JSON.parse(JSON.stringify(v));}
function makeRef(p){return{_path:p,on:function(e,cb){listeners[p]=cb;},once:function(){return Promise.resolve({val:()=>getAt(p)});},set:function(v){setAt(p,v);return Promise.resolve();},update:function(){return Promise.resolve();}};}
global.firebaseMock={initializeApp:()=>{},database:()=>({ref:makeRef}),auth:()=>({onAuthStateChanged:function(cb){setTimeout(()=>cb({uid:'tester',email:'rodrigosvolei@gmail.com',displayName:'Tester'}),0);},signInWithPopup:()=>Promise.resolve(),signOut:()=>Promise.resolve()})};

const seed = {
  'torneio-master-santos': {
    teams:[{id:'trs',n:'RS FEM',c:'#db2777',roster:[{aid:'a1'},{aid:'a2'}]}],
    athletes:[{aid:'a1',nm:'Ana',po:'P'},{aid:'a2',nm:'Bia',po:'C'}],
    tournaments:[{id:'tA',n:'Liga'}],
    games:[
      {id:'g1',torId:'tA',tid:'trs',opp:'X',st:'live',
       ss:[{u:10,t:8}], act:[{id:'x',pid:'a1',ak:'ataque',oc:'Ponto',set:1}],
       lineup:[{aid:'a1',nu:1},{aid:'a2',nu:2}]}
    ],
    invites:{}
  }
};
Object.assign(fakeDB, JSON.parse(JSON.stringify(seed)));

const htmlMod = html
  .replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>/g,'')
  .replace('firebase.initializeApp(fc);','var firebase=window.firebaseMock; firebase.initializeApp(fc);');

const dom = new JSDOM(htmlMod, {
  url: 'https://master.associacaoscoladevoleibol.com.br/',
  runScripts: 'dangerously', pretendToBeVisual: true,
  beforeParse(window){
    window.firebaseMock = global.firebaseMock;
    window.AudioContext = function(){return{createOscillator:()=>({connect:()=>{},frequency:{},start:()=>{},stop:()=>{}}),createGain:()=>({connect:()=>{},gain:{}}),destination:{},currentTime:0};};
    window.navigator.vibrate = ()=>{};
  }
});
const w = dom.window;

let ok=0, ko=0;
function chk(c,m){if(c){ok++;console.log('OK   '+m);}else{ko++;console.log('FAIL '+m);}}
function orfao(){ return w.tab==='scout' && w.S.aid===null; } // o estado que mostra a tela orfa

setTimeout(()=>{
  try {
    ['teams','games','tournaments','athletes','invites'].forEach(k=>{
      const path='torneio-master-santos/'+k;
      if(listeners[path]) listeners[path]({val:()=>getAt(path)});
    });
    w.isScouter=true;
    w.confirmModal=function(o){ if(o&&typeof o.onConfirm==='function')o.onConfirm(); }; // auto-confirma os modais
    w.exG=function(){};                                                                 // nao exporta WhatsApp no teste

    // 1. abrir o jogo da galeria -> entra no scout
    w.openGameDayCard('g1');
    chk(w.tab==='scout' && w.S.aid==='g1', 'abrir jogo: tab=scout, S.aid=g1');
    chk(!orfao(), 'abrir jogo: NAO esta no estado orfao');

    // 2. ZERAR PARTIDA -> mantem no jogo (NAO ejeta pra a tela orfa)
    w.resetG();
    chk(w.S.aid==='g1', 'resetG: MANTEM no jogo (S.aid=g1) — nao ejeta');
    chk(w.tab==='scout', 'resetG: continua no scout (tab=scout)');
    chk(w.gF('g1').st==='pending', 'resetG: jogo volta pra pending');
    chk(w.gF('g1').ss.length===1 && w.gF('g1').ss[0].u===0 && w.gF('g1').ss[0].t===0, 'resetG: placar zerado');
    chk(!orfao(), 'resetG: NAO cai no estado orfao (tab=scout + S.aid=null) <-- o bug');

    // 3. FINALIZAR JOGO -> volta pra galeria de torneios (nao a tela orfa)
    w.openGameDayCard('g1'); w.gF('g1').st='live';
    try{ w.enG(); }catch(e){}
    chk(w.S.aid===null && w.tab==='torneios', 'enG: volta pra galeria (tab=torneios, S.aid=null)');
    chk(w.gF('g1').st==='done', 'enG: jogo vira done');
    chk(!orfao(), 'enG: NAO cai no estado orfao');

    // 4. scoutBack (Voltar) -> galeria
    w.openGameDayCard('g1'); w.gF('g1').st='live';
    w.scoutBack();
    chk(w.S.aid===null && w.tab==='torneios', 'scoutBack: volta pra galeria (tab=torneios)');
    chk(!orfao(), 'scoutBack: NAO cai no estado orfao');

    console.log('\n=== '+ok+' ok, '+ko+' falhas ===');
    console.log(ko===0?'OK NAVEGACAO ZERAR/FINALIZAR APROVADA':'FAIL REPROVADA');
    process.exit(ko===0?0:1);
  } catch(e){
    console.log('ERRO GERAL: '+e.message);
    console.log(e.stack);
    process.exit(1);
  }
},700);
