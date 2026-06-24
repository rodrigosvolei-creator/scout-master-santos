// Correcoes do pente fino (Leva 1): ataque bloqueado = ponto adv; set encerrado trava
// novos pontos; +/- (scUp) entra no undo; atleta sem cadastro nao some (stub orfao).
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');

const fakeDB = {};
const listeners = {};
function getAt(p){const a=p.split('/');let c=fakeDB;for(const k of a){if(c==null)return null;c=c[k];}return c===undefined?null:c;}
function setAt(p,v){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}c[a[a.length-1]]=JSON.parse(JSON.stringify(v));}
function makeRef(p){return{_path:p,on:function(e,cb){listeners[p]=cb;},once:function(){return Promise.resolve({val:()=>getAt(p)});},set:function(v){setAt(p,v);return Promise.resolve();},update:function(){return Promise.resolve();}};}
global.firebaseMock={initializeApp:()=>{},database:()=>({ref:makeRef}),auth:()=>({onAuthStateChanged:function(cb){setTimeout(()=>cb({uid:'t',email:'rodrigosvolei@gmail.com',displayName:'T'}),0);},signInWithPopup:()=>Promise.resolve(),signOut:()=>Promise.resolve()})};

const base=["a1","a2","a3","a4","a5","a6"];
const seed = {
  'torneio-master-santos': {
    teams:[{id:'trs',n:'RS',c:'#000',roster:[{aid:'a1'}]}],
    athletes:[{aid:'a1',nm:'Ana',po:'P'},{aid:'a2',nm:'Bia',po:'C'},{aid:'a3',nm:'Lui',po:'L'},{aid:'a4',nm:'Car',po:'C'},{aid:'a5',nm:'Dud',po:'O'},{aid:'a6',nm:'Fer',po:'P'}],
    tournaments:[{id:'tA',n:'Liga'}],
    games:[{id:'g1',torId:'tA',tid:'trs',opp:'X',st:'live',courtMode:true,
      court:{ "1":{pos:base.slice(),serving:"us"} }, ss:[{u:0,t:0}], act:[],
      lineup:[{aid:'a1',nu:1},{aid:'a2',nu:2},{aid:'a3',nu:3},{aid:'a4',nu:4},{aid:'a5',nu:5},{aid:'a6',nu:6}]}],
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
function setS(){ w.S={aid:'g1',sp:null,sa:null,cs:1,us:[],tm:0,rn:false,ti:null}; }
function G(){ return w.gF('g1'); }

setTimeout(()=>{
  try {
    ['teams','games','tournaments','athletes','invites'].forEach(k=>{const p='torneio-master-santos/'+k;if(listeners[p])listeners[p]({val:()=>getAt(p)});});
    w.isScouter=true;

    // 1. C6 — ataque bloqueado = ponto do adversario
    chk(w.autoScoreSide('ataque','Bloq')==='t','ataque Bloq = ponto adversario');
    chk(w.autoScoreSide('ataque','Ponto')==='u','regressao: ataque Ponto = nosso');
    chk(w.autoScoreSide('recepcao','Erro')==='t','regressao: recepcao Erro = adversario');

    // marcar ataque Bloq AO VIVO sobe o placar do adversario
    setS(); G().court={ "1":{pos:base.slice(),serving:"us"} }; G().ss=[{u:0,t:0}]; G().act=[];
    w.S.sp="a4"; w.S.sa="ataque"; w.rcO("Bloq");
    chk(G().ss[0].t===1 && G().ss[0].u===0,'rcO ataque Bloq sobe placar do adversario (0-1)');

    // 2. M3 — set encerrado trava novos pontos (rcO e scUp)
    setS(); G().court={ "1":{pos:base.slice(),serving:"us"} }; G().ss=[{u:25,t:20}]; G().act=[];
    var nb=G().act.length;
    w.S.sp="a4"; w.S.sa="ataque"; w.rcO("Ponto");
    chk(G().act.length===nb && G().ss[0].u===25,'set encerrado (25-20): rcO NAO grava nem mexe no placar');
    w.scUp("u");
    chk(G().ss[0].u===25,'set encerrado: scUp (+) tambem bloqueado');

    // 3. +/- no undo — scUp manual empilha e o undo reverte (placar + quadra)
    setS(); G().court={ "1":{pos:base.slice(),serving:"them"} }; G().ss=[{u:0,t:0}]; G().act=[];
    w.scUp("u"); // ponto nosso recebendo -> roda a quadra + empilha undo
    chk(G().ss[0].u===1 && w.S.us.length===1 && w.S.us[0].manual===true,'scUp manual: sobe placar e EMPILHA no undo (manual)');
    var posDepois=G().court["1"].pos.join(",");
    w.undo();
    chk(G().ss[0].u===0,'undo reverte o ponto do scUp manual');
    chk(G().court["1"].pos.join(",")!==posDepois || G().court["1"].serving==="them",'undo restaura a rotacao da quadra do scUp');

    // 4. C2 — atleta sem cadastro nao some: pFind retorna stub orfao (nao null)
    var pf=w.pFind("pid_que_nao_existe_123");
    chk(pf && pf.orphan===true,'pFind de pid sem atleta retorna stub (orphan), nao null');
    chk(pf && /sem cadastro/.test(pf.nm),'stub orfao tem rotulo "(sem cadastro)" pra aparecer no relatorio');

    // 5. XSS — clnLogo so aceita data:image (logo malicioso vira null)
    chk(w.clnLogo('data:image/png;base64,iVBOR')==='data:image/png;base64,iVBOR','clnLogo aceita data:image/png');
    chk(w.clnLogo('x"><img src=y onerror=alert(1)>')===null,'clnLogo rejeita payload XSS (vira null)');
    chk(w.clnLogo('data:image/svg+xml;base64,PHN2Zw==')===null,'clnLogo rejeita svg (pode conter script)');

    console.log('\n=== '+ok+' ok, '+ko+' falhas ===');
    console.log(ko===0?'OK PENTE FINO LEVA 1 APROVADO':'FAIL REPROVADO');
    process.exit(ko===0?0:1);
  } catch(e){
    console.log('ERRO GERAL: '+e.message);
    console.log(e.stack);
    process.exit(1);
  }
},700);
