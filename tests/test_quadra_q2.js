// Q2 — Rotacao automatica ligada ao placar real (rcO/scUp) + undo.
// Asserta: ponto nosso sacando NAO roda; ponto deles tira nosso saque; recuperar
// o saque ROTACIONA; rcO(auto-ponto) roda no side-out e o undo REVERTE a rotacao;
// scDn nao mexe na quadra; jogo classico nao e afetado.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');

const fakeDB = {};
const listeners = {};
function getAt(p){const a=p.split('/');let c=fakeDB;for(const k of a){if(c==null)return null;c=c[k];}return c===undefined?null:c;}
function setAt(p,v){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}c[a[a.length-1]]=JSON.parse(JSON.stringify(v));}
function makeRef(p){return{_path:p,on:function(e,cb){listeners[p]=cb;},once:function(){return Promise.resolve({val:()=>getAt(p)});},set:function(v){setAt(p,v);return Promise.resolve();},update:function(){return Promise.resolve();}};}
global.firebaseMock={initializeApp:()=>{},database:()=>({ref:makeRef}),auth:()=>({onAuthStateChanged:function(cb){setTimeout(()=>cb({uid:'tester',email:'rodrigosvolei@gmail.com',displayName:'Tester'}),0);},signInWithPopup:()=>Promise.resolve(),signOut:()=>Promise.resolve()})};

const base=["a1","a2","a3","a4","a5","a6"];
const seed = {
  'torneio-master-santos': {
    teams:[{id:'trs',n:'FEM RS',c:'#db2777',roster:[{aid:'a1'}]}],
    athletes:[{aid:'a1',nm:'Ana'},{aid:'a2',nm:'Bia'},{aid:'a3',nm:'Lui'},{aid:'a4',nm:'Car'},{aid:'a5',nm:'Dud'},{aid:'a6',nm:'Fer'}],
    tournaments:[{id:'tA',n:'Liga'}],
    games:[
      {id:'g_court',torId:'tA',tid:'trs',opp:'X',st:'live',courtMode:true,
        court:{ "1":{pos:base.slice(), serving:"us"} },
        ss:[{u:0,t:0}], act:[], lineup:[{aid:'a1',nu:7},{aid:'a2',nu:5},{aid:'a3',nu:10},{aid:'a4',nu:3},{aid:'a5',nu:12},{aid:'a6',nu:9}]},
      {id:'g_classic',torId:'tA',tid:'trs',opp:'Y',st:'live',ss:[{u:0,t:0}],act:[],lineup:[{aid:'a1',nu:7}]}
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
function pos(){return w.gF('g_court').court["1"].pos.join(",");}
function serving(){return w.gF('g_court').court["1"].serving;}

setTimeout(()=>{
  try {
    ['teams','games','tournaments','athletes','invites'].forEach(k=>{
      const path='torneio-master-santos/'+k;
      if(listeners[path]) listeners[path]({val:()=>getAt(path)});
    });
    w.isScouter=true;

    function resetCourt(serv){ var g=w.gF('g_court'); g.court["1"]={pos:base.slice(),serving:serv}; g.ss=[{u:0,t:0}]; }
    function setS(){ w.S={aid:'g_court',sp:null,sa:null,cs:1,us:[],tm:0,rn:false,ti:null}; }

    // 1. scUp manual: ponto NOSSO sacando -> NAO roda
    setS(); resetCourt("us");
    w.scUp("u");
    chk(pos()==="a1,a2,a3,a4,a5,a6" && serving()==="us",'scUp ponto nosso sacando: NAO roda, continua saque');

    // 2. ponto DELES -> perde saque, sem rotacao
    setS(); resetCourt("us");
    w.scUp("t");
    chk(pos()==="a1,a2,a3,a4,a5,a6" && serving()==="them",'scUp ponto deles: perdemos saque, sem rotacao');

    // 3. eles sacando + ponto nosso -> RECUPERA + ROTACIONA
    setS(); resetCourt("them");
    w.scUp("u");
    chk(pos()==="a2,a3,a4,a5,a6,a1" && serving()==="us",'scUp recupera saque (side-out): ROTACIONA');

    // 4. rcO (auto-ponto Ace) no side-out + UNDO reverte rotacao
    setS(); resetCourt("them");          // eles sacando
    w.S.sp="a1"; w.S.sa="saque";          // atleta + fundamento selecionados
    w.rcO("Ace");                         // ponto nosso -> recupera -> ROTACIONA
    chk(pos()==="a2,a3,a4,a5,a6,a1" && serving()==="us",'rcO(Ace) no side-out: ROTACIONA');
    chk(w.gF('g_court').ss[0].u===1,'rcO(Ace): placar nosso subiu (auto-ponto intacto)');
    w.undo();                             // desfaz a acao
    chk(pos()==="a1,a2,a3,a4,a5,a6" && serving()==="them",'undo: REVERTE a rotacao (volta pos e serving)');
    chk(w.gF('g_court').ss[0].u===0,'undo: placar tambem volta (auto-ponto revertido)');

    // 5. scDn nao mexe na quadra (v1: correcao manual usa rodar/voltar)
    setS(); resetCourt("us"); w.gF('g_court').ss[0].u=3;
    var before=pos();
    w.scDn("u");
    chk(pos()===before,'scDn nao rotaciona a quadra (v1 esperado)');

    // 6. Sequencia realista de rali (eles sacam, troca-troca)
    setS(); resetCourt("them");
    w.scUp("u"); // recupera -> roda 1x (a2..a1)
    w.scUp("u"); // mantem -> nao roda
    w.scUp("t"); // perde saque
    w.scUp("u"); // recupera -> roda de novo
    chk(serving()==="us",'sequencia: terminamos sacando');
    chk(pos()==="a3,a4,a5,a6,a1,a2",'sequencia: 2 side-outs = 2 rotacoes (a3 vira sacador)');

    // 7. REGRESSAO: jogo classico nao tem court, scUp nao quebra
    w.S={aid:'g_classic',sp:null,sa:null,cs:1,us:[],tm:0,rn:false,ti:null};
    var e=null; try{ w.scUp("u"); w.scUp("t"); }catch(ex){ e=ex; }
    chk(!e && w.gF('g_classic').ss[0].u===1,'jogo classico: scUp funciona normal, sem quadra, sem erro');
    chk(!w.gF('g_classic').court,'jogo classico: nenhum court criado');

    console.log('\n=== '+ok+' ok, '+ko+' falhas ===');
    console.log(ko===0?'OK QUADRA Q2 APROVADA':'FAIL QUADRA Q2 REPROVADA');
    process.exit(ko===0?0:1);
  } catch(e){
    console.log('ERRO GERAL: '+e.message);
    console.log(e.stack);
    process.exit(1);
  }
},700);
