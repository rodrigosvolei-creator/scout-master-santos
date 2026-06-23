// Escalacao com toggle visual (substitui checkbox nativo — fix iOS).
// Asserta: jogo novo marca todos; jogo com lineup marca so quem ja esta;
// toggleLuRow alterna; saveLineup le data-on; addAdhocAthlete cria row marcada
// e saveLineup preserva nm/po; removeLineupRow remove; numero duplicado bloqueia.
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
    teams:[{id:'trs',n:'FEM RS 30+',c:'#db2777',roster:[{aid:'a1'},{aid:'a2'},{aid:'a3'}]}],
    athletes:[
      {aid:'a1',nm:'Ana',po:'Ponta'},
      {aid:'a2',nm:'Bia',po:'Central'},
      {aid:'a3',nm:'Carol',po:'Levantadora'}
    ],
    tournaments:[{id:'tA',n:'Liga',c:'#2563eb'}],
    games:[
      {id:'g_novo',torId:'tA',tid:'trs',opp:'Time X',dt:'2026-07-10',tm:'10:00',st:'pending'},
      {id:'g_comlineup',torId:'tA',tid:'trs',opp:'Time Y',dt:'2026-07-11',tm:'10:00',st:'pending',lineup:[{aid:'a1',nu:7}]}
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

    // 1. Jogo NOVO (sem lineup) -> openLineup marca TODOS por default
    w.openLineup('g_novo');
    var rows=w.document.querySelectorAll('.lu-row');
    chk(rows.length===3,'jogo novo: 3 rows (roster inteiro): '+rows.length);
    var allOn=true; for(var i=0;i<rows.length;i++){ if(rows[i].getAttribute('data-on')!=='1')allOn=false; }
    chk(allOn,'jogo novo: TODAS as rows vem marcadas (data-on=1) — regressao corrigida');
    chk(w.document.querySelectorAll('.lu-chk').length===0,'NAO usa mais checkbox nativo (.lu-chk)');
    chk(w.document.querySelectorAll('.lu-toggle').length===3,'usa toggle visual (.lu-toggle) em cada row');

    // 2. toggleLuRow alterna o estado
    var firstRow=rows[0];
    w.toggleLuRow(firstRow,null);
    chk(firstRow.getAttribute('data-on')==='0' && !firstRow.classList.contains('on'),'toggleLuRow: marca->desmarca (data-on=0, sem classe on)');
    w.toggleLuRow(firstRow,null);
    chk(firstRow.getAttribute('data-on')==='1' && firstRow.classList.contains('on'),'toggleLuRow: desmarca->marca de novo');

    // 3. lineupAll(false) desmarca tudo
    w.lineupAll(false);
    var anyOn=false; rows=w.document.querySelectorAll('.lu-row'); for(var i=0;i<rows.length;i++){ if(rows[i].getAttribute('data-on')==='1')anyOn=true; }
    chk(!anyOn,'lineupAll(false): desmarca todas');
    w.lineupAll(true);
    var allOn2=true; rows=w.document.querySelectorAll('.lu-row'); for(var i=0;i<rows.length;i++){ if(rows[i].getAttribute('data-on')!=='1')allOn2=false; }
    chk(allOn2,'lineupAll(true): marca todas de novo');

    // 4. Definir numeros e salvar
    var nus=w.document.querySelectorAll('.lu-nu');
    nus[0].value='7'; nus[1].value='10'; nus[2].value='5';
    w.saveLineup('g_novo');
    var gNovo=w.gF('g_novo');
    chk(gNovo.lineup && gNovo.lineup.length===3,'saveLineup: 3 atletas escaladas: '+(gNovo.lineup?gNovo.lineup.length:0));
    var nuMap={}; gNovo.lineup.forEach(function(l){nuMap[l.aid]=l.nu;});
    chk(nuMap['a1']===7 && nuMap['a2']===10 && nuMap['a3']===5,'saveLineup: numeros corretos por atleta');
    chk(!w.document.getElementById('lineupModal'),'saveLineup: modal fecha');

    // 5. Reabrir o jogo COM lineup -> so as 3 escaladas vem marcadas (todas, pois salvamos 3)
    //    Testa o caminho "jogo com lineup". Desmarcar 1 e salvar deve gravar 2.
    w.openLineup('g_novo');
    var rows2=w.document.querySelectorAll('.lu-row');
    chk(rows2.length===3,'reabrir: 3 rows');
    var allOn3=true; for(var i=0;i<rows2.length;i++){ if(rows2[i].getAttribute('data-on')!=='1')allOn3=false; }
    chk(allOn3,'reabrir com lineup cheio: todas marcadas');
    // desmarca a Carol (a3)
    var carolRow=null; for(var i=0;i<rows2.length;i++){ if(rows2[i].getAttribute('data-aid')==='a3')carolRow=rows2[i]; }
    w.toggleLuRow(carolRow,null);
    w.saveLineup('g_novo');
    gNovo=w.gF('g_novo');
    chk(gNovo.lineup.length===2,'desmarcou 1 + salvou: 2 atletas: '+gNovo.lineup.length);
    chk(!gNovo.lineup.some(function(l){return l.aid==='a3';}),'Carol (a3) fora da lineup apos desmarcar');

    // 6. addAdhocAthlete: cria row marcada e salva preservando nm/po
    w.openLineup('g_novo');
    w.document.getElementById('lu-new-nu').value='99';
    w.document.getElementById('lu-new-nm').value='Visitante';
    w.document.getElementById('lu-new-po').value='Oposta';
    w.addAdhocAthlete('g_novo');
    var adRows=w.document.querySelectorAll('.lu-row.lu-adhoc');
    chk(adRows.length===1,'addAdhocAthlete: 1 row ad-hoc criada');
    chk(adRows[0].getAttribute('data-on')==='1','row ad-hoc ja vem marcada');
    // garante numeros unicos nas marcadas e salva
    w.saveLineup('g_novo');
    gNovo=w.gF('g_novo');
    var adEntry=gNovo.lineup.filter(function(l){return l.nu===99;})[0];
    chk(!!adEntry,'saveLineup: atleta ad-hoc (nu 99) gravada');
    chk(adEntry && adEntry.nm==='Visitante','ad-hoc: nm preservado no entry');
    chk(adEntry && adEntry.po==='Oposta','ad-hoc: po preservado no entry');
    chk(adEntry && adEntry.aid.indexOf('adhoc_')===0,'ad-hoc: aid com prefixo adhoc_');
    chk(!w.aFind(adEntry.aid),'ad-hoc NAO entra em D.athletes (banco intacto)');

    // 7. removeLineupRow tira a row
    w.openLineup('g_novo');
    var before=w.document.querySelectorAll('.lu-row.lu-adhoc').length;
    var adAid=null; var ar=w.document.querySelectorAll('.lu-row.lu-adhoc'); if(ar.length)adAid=ar[0].getAttribute('data-aid');
    if(adAid)w.removeLineupRow(adAid);
    var after=w.document.querySelectorAll('.lu-row.lu-adhoc').length;
    chk(after===before-1,'removeLineupRow: remove a row ad-hoc do DOM');
    w.closeLineup();

    // 8. Numero duplicado bloqueia
    w.openLineup('g_comlineup'); // tem a1=7 no lineup
    var rows3=w.document.querySelectorAll('.lu-row'); // a1(on,7), a2(off), a3(off)
    // marca a2 e poe numero 7 (igual a1) -> deve bloquear
    var a2row=null; for(var i=0;i<rows3.length;i++){ if(rows3[i].getAttribute('data-aid')==='a2')a2row=rows3[i]; }
    if(a2row.getAttribute('data-on')!=='1')w.toggleLuRow(a2row,null);
    var a2nu=a2row.querySelector('.lu-nu'); a2nu.value='7';
    var toasts=[]; w.toast=function(msg){toasts.push(msg);};
    w.saveLineup('g_comlineup');
    chk(toasts.some(function(t){return /repetido/i.test(t);}),'numero duplicado: bloqueia com toast "repetido"');
    chk(!!w.document.getElementById('lineupModal'),'numero duplicado: modal continua aberto (nao salvou)');

    console.log('\n=== '+ok+' ok, '+ko+' falhas ===');
    console.log(ko===0?'OK ESCALACAO TOGGLE APROVADA':'FAIL ESCALACAO TOGGLE REPROVADA');
    process.exit(ko===0?0:1);
  } catch(e){
    console.log('ERRO GERAL: '+e.message);
    console.log(e.stack);
    process.exit(1);
  }
},700);
