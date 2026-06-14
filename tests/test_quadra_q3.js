// Q3 — Substituicao na quadra: troca jogador da quadra por um do banco, mantendo posicao.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');

const fakeDB = {};
const listeners = {};
function getAt(p){const a=p.split('/');let c=fakeDB;for(const k of a){if(c==null)return null;c=c[k];}return c===undefined?null:c;}
function setAt(p,v){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}c[a[a.length-1]]=JSON.parse(JSON.stringify(v));}
function makeRef(p){return{_path:p,on:function(e,cb){listeners[p]=cb;},once:function(){return Promise.resolve({val:()=>getAt(p)});},set:function(v){setAt(p,v);return Promise.resolve();},update:function(){return Promise.resolve();}};}
global.firebaseMock={initializeApp:()=>{},database:()=>({ref:makeRef}),auth:()=>({onAuthStateChanged:function(cb){setTimeout(()=>cb(null),0);},signInWithPopup:()=>Promise.resolve(),signOut:()=>Promise.resolve()})};

const base=["a1","a2","a3","a4","a5","a6"];
const seed = {
  'torneio-master-santos': {
    teams:[{id:'trs',n:'FEM RS',c:'#db2777',roster:[{aid:'a1'}]}],
    athletes:[{aid:'a1',nm:'Ana'},{aid:'a2',nm:'Bia'},{aid:'a3',nm:'Lui'},{aid:'a4',nm:'Car'},{aid:'a5',nm:'Dud'},{aid:'a6',nm:'Fer'},{aid:'a7',nm:'Ghi'},{aid:'a8',nm:'Pai'}],
    tournaments:[{id:'tA',n:'Liga'}],
    games:[
      {id:'g_court',torId:'tA',tid:'trs',opp:'X',st:'live',courtMode:true,
        court:{ "1":{pos:base.slice(), serving:"us"} },
        ss:[{u:0,t:0}], act:[],
        lineup:[{aid:'a1',nu:7},{aid:'a2',nu:5},{aid:'a3',nu:10},{aid:'a4',nu:3},{aid:'a5',nu:12},{aid:'a6',nu:9},{aid:'a7',nu:4},{aid:'a8',nu:2}]}
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

setTimeout(()=>{
  try {
    ['teams','games','tournaments','athletes','invites'].forEach(k=>{
      const path='torneio-master-santos/'+k;
      if(listeners[path]) listeners[path]({val:()=>getAt(path)});
    });
    w.isScouter=true;
    w.S={aid:'g_court',sp:null,sa:null,cs:1,us:[],tm:0,rn:false,ti:null};

    chk(typeof w.courtSub==='function','courtSub existe');
    chk(typeof w.courtSubDoIn==='function','courtSubDoIn existe');

    // 1. Abre o modal
    w.courtSub();
    chk(!!w.document.getElementById('courtSubModal'),'courtSub abre o modal');
    var benchCards=w.document.querySelectorAll('.court-sub-card.in').length;
    chk(benchCards===2,'modal mostra 2 no banco (a7,a8): '+benchCards);
    var outCards=w.document.querySelectorAll('.court-sub-card').length - benchCards;
    chk(outCards===6,'modal mostra 6 em quadra pra sair');

    // 2. Banco desabilitado ate escolher quem sai
    var disabledIn=w.document.querySelectorAll('.court-sub-card.in[disabled]').length;
    chk(disabledIn===2,'entradas desabilitadas ate escolher quem sai');

    // 3. Seleciona quem sai (a3, na posicao 3 = idx2)
    w.courtSubSelOut('a3');
    chk(w._courtSubOut==='a3','courtSubSelOut marca quem sai');
    var enabledNow=w.document.querySelectorAll('.court-sub-card.in:not([disabled])').length;
    chk(enabledNow===2,'apos escolher quem sai, entradas habilitam');

    // 4. Executa a troca: a7 entra no lugar de a3 (mantem posicao idx2)
    var posBefore=w.gF('g_court').court["1"].pos.slice();
    chk(posBefore[2]==='a3','antes: a3 na posicao idx2');
    w.courtSubDoIn('a7');
    var posAfter=w.gF('g_court').court["1"].pos;
    chk(posAfter[2]==='a7','depois: a7 assumiu a posicao idx2 (mantida)');
    chk(posAfter.indexOf('a3')<0,'a3 saiu da quadra');
    chk(posAfter[0]==='a1'&&posAfter[1]==='a2'&&posAfter[3]==='a4','outras posicoes intactas');
    chk(w.document.getElementById('courtSubModal')==null,'modal fecha apos a troca');
    chk(w._courtSubOut===null,'_courtSubOut limpo apos troca');

    // 5. A que saiu (a3) volta pro banco; a que entrou (a7) some do banco
    w.courtSub();
    var benchAids=[].map.call(w.document.querySelectorAll('.court-sub-card.in'),function(b){return b.getAttribute('onclick');}).join(' ');
    chk(benchAids.indexOf('a3')>=0,'a3 voltou pro banco');
    chk(benchAids.indexOf('a7')<0,'a7 nao esta mais no banco (esta em quadra)');
    chk(benchAids.indexOf('a8')>=0,'a8 continua no banco');
    w.closeCourtSub();

    // 6. Rotacao continua funcionando com o substituto (a7 agora roda junto)
    w.gF('g_court').court["1"]={pos:["a7","a2","a3x","a4","a5","a6"],serving:"them"};
    w.gF('g_court').court["1"].pos=["a7","a2","a3","a4","a5","a6"]; // a7 na P1 (sacador)
    w.scUp("u"); // nao estavamos sacando? serving=them -> recupera -> roda
    chk(w.gF('g_court').court["1"].pos[0]==="a2",'rotacao apos sub: a7 saiu do saque, a2 assume');

    // 7. courtSub e seguro fora do modo quadra
    w.D.games.push({id:'g_nc',tid:'trs',torId:'tA',ss:[{u:0,t:0}],act:[],lineup:[]});
    w.S={aid:'g_nc',sp:null,sa:null,cs:1,us:[],tm:0,rn:false,ti:null};
    var e=null; try{ w.courtSub(); }catch(ex){ e=ex; }
    chk(!e && w.document.getElementById('courtSubModal')==null,'courtSub em jogo sem courtMode: nao abre modal, nao quebra');

    console.log('\n=== '+ok+' ok, '+ko+' falhas ===');
    console.log(ko===0?'OK QUADRA Q3 APROVADA':'FAIL QUADRA Q3 REPROVADA');
    process.exit(ko===0?0:1);
  } catch(e){
    console.log('ERRO GERAL: '+e.message);
    console.log(e.stack);
    process.exit(1);
  }
},700);
