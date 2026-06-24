// Correcoes dos bugs do setup (reportados ao vivo no modo tablet):
// (1) libero NUNCA inicia na frente (P2/P3/P4); (2) saque comeca indefinido e e
// obrigatorio escolher; (3) courtConfirmSetup bloqueia libero-na-frente e sem-saque;
// (4) resetSet zera so o set atual mantendo o jogo ao vivo.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');

const fakeDB = {};
const listeners = {};
function getAt(p){const a=p.split('/');let c=fakeDB;for(const k of a){if(c==null)return null;c=c[k];}return c===undefined?null:c;}
function setAt(p,v){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}c[a[a.length-1]]=JSON.parse(JSON.stringify(v));}
function makeRef(p){return{_path:p,on:function(e,cb){listeners[p]=cb;},once:function(){return Promise.resolve({val:()=>getAt(p)});},set:function(v){setAt(p,v);return Promise.resolve();},update:function(){return Promise.resolve();}};}
global.firebaseMock={initializeApp:()=>{},database:()=>({ref:makeRef}),auth:()=>({onAuthStateChanged:function(cb){setTimeout(()=>cb({uid:'t',email:'rodrigosvolei@gmail.com',displayName:'T'}),0);},signInWithPopup:()=>Promise.resolve(),signOut:()=>Promise.resolve()})};

// Libero com numero BAIXO (#1) — exatamente o caso que reproduzia o bug (Mateus #1 na P2)
const seed = {
  'torneio-master-santos': {
    teams:[{id:'trs',n:'RS',c:'#000',roster:[{aid:'a1'},{aid:'a2'},{aid:'a3'},{aid:'a4'},{aid:'a5'},{aid:'a6'},{aid:'a7'}]}],
    athletes:[
      {aid:'a1',nm:'Libero Um',po:'Líbero'},
      {aid:'a2',nm:'Dois',po:'Ponteiro'},{aid:'a3',nm:'Tres',po:'Central'},{aid:'a4',nm:'Quatro',po:'Oposto'},
      {aid:'a5',nm:'Cinco',po:'Ponteiro'},{aid:'a6',nm:'Seis',po:'Central'},{aid:'a7',nm:'Sete',po:'Levantador'}
    ],
    tournaments:[{id:'tA',n:'Liga'}],
    games:[{id:'g1',torId:'tA',tid:'trs',opp:'X',st:'live',courtMode:true,ss:[{u:0,t:0}],act:[],
      lineup:[{aid:'a1',nu:1},{aid:'a2',nu:2},{aid:'a3',nu:3},{aid:'a4',nu:4},{aid:'a5',nu:5},{aid:'a6',nu:6},{aid:'a7',nu:7}]}],
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

setTimeout(()=>{
  try {
    ['teams','games','tournaments','athletes','invites'].forEach(k=>{
      const path='torneio-master-santos/'+k;
      if(listeners[path]) listeners[path]({val:()=>getAt(path)});
    });
    w.isScouter=true;
    const gm=w.gF('g1');
    const gp=w._courtGp(gm); // mesma lista que o setup usa
    w.S={aid:'g1',sp:null,sa:null,cs:1,us:[],tm:0,rn:false,ti:null};

    // 1. courtDraftEnsure: o libero #1 (numero baixo) NAO vai pra quadra na frente
    w._courtDraft=null;
    const d=w.courtDraftEnsure(gm,gp);
    function libNaFrente(pos){return [1,2,3].some(function(i){var a=pos[i];var p=a?gp.filter(function(x){return x.id===a;})[0]:null;return p&&w._isLibero(p);});}
    chk(!libNaFrente(d.pos),'courtDraftEnsure: NENHUM libero comeca na frente (P2/P3/P4)');
    chk(d.pos.indexOf('a1')<0,'courtDraftEnsure: libero #1 ficou no banco (havia 6 nao-liberos)');
    chk(d.pos.filter(Boolean).length===6,'courtDraftEnsure: 6 posicionados');

    // 2. saque comeca INDEFINIDO (usuario escolhe)
    chk(d.serving===null,'courtDraftEnsure: saque indefinido (serving=null)');

    // 3a. courtConfirmSetup BLOQUEIA sem saque escolhido
    w._courtDraft={gid:'g1',set:'1',pos:['a2','a3','a4','a5','a6','a7'],serving:null,pick:null};
    w.courtConfirmSetup();
    chk(!(gm.court&&gm.court['1']),'courtConfirmSetup: bloqueia iniciar SEM escolher saque');

    // 3b. courtConfirmSetup BLOQUEIA libero na frente (a1=libero em P2/idx1)
    w._courtDraft={gid:'g1',set:'1',pos:['a2','a1','a3','a4','a5','a6'],serving:'us',pick:null};
    w.courtConfirmSetup();
    chk(!(gm.court&&gm.court['1']),'courtConfirmSetup: bloqueia libero na FRENTE (P2)');
    chk(w._courtDraft!==null,'courtConfirmSetup: rascunho mantido quando bloqueia');

    // 3c. courtConfirmSetup GRAVA quando ok (libero no fundo + saque escolhido)
    w._courtDraft={gid:'g1',set:'1',pos:['a1','a2','a3','a4','a5','a6'],serving:'them',pick:null}; // a1 libero em P1 (fundo)
    w.courtConfirmSetup();
    chk(gm.court&&gm.court['1']&&gm.court['1'].pos.length===6,'courtConfirmSetup: grava quando libero no fundo + saque ok');
    chk(gm.court['1'].serving==='them','courtConfirmSetup: grava o saque escolhido');

    // 4. resetSet: zera SO o set atual, mantem outros sets e o jogo AO VIVO
    gm.ss=[{u:25,t:20},{u:10,t:8,sq:['u','u','t']}];
    gm.court={'2':{pos:['a1','a2','a3','a4','a5','a6'],serving:'us'}};
    w.S={aid:'g1',sp:'a2',sa:'ataque',cs:2,us:[],tm:0,rn:false,ti:null};
    w.confirmModal=function(o){ if(o&&o.onConfirm)o.onConfirm(); };
    w.resetSet();
    chk(w.gF('g1').ss[1].u===0 && w.gF('g1').ss[1].t===0,'resetSet: zera o placar do set atual (set 2)');
    chk((w.gF('g1').ss[1].sq||[]).length===0,'resetSet: zera a sequencia (sq) do set atual');
    chk(w.gF('g1').ss[0].u===25 && w.gF('g1').ss[0].t===20,'resetSet: NAO mexe nos outros sets (set 1 intacto)');
    chk(w.gF('g1').st==='live','resetSet: jogo continua AO VIVO');
    chk(!(w.gF('g1').court&&w.gF('g1').court['2']),'resetSet (courtMode): reabre o posicionamento do set');

    console.log('\n=== '+ok+' ok, '+ko+' falhas ===');
    console.log(ko===0?'OK SETUP/LIBERO/RESETSET APROVADO':'FAIL REPROVADO');
    process.exit(ko===0?0:1);
  } catch(e){
    console.log('ERRO GERAL: '+e.message);
    console.log(e.stack);
    process.exit(1);
  }
},700);
