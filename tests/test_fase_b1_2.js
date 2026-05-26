// Fase B1.2 — ?torneio=usa redireciona pro fluxo unificado.
// Asserta: URL legada nao seta mais torneioMode/torneioId/torneioToken.
// Em vez disso seta selTor='t_usa_open' e tab='torneios', e showLanding=false.
// Resultado pratico: usuario com link antigo cai direto na aba Torneios
// com o detalhe USA aberto.
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
    teams:[{id:'trs',n:'RS Adulto Masc',c:'#2563eb',roster:[{aid:'a1'}]}],
    athletes:[{aid:'a1',nm:'Atleta 1',po:'Ponta'}],
    tournaments:[{id:'t_usa_open',n:'2026 Adult Open Championship',c:'#1d7a3a',color:'#1d7a3a'}],
    games:[
      {id:'g_usa_1',torId:'t_usa_open',tid:'trs',opp:'Arlington Empire',dt:'2026-06-10',tm:'10:00',st:'pending',lineup:[{aid:'a1',nu:1}]}
    ],
    invites:{}
  }
};
Object.assign(fakeDB, JSON.parse(JSON.stringify(seed)));

const htmlMod = html
  .replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>/g,'')
  .replace('firebase.initializeApp(fc);','var firebase=window.firebaseMock; firebase.initializeApp(fc);');

// Boot COM ?torneio=usa — quer validar que CAI no fluxo unificado.
const dom = new JSDOM(htmlMod, {
  url: 'https://master.associacaoscoladevoleibol.com.br/?torneio=usa',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
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
    // 1. ?torneio=usa NAO ativa mais o modo isolado
    chk(w.torneioMode===false,'?torneio=usa: torneioMode permanece false (modo isolado morto pra novos acessos)');
    chk(!w.torneioId,'?torneio=usa: torneioId NAO eh setado (era "t_usa_open" no fluxo legado)');
    chk(!w.torneioToken,'?torneio=usa: torneioToken NAO eh setado (era "usa" no fluxo legado)');
    chk(w.torneioUnlocked===false,'?torneio=usa: torneioUnlocked permanece false (sem gate de senha)');

    // 2. Em vez disso seta o fluxo unificado
    chk(w.tab==='torneios','?torneio=usa: tab="torneios" (deep-link entra na aba)');
    chk(w.selTor==='t_usa_open','?torneio=usa: selTor="t_usa_open" (torneio pre-selecionado)');
    chk(w.showLanding===false,'?torneio=usa: showLanding=false (nao mostra landing)');

    // 3. Entregar dados e renderizar
    ['teams','games','tournaments','athletes','invites'].forEach(k=>{
      const path='torneio-master-santos/'+k;
      if(listeners[path]) listeners[path]({val:()=>getAt(path)});
    });
    w.render();

    // 4. Resultado visual: usuario com link antigo cai direto no detalhe do USA com GAME DAY cards
    const main = w.document.getElementById('mainApp').innerHTML;
    chk(main.indexOf('rs-tor-detail')>=0,'render: cai no rTorDetail do USA');
    chk(main.indexOf('gd-card')>=0,'render: GAME DAY cards visiveis (layout=gameday)');
    chk(main.indexOf('2026 Adult Open Championship')>=0,'render: nome do torneio aparece');
    // SEM tela de senha (que era renderTorneioSenha no fluxo isolado)
    chk(main.indexOf('usa-lock-card')<0,'render: NAO mostra tela de senha (gate era do isolado)');
    chk(main.indexOf('renderTorneioIsolado')<0,'sanity: renderTorneioIsolado nao foi chamado');

    // 5. URLs sem ?torneio nao quebram (regressao)
    chk(typeof w.TOURNEY_ACCESS==='object' && w.TOURNEY_ACCESS.usa,'TOURNEY_ACCESS ainda existe (B1.3 remove)');

    // 6. URL com token desconhecido nao seta nada
    //    (esse comportamento ja era assim, validacao do contrato)
    const dom2 = new JSDOM(htmlMod, {
      url: 'https://master.associacaoscoladevoleibol.com.br/?torneio=fake_que_nao_existe',
      runScripts: 'dangerously', pretendToBeVisual: true,
      beforeParse(window){window.firebaseMock=global.firebaseMock;window.AudioContext=function(){return{createOscillator:()=>({connect:()=>{},frequency:{},start:()=>{},stop:()=>{}}),createGain:()=>({connect:()=>{},gain:{}}),destination:{},currentTime:0};};window.navigator.vibrate=()=>{};}
    });
    setTimeout(()=>{
      try {
        const w2 = dom2.window;
        chk(w2.selTor==null,'token desconhecido: selTor nao eh setado');
        chk(w2.tab!=='torneios' || w2.showLanding===true,'token desconhecido: NAO pula a landing');
        console.log('\n=== '+ok+' ok, '+ko+' falhas ===');
        console.log(ko===0?'OK FASE B1.2 APROVADA':'FAIL FASE B1.2 REPROVADA');
        process.exit(ko===0?0:1);
      } catch(e){ console.log('ERRO INNER: '+e.message); process.exit(1); }
    },400);

  } catch(e){
    console.log('ERRO GERAL: '+e.message);
    console.log(e.stack);
    process.exit(1);
  }
},700);
