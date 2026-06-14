// Q1 — UI da quadra: toggle, posicionamento (draft) e render clicavel.
// Asserta: courtRenderSetup/Panel produzem o HTML esperado; draft place/remove;
// courtConfirmSetup grava g.court[set]; courtManualRotate gira; e o scout
// CLASSICO segue intacto (jogo sem courtMode nao muda nada).
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');

const fakeDB = {};
const listeners = {};
function getAt(p){const a=p.split('/');let c=fakeDB;for(const k of a){if(c==null)return null;c=c[k];}return c===undefined?null:c;}
function setAt(p,v){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}c[a[a.length-1]]=JSON.parse(JSON.stringify(v));}
function makeRef(p){return{_path:p,on:function(e,cb){listeners[p]=cb;},once:function(){return Promise.resolve({val:()=>getAt(p)});},set:function(v){setAt(p,v);return Promise.resolve();},update:function(){return Promise.resolve();}};}
global.firebaseMock={initializeApp:()=>{},database:()=>({ref:makeRef}),auth:()=>({onAuthStateChanged:function(cb){setTimeout(()=>cb(null),0);},signInWithPopup:()=>Promise.resolve(),signOut:()=>Promise.resolve()})};

const seed = {
  'torneio-master-santos': {
    teams:[{id:'trs',n:'FEM RS',c:'#db2777',roster:[{aid:'a1'},{aid:'a2'},{aid:'a3'},{aid:'a4'},{aid:'a5'},{aid:'a6'},{aid:'a7'}]}],
    athletes:[
      {aid:'a1',nm:'Ana',po:'P'},{aid:'a2',nm:'Bia',po:'C'},{aid:'a3',nm:'Lui',po:'L'},
      {aid:'a4',nm:'Car',po:'P'},{aid:'a5',nm:'Dud',po:'C'},{aid:'a6',nm:'Fer',po:'O'},{aid:'a7',nm:'Ghi',po:'P'}
    ],
    tournaments:[{id:'tA',n:'Liga'}],
    games:[
      {id:'g_court',torId:'tA',tid:'trs',opp:'X',dt:'2026-07-10',tm:'10:00',st:'live',courtMode:true,court:{},ss:[{u:0,t:0}],act:[],
        lineup:[{aid:'a1',nu:7},{aid:'a2',nu:5},{aid:'a3',nu:10},{aid:'a4',nu:3},{aid:'a5',nu:12},{aid:'a6',nu:9},{aid:'a7',nu:4}]},
      {id:'g_classic',torId:'tA',tid:'trs',opp:'Y',dt:'2026-07-11',tm:'10:00',st:'live',ss:[{u:0,t:0}],act:[],
        lineup:[{aid:'a1',nu:7},{aid:'a2',nu:5}]}
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

    var gp=[{id:'a1',nu:7,nm:'Ana'},{id:'a2',nu:5,nm:'Bia'},{id:'a3',nu:10,nm:'Lui'},{id:'a4',nu:3,nm:'Car'},{id:'a5',nu:12,nm:'Dud'},{id:'a6',nu:9,nm:'Fer'},{id:'a7',nu:4,nm:'Ghi'}];
    w.S={aid:'g_court',sp:null,sa:null,cs:1,us:[],tm:0,rn:false,ti:null};
    var gm=w.gF('g_court');

    // 1. Funcoes de UI existem
    chk(typeof w.toggleCourtMode==='function','toggleCourtMode existe');
    chk(typeof w.courtRenderSetup==='function','courtRenderSetup existe');
    chk(typeof w.courtRenderPanel==='function','courtRenderPanel existe');
    chk(typeof w.courtConfirmSetup==='function','courtConfirmSetup existe');

    // 2. Draft pre-preenche 6 (por menor numero)
    w._courtDraft=null;
    var d=w.courtDraftEnsure(gm,gp);
    chk(d.pos.filter(Boolean).length===6,'courtDraftEnsure pre-preenche 6 posicoes');
    chk(d.serving==='us','draft default: nós sacamos');

    // 3. courtRenderSetup emite quadra + start
    var setupHtml=w.courtRenderSetup(gm,gp);
    chk((setupHtml.match(/court-cell/g)||[]).length===6,'setup: 6 court-cell');
    chk(setupHtml.indexOf('court-start')>=0,'setup: botao Iniciar set');
    chk(setupHtml.indexOf('court-bench-card')>=0,'setup: banco com atletas extras (7-6=1)');

    // 4. Place/remove no draft
    var benchAid='a7'; // 7o atleta, fora dos 6 iniciais (numeros 7,5,10,3,12,9 sao menores que... ver)
    // os 6 de menor numero: 3,4,5,7,9,10 -> aids a4,a7,a2,a1,a6,a3. Sobra a5(12) e... 7 atletas, 6 entram, 1 sobra
    var sobra=d.pos.indexOf('a5')<0?'a5':null;
    chk(sobra==='a5','draft deixou a #12 (Dud) no banco (maior numero)');
    var lenAntes=d.pos.filter(Boolean).length;
    w.courtDraftRemove(0); // tira o sacador
    chk(w._courtDraft.pos.filter(Boolean).length===lenAntes-1,'courtDraftRemove tira do slot');
    w.courtDraftPlace('a5'); // poe a Dud no slot vazio
    chk(w._courtDraft.pos.indexOf('a5')>=0,'courtDraftPlace coloca no slot vazio');

    // 5. courtConfirmSetup grava g.court[set]
    // garante 6 preenchidos
    w._courtDraft.pos=['a1','a2','a3','a4','a5','a6']; w._courtDraft.serving='them';
    w.courtConfirmSetup();
    var saved=w.gF('g_court').court['1'];
    chk(saved && saved.pos.length===6,'courtConfirmSetup grava g.court[1].pos (6)');
    chk(saved.serving==='them','courtConfirmSetup grava serving escolhido');
    chk(w._courtDraft===null,'courtConfirmSetup limpa o rascunho');

    // 6. courtRenderPanel: quadra clicavel
    var panel=w.courtRenderPanel(w.gF('g_court'),gp,{c:'#db2777'});
    chk((panel.match(/court-cell live/g)||[]).length===6,'panel: 6 court-cell live');
    chk(panel.indexOf('slP(')>=0,'panel: clicar chama slP (reusa fluxo existente)');
    chk(panel.indexOf('courtSub')>=0 && panel.indexOf('courtManualRotate')>=0,'panel: botoes substituir + rodar');

    // 7. courtManualRotate gira a quadra salva
    var before=w.gF('g_court').court['1'].pos.slice();
    w.courtManualRotate(1);
    var after=w.gF('g_court').court['1'].pos;
    chk(after[0]===before[1] && after[5]===before[0],'courtManualRotate(1) gira horario');
    w.courtManualRotate(-1);
    chk(JSON.stringify(w.gF('g_court').court['1'].pos)===JSON.stringify(before),'courtManualRotate(-1) desfaz');

    // 8. toggleCourtMode liga/desliga
    var g2=w.gF('g_court'); var wasOn=g2.courtMode;
    w.S={aid:'g_court',sp:null,sa:null,cs:1,us:[],tm:0,rn:false,ti:null};
    w.toggleCourtMode();
    chk(w.gF('g_court').courtMode===!wasOn,'toggleCourtMode inverte courtMode');
    w.toggleCourtMode(); // volta

    // 9. REGRESSAO: jogo classico (sem courtMode) — rSct nao usa quadra
    w.S={aid:'g_classic',sp:null,sa:null,cs:1,us:[],tm:0,rn:false,ti:null};
    var classic=w.rSct();
    chk(classic.indexOf('court-cell')<0,'jogo classico: SEM quadra (court-cell ausente)');
    chk(classic.indexOf('sc-pcard')>=0 || classic.indexOf('sc-players')>=0,'jogo classico: cards .sc-pcard normais');

    console.log('\n=== '+ok+' ok, '+ko+' falhas ===');
    console.log(ko===0?'OK QUADRA Q1 APROVADA':'FAIL QUADRA Q1 REPROVADA');
    process.exit(ko===0?0:1);
  } catch(e){
    console.log('ERRO GERAL: '+e.message);
    console.log(e.stack);
    process.exit(1);
  }
},700);
