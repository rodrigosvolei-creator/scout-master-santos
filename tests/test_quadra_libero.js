// Frente D — Libero automatico: auto-saida ao chegar na frente, par dinamico.
// Asserta: courtLiberoExit (sai na frente / fica no fundo); courtApplyPoint roda
// e tira o libero no side-out que o leva pra frente; courtLiberoSwap amarra par;
// sequencia real (entra no fundo -> rotaciona -> sai sozinho, par volta); SEM auto-entrada.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');

const fakeDB = {};
const listeners = {};
function getAt(p){const a=p.split('/');let c=fakeDB;for(const k of a){if(c==null)return null;c=c[k];}return c===undefined?null:c;}
function setAt(p,v){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}c[a[a.length-1]]=JSON.parse(JSON.stringify(v));}
function makeRef(p){return{_path:p,on:function(e,cb){listeners[p]=cb;},once:function(){return Promise.resolve({val:()=>getAt(p)});},set:function(v){setAt(p,v);return Promise.resolve();},update:function(){return Promise.resolve();}};}
global.firebaseMock={initializeApp:()=>{},database:()=>({ref:makeRef}),auth:()=>({onAuthStateChanged:function(cb){setTimeout(()=>cb({uid:'tester',email:'rodrigosvolei@gmail.com',displayName:'Tester'}),0);},signInWithPopup:()=>Promise.resolve(),signOut:()=>Promise.resolve()})};

// a7 = Líbero (no banco). a1..a6 em quadra.
const base=["a1","a2","a3","a4","a5","a6"];
const seed = {
  'torneio-master-santos': {
    teams:[{id:'trs',n:'FEM RS',c:'#db2777',roster:[{aid:'a1'}]}],
    athletes:[{aid:'a1',nm:'Ana',po:'Ponteira'},{aid:'a2',nm:'Bia',po:'Central'},{aid:'a3',nm:'Lui',po:'Levantadora'},{aid:'a4',nm:'Car',po:'Central'},{aid:'a5',nm:'Dud',po:'Oposta'},{aid:'a6',nm:'Fer',po:'Ponteira'},{aid:'a7',nm:'Lib',po:'Líbero'}],
    tournaments:[{id:'tA',n:'Liga'}],
    games:[
      {id:'g_court',torId:'tA',tid:'trs',opp:'X',st:'live',courtMode:true,
        court:{ "1":{pos:base.slice(), serving:"us"} },
        ss:[{u:0,t:0}], act:[],
        lineup:[{aid:'a1',nu:1},{aid:'a2',nu:2},{aid:'a3',nu:3},{aid:'a4',nu:4},{aid:'a5',nu:5},{aid:'a6',nu:6},{aid:'a7',nu:7}]}
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
function P(){return w.gF('g_court').court["1"].pos.join(",");}

setTimeout(()=>{
  try {
    ['teams','games','tournaments','athletes','invites'].forEach(k=>{
      const path='torneio-master-santos/'+k;
      if(listeners[path]) listeners[path]({val:()=>getAt(path)});
    });
    w.isScouter=true;

    chk(typeof w.courtLiberoExit==='function','courtLiberoExit existe');
    chk(typeof w.courtLiberoSwap==='function','courtLiberoSwap existe');

    // 1. courtLiberoExit PURO — libero no fundo (P1/P6/P5) fica
    var csF={pos:["a7","a2","a3","a4","a5","a6"],serving:"us",libPair:{lib:"a7",out:"a1"}}; // a7 em P1 (idx0, fundo)
    var r1=w.courtLiberoExit(csF);
    chk(r1.pos[0]==="a7" && r1.libPair,'libero no fundo (P1): NAO sai');
    // libero na frente (P4 idx3) sai e par volta
    var csFr={pos:["a1","a2","a3","a7","a5","a6"],serving:"us",libPair:{lib:"a7",out:"aX"}};
    var r2=w.courtLiberoExit(csFr);
    chk(r2.pos[3]==="aX" && r2.libPair===null,'libero na frente (P4): SAI, par (aX) volta na posicao, par limpo');
    // P2 (idx1) e P3 (idx2) tambem sao frente
    chk(w.courtLiberoExit({pos:["a1","a7","a3","a4","a5","a6"],serving:"us",libPair:{lib:"a7",out:"aY"}}).pos[1]==="aY",'libero em P2 tambem sai');

    // 2. courtApplyPoint integra a saida: side-out leva libero de P5 (idx4) -> P4 (idx3) -> sai
    var cs={pos:["a1","a2","a3","a4","a7","a6"],serving:"them",libPair:{lib:"a7",out:"a5"}}; // a7 em P5, substituiu a5
    var nx=w.courtApplyPoint(cs,"us"); // ponto nosso recebendo -> rotaciona -> a7 vai pra idx3 (P4) -> sai
    chk(nx.serving==="us",'side-out: viramos sacadores');
    chk(nx.pos[3]==="a5" && nx.libPair===null,'side-out leva libero pra P4 -> auto-saida, a5 volta');
    chk(nx.pos.indexOf("a7")<0,'libero saiu da quadra apos ir pra frente');
    // imutabilidade
    chk(cs.pos[4]==="a7",'courtApplyPoint nao mutou o original (libero ainda em P5 no input)');

    // 3. courtApplyPoint sem libero na frente: rotaciona mas libero fica (estava em P6 -> vai P5, ainda fundo)
    var cs2={pos:["a1","a2","a3","a4","a5","a7"],serving:"them",libPair:{lib:"a7",out:"a6"}}; // a7 em P6 (idx5)
    var nx2=w.courtApplyPoint(cs2,"us"); // rotaciona: idx5 -> idx4 (P5, fundo)
    chk(nx2.pos[4]==="a7" && nx2.libPair,'rotacao P6->P5 (fundo): libero permanece, par mantido');

    // 4. courtLiberoSwap: troca atleta da quadra pelo libero, amarra par
    w.S={aid:'g_court',sp:null,sa:null,cs:1,us:[],tm:0,rn:false,ti:null};
    w.gF('g_court').court["1"]={pos:base.slice(),serving:"us"}; // sem libPair, a1..a6
    // a5 (central) esta em P5 (idx4, fundo) -> trocar pelo libero
    w.courtLiberoSwap("a5");
    var csNow=w.gF('g_court').court["1"];
    chk(csNow.pos[4]==="a7",'courtLiberoSwap: libero (a7) entrou na posicao do a5 (idx4)');
    chk(csNow.libPair && csNow.libPair.lib==="a7" && csNow.libPair.out==="a5",'courtLiberoSwap: par amarrado (a7 substituiu a5)');
    chk(csNow.pos.indexOf("a5")<0,'a5 saiu da quadra');

    // 5. Sequencia REAL: libero entrou em P5; varios side-outs ate ele ir pra frente e sair sozinho
    w.gF('g_court').court["1"]={pos:["a1","a2","a3","a4","a7","a6"],serving:"them",libPair:{lib:"a7",out:"a5"}};
    w.S={aid:'g_court',sp:null,sa:null,cs:1,us:[],tm:0,rn:false,ti:null};
    w.scUp("u"); // side-out: roda, a7 (P5 idx4)->P4 idx3 -> SAI, a5 volta
    var seqCs=w.gF('g_court').court["1"];
    chk(seqCs.pos.indexOf("a7")<0 && seqCs.libPair===null,'sequencia: 1 side-out leva libero pra frente -> sai sozinho');
    chk(seqCs.pos[3]==="a5",'sequencia: a5 (par) voltou na P4');

    // 6. SEM auto-entrada: libero fora, par no fundo de novo -> libero NAO volta sozinho
    w.gF('g_court').court["1"]={pos:["a5","a2","a3","a4","a6","a1"],serving:"them"}; // a5 em P1 (fundo), sem libPair, libero fora
    w.S={aid:'g_court',sp:null,sa:null,cs:1,us:[],tm:0,rn:false,ti:null};
    w.scUp("u"); // roda
    chk(w.gF('g_court').court["1"].pos.indexOf("a7")<0,'sem auto-entrada: libero permanece fora ate troca manual');

    // 7. courtLiberoSwap sem libero no banco: nao quebra
    w.gF('g_court').court["1"]={pos:["a1","a2","a3","a4","a5","a7"],serving:"us"}; // a7(libero) JA em quadra, banco sem libero
    var e=null; try{ w.courtLiberoSwap("a1"); }catch(ex){ e=ex; }
    chk(!e,'courtLiberoSwap sem libero no banco: nao quebra (toast)');

    console.log('\n=== '+ok+' ok, '+ko+' falhas ===');
    console.log(ko===0?'OK LIBERO AUTOMATICO APROVADO':'FAIL LIBERO REPROVADO');
    process.exit(ko===0?0:1);
  } catch(e){
    console.log('ERRO GERAL: '+e.message);
    console.log(e.stack);
    process.exit(1);
  }
},700);
