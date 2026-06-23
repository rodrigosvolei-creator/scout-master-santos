// Frente C — Apos rotacao (side-out), pre-seleciona sacador P1 + fundamento Saque.
// Asserta: pre-selecao acontece SO no side-out; nao bloqueia trocar de atleta nem
// substituir; trocar o sacador deixa o novo pronto pra sacar.
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
    athletes:[{aid:'a1',nm:'Ana',po:'P'},{aid:'a2',nm:'Bia',po:'C'},{aid:'a3',nm:'Lui',po:'L'},{aid:'a4',nm:'Car',po:'C'},{aid:'a5',nm:'Dud',po:'O'},{aid:'a6',nm:'Fer',po:'P'},{aid:'a7',nm:'Gi',po:'P'}],
    tournaments:[{id:'tA',n:'Liga'}],
    games:[
      {id:'g_court',torId:'tA',tid:'trs',opp:'X',st:'live',courtMode:true,
        court:{ "1":{pos:base.slice(), serving:"them"} },
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
function setS(){ w.S={aid:'g_court',sp:null,sa:null,cs:1,us:[],tm:0,rn:false,ti:null}; }

setTimeout(()=>{
  try {
    ['teams','games','tournaments','athletes','invites'].forEach(k=>{
      const path='torneio-master-santos/'+k;
      if(listeners[path]) listeners[path]({val:()=>getAt(path)});
    });
    w.isScouter=true;

    // 1. side-out via scUp("u") (estavamos recebendo) -> rotaciona -> pre-seleciona P1+saque
    setS();
    w.gF('g_court').court["1"]={pos:base.slice(),serving:"them"};
    w.scUp("u"); // recupera saque -> roda: novo P1 = a2 (era idx1)
    var cs=w.gF('g_court').court["1"];
    chk(cs.pos[0]==="a2",'rotacao: a2 virou o sacador (P1)');
    chk(w.S.sp==="a2",'Frente C: S.sp pre-selecionado = sacador da P1 (a2)');
    chk(w.S.sa==="saque",'Frente C: fundamento pre-selecionado = saque (so falta o resultado)');

    // 2. NAO pre-seleciona quando NAO rotaciona (ja estavamos sacando)
    setS();
    w.gF('g_court').court["1"]={pos:base.slice(),serving:"us"};
    w.scUp("u"); // ja sacando, ponto nosso -> nao roda
    chk(w.S.sp===null && w.S.sa===null,'sacando + ponto nosso (sem rotacao): NAO pre-seleciona');

    // 3. NAO pre-seleciona em ponto do adversario
    setS();
    w.gF('g_court').court["1"]={pos:base.slice(),serving:"us"};
    w.scUp("t"); // ponto deles -> perde saque, sem rotacao
    chk(w.S.sp===null,'ponto do adversario: NAO pre-seleciona sacador');

    // 4. NAO bloqueia trocar de atleta: clicar em outro chama slP normal
    setS();
    w.gF('g_court').court["1"]={pos:base.slice(),serving:"them"};
    w.scUp("u"); // pre-seleciona a2
    chk(w.S.sp==="a2",'pos side-out: a2 pre-selecionado');
    w.slP("a4"); // coach decide marcar outro -> troca livre
    chk(w.S.sp==="a4",'NAO bloqueia: clicar em outro atleta troca a selecao (slP livre)');

    // 5. NAO bloqueia substituicao: trocar o sacador deixa o NOVO pronto pra sacar
    setS();
    w.gF('g_court').court["1"]={pos:base.slice(),serving:"them"};
    w.scUp("u"); // pre-seleciona a2 (P1)
    // substitui o sacador a2 pelo a7 (banco)
    w._courtSubOut="a2";
    w.courtSubDoIn("a7");
    var cs2=w.gF('g_court').court["1"];
    chk(cs2.pos[0]==="a7",'substituiu o sacador: a7 agora na P1');
    chk(w.S.sp==="a7" && w.S.sa==="saque",'Frente C: novo sacador (a7) ja vem pronto pra sacar apos a troca');

    // 6. rcO (acao que vira ponto) no side-out tambem pre-seleciona
    setS();
    w.gF('g_court').court["1"]={pos:base.slice(),serving:"them"};
    w.S.sp="a4"; w.S.sa="ataque";
    w.rcO("Ponto"); // ataque-ponto recebendo -> side-out -> roda -> pre-seleciona novo P1
    var cs3=w.gF('g_court').court["1"];
    chk(w.S.sp===cs3.pos[0] && w.S.sa==="saque",'rcO no side-out: pre-seleciona o novo sacador + saque');

    // 7. undo do rcO restaura a quadra (e nao deixa lixo)
    var posAntesUndo=w.gF('g_court').court["1"].pos.join(",");
    w.undo();
    chk(w.gF('g_court').court["1"].pos.join(",")!==posAntesUndo || w.gF('g_court').court["1"].serving==="them",'undo apos rcO reverte a rotacao');

    // 8. REGRESSAO: jogo classico nao e afetado pela pre-selecao
    w.D.games.push({id:'g_cl',tid:'trs',torId:'tA',st:'live',ss:[{u:0,t:0}],act:[],lineup:[{aid:'a1',nu:1}]});
    w.S={aid:'g_cl',sp:null,sa:null,cs:1,us:[],tm:0,rn:false,ti:null};
    w.scUp("u");
    chk(w.S.sp===null && w.S.sa===null,'jogo classico: scUp NAO pre-seleciona nada (sem courtMode)');

    console.log('\n=== '+ok+' ok, '+ko+' falhas ===');
    console.log(ko===0?'OK FRENTE C (saque auto) APROVADA':'FAIL FRENTE C REPROVADA');
    process.exit(ko===0?0:1);
  } catch(e){
    console.log('ERRO GERAL: '+e.message);
    console.log(e.stack);
    process.exit(1);
  }
},700);
