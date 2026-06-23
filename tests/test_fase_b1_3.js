// Fase B1.3 — gate de senha de acesso ao torneio removido.
// Asserta: mesmo com torneioMode=true + torneioUnlocked=false, o usuario
// NAO eh barrado pela tela de senha — entra direto nos cards. Login geral
// basta; senha por torneio morre. As funcoes renderTorneioSenha e
// checkTorneioPwd seguem como dead code ate B1.4 limpar.
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

const dom = new JSDOM(htmlMod, {
  url: 'https://master.associacaoscoladevoleibol.com.br/',
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
    ['teams','games','tournaments','athletes','invites'].forEach(k=>{
      const path='torneio-master-santos/'+k;
      if(listeners[path]) listeners[path]({val:()=>getAt(path)});
    });

    // Forcar entrada no modo isolado legado COM torneioUnlocked=FALSE (gate antigo).
    w.torneioMode=true; w.torneioId='t_usa_open'; w.torneioToken='usa';
    w.torneioUnlocked=false;
    w.showLanding=false; w.signupMode=false;
    w.render();

    const main = w.document.getElementById('mainApp').innerHTML;

    // Antes da B1.3 isso renderizaria renderTorneioSenha. Agora vai direto pros cards.
    chk(main.indexOf('usa-lock-card')<0,'gate removido: NAO mostra .usa-lock-card mesmo com torneioUnlocked=false');
    chk(main.indexOf('usa-lock-screen')<0,'gate removido: NAO mostra .usa-lock-screen');
    chk(main.indexOf('checkTorneioPwd')<0,'gate removido: HTML NAO contem handler checkTorneioPwd');
    chk(main.indexOf('gd-card')>=0,'isolado renderiza GAME DAY cards direto (sem gate)');

    // 2. renderTorneioIsolado chamado diretamente devolve cards, NAO senha
    const direct = w.renderTorneioIsolado();
    chk(direct.indexOf('usa-lock-card')<0,'renderTorneioIsolado() direto: sem .usa-lock-card');
    chk(direct.indexOf('gd-card')>=0 || direct.indexOf('usa-cards')>=0,'renderTorneioIsolado() direto: emite cards');

    // 3. Funcoes legadas ainda existem (dead code aceitavel ate B1.4)
    chk(typeof w.renderTorneioSenha==='function','renderTorneioSenha ainda existe (dead code aceitavel)');
    chk(typeof w.checkTorneioPwd==='function','checkTorneioPwd ainda existe (dead code aceitavel)');
    chk(typeof w.TOURNEY_ACCESS==='object','TOURNEY_ACCESS ainda existe (B1.4 remove tudo)');

    // 4. Chamar checkTorneioPwd nao quebra (defensivo — algumas paginas podem ter cache antigo)
    let crashed=false;
    try{ w.checkTorneioPwd(); }catch(e){ crashed = e && !/getElementById|null/.test(e.message); }
    chk(!crashed,'checkTorneioPwd() chamado sem #usa-pwd no DOM nao explode');

    // 5. Boot pelo URL legado ?torneio=usa continua redirecionando pro fluxo unificado (B1.2)
    //    — checagem rapida que B1.3 nao desfez nada de B1.2
    const dom2 = new JSDOM(htmlMod, {
      url: 'https://master.associacaoscoladevoleibol.com.br/?torneio=usa',
      runScripts:'dangerously', pretendToBeVisual:true,
      beforeParse(window){window.firebaseMock=global.firebaseMock;window.AudioContext=function(){return{createOscillator:()=>({connect:()=>{},frequency:{},start:()=>{},stop:()=>{}}),createGain:()=>({connect:()=>{},gain:{}}),destination:{},currentTime:0};};window.navigator.vibrate=()=>{};}
    });
    setTimeout(()=>{
      try {
        const w2 = dom2.window;
        chk(w2.torneioMode===false && w2.selTor==='t_usa_open','B1.2 ainda valido: ?torneio=usa redireciona pro fluxo unificado');
        console.log('\n=== '+ok+' ok, '+ko+' falhas ===');
        console.log(ko===0?'OK FASE B1.3 APROVADA':'FAIL FASE B1.3 REPROVADA');
        process.exit(ko===0?0:1);
      } catch(e){ console.log('ERRO INNER: '+e.message); process.exit(1); }
    },400);

  } catch(e){
    console.log('ERRO GERAL: '+e.message);
    console.log(e.stack);
    process.exit(1);
  }
},700);
