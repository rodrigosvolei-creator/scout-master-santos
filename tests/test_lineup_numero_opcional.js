// Numero OPCIONAL na escalacao: da pra colocar so o nome agora e o numero depois.
// Asserta: addAdhocAthlete aceita sem numero; saveLineup grava entry com nu=null;
// reabrir nao mostra "null" no input; scout (rSct) mostra "—" e nao quebra;
// numero duplicado AINDA bloqueia quando informado; nome continua obrigatorio.
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
    teams:[{id:'trs',n:'RS ADULTO FEM',c:'#db2777',roster:[{aid:'a1'}]}],
    athletes:[{aid:'a1',nm:'Ana',po:'Ponta'}],
    tournaments:[{id:'tA',n:'Taca SP',c:'#2563eb'}],
    games:[
      {id:'g_novo',torId:'tA',tid:'trs',opp:'Campo Belo',dt:'2026-06-18',tm:'20:30',st:'pending'},
      {id:'g_sc',torId:'tA',tid:'trs',opp:'Campo Belo',dt:'2026-06-18',tm:'20:30',st:'live',ss:[{u:0,t:0}],act:[],
        lineup:[{aid:'adhoc_x1',nu:null,nm:'Fernanda Lins',po:''},{aid:'adhoc_x2',nu:8,nm:'Joice',po:''}]}
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
    window.alert=()=>{};
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
    var toasts=[]; w.toast=function(msg){toasts.push(msg);};

    // 1. addAdhocAthlete SEM numero -> cria row, sem erro
    w.openLineup('g_novo');
    w.document.getElementById('lu-new-nu').value=''; // sem numero
    w.document.getElementById('lu-new-nm').value='Fernanda Lins';
    w.document.getElementById('lu-new-po').value='';
    toasts.length=0;
    w.addAdhocAthlete('g_novo');
    chk(!toasts.some(function(t){return /inv/i.test(t);}),'addAdhocAthlete sem numero: NAO da erro de numero invalido');
    var adRows=w.document.querySelectorAll('.lu-row.lu-adhoc');
    chk(adRows.length===1,'addAdhocAthlete sem numero: row criada mesmo assim');
    var nuInp=adRows[0].querySelector('.lu-nu');
    chk(nuInp && (nuInp.value===''||nuInp.value==null),'row ad-hoc sem numero: input de numero vazio (nao "null")');

    // 2. Adiciona uma segunda SEM numero (nao deve dar falso conflito entre vazios)
    w.document.getElementById('lu-new-nm').value='Tatao';
    toasts.length=0;
    w.addAdhocAthlete('g_novo');
    chk(!toasts.some(function(t){return /em uso/i.test(t);}),'duas atletas sem numero: NAO acusa conflito de numero');
    chk(w.document.querySelectorAll('.lu-row.lu-adhoc').length===2,'segunda atleta sem numero adicionada');

    // 3. saveLineup grava as duas com nu=null
    toasts.length=0;
    w.saveLineup('g_novo');
    var g=w.gF('g_novo');
    chk(g.lineup && g.lineup.length>=2,'saveLineup grava escalacao sem numero: '+(g.lineup?g.lineup.length:0)+' atletas');
    var semNum=g.lineup.filter(function(l){return l.nu==null;});
    chk(semNum.length>=2,'entries sem numero gravados com nu=null (ajusta depois)');
    chk(!w.document.getElementById('lineupModal'),'saveLineup fechou o modal (salvou de verdade)');

    // 4. Nome continua OBRIGATORIO
    w.openLineup('g_novo');
    w.document.getElementById('lu-new-nu').value='5';
    w.document.getElementById('lu-new-nm').value=''; // sem nome
    toasts.length=0;
    w.addAdhocAthlete('g_novo');
    chk(toasts.some(function(t){return /nome/i.test(t);}),'sem nome: AINDA bloqueia (nome obrigatorio)');
    w.closeLineup();

    // 5. Reabrir escalacao salva (com nu=null) NAO mostra "null" no input
    w.openLineup('g_novo');
    var allNu=w.document.querySelectorAll('.lu-nu');
    var temNull=false; for(var i=0;i<allNu.length;i++){ if(allNu[i].value==='null')temNull=true; }
    chk(!temNull,'reabrir: nenhum input mostra "null" (renderiza vazio)');
    w.closeLineup();

    // 6. Numero duplicado AINDA bloqueia quando informado
    w.openLineup('g_novo');
    // marca/poe numero repetido em duas rows
    var rows=w.document.querySelectorAll('.lu-row');
    var nus=w.document.querySelectorAll('.lu-nu');
    if(nus.length>=2){ nus[0].value='7'; nus[1].value='7'; }
    toasts.length=0;
    w.saveLineup('g_novo');
    chk(toasts.some(function(t){return /repetido/i.test(t);}),'numero duplicado (informado): AINDA bloqueia');
    w.closeLineup();

    // 7. SCOUT: atleta sem numero renderiza "—" e nao quebra
    w.S={aid:'g_sc',sp:null,sa:null,cs:1,us:[],tm:0,rn:false,ti:null};
    var hsc=w.rSct();
    chk(hsc.indexOf('Fernanda')>=0,'rSct: atleta sem numero aparece pelo nome');
    chk(hsc.indexOf('<div class="num">—</div>')>=0,'rSct: card mostra "—" no lugar do numero ausente');
    chk(hsc.indexOf('null')<0 || hsc.indexOf('class="num">null')<0,'rSct: nao renderiza "null" como numero');

    console.log('\n=== '+ok+' ok, '+ko+' falhas ===');
    console.log(ko===0?'OK NUMERO OPCIONAL APROVADO':'FAIL NUMERO OPCIONAL REPROVADO');
    process.exit(ko===0?0:1);
  } catch(e){
    console.log('ERRO GERAL: '+e.message);
    console.log(e.stack);
    process.exit(1);
  }
},700);
