// Fase 1 seguranca: gate de login na ENTRADA (exceto telao) + guards de escrita.
// - Sem login: render mostra o login-gate, NAO o app; save() retorna false; saveGame rejeita.
// - Com login: render mostra o app; save() nao retorna false.
// - Telao (?telao=) NAO exige login (canal publico read-only).
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');

const fakeDB = {}; const listeners = {};
function getAt(p){const a=p.split('/');let c=fakeDB;for(const k of a){if(c==null)return null;c=c[k];}return c===undefined?null:c;}
function setAt(p,v){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}c[a[a.length-1]]=JSON.parse(JSON.stringify(v));}
function makeRef(p){return{_path:p,on:function(e,cb){listeners[p]=cb;},once:function(){return Promise.resolve({val:()=>getAt(p)});},set:function(v){setAt(p,v);return Promise.resolve();},update:function(){return Promise.resolve();}};}
// Mock SEM login (cb(null)) — este teste controla currentUser manualmente.
global.firebaseMock={initializeApp:()=>{},database:()=>({ref:makeRef}),auth:()=>({onAuthStateChanged:function(cb){setTimeout(()=>cb(null),0);},signInWithPopup:()=>Promise.resolve(),signOut:()=>Promise.resolve()})};

const seed = { 'torneio-master-santos': {
  teams:[{id:'trs',n:'RS FEM',c:'#db2777',roster:[{aid:'r1'}]}],
  athletes:[{aid:'r1',nm:'Rosa',po:'P'}],
  tournaments:[{id:'tRS',n:'Liga'}],
  games:[{id:'g1',torId:'tRS',tid:'trs',opp:'Outro',st:'live',ss:[{u:0,t:0}],act:[],lineup:[{aid:'r1',nu:7}]}],
  invites:{} } };
Object.assign(fakeDB, JSON.parse(JSON.stringify(seed)));

const htmlMod = html
  .replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>/g,'')
  .replace('firebase.initializeApp(fc);','var firebase=window.firebaseMock; firebase.initializeApp(fc);');

const dom = new JSDOM(htmlMod, {
  url: 'https://master.exemplo.com.br/?app=1',
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

setTimeout(async ()=>{
  try {
    ['teams','games','tournaments','athletes','invites'].forEach(k=>{
      const path='torneio-master-santos/'+k;
      if(listeners[path]) listeners[path]({val:()=>getAt(path)});
    });

    // 1. SEM login -> gate na entrada (nao o app)
    w.currentUser=null; w.signupMode=false; w.telaoMode=false; w.showLanding=false; w.render();
    var h1=w.document.getElementById('mainApp').innerHTML;
    chk(h1.indexOf('rea restrita')>=0, 'sem login: render mostra o login-gate (area restrita)');
    chk(h1.indexOf('app-header')<0, 'sem login: NAO renderiza o app (sem header/tabs)');

    // 2. Guards de escrita SEM login
    chk(w.save()===false, 'sem login: save() retorna false (nao grava os nos)');
    var sgRej=false; await w.saveGame({id:'g1'}).catch(()=>{sgRej=true;});
    chk(sgRej, 'sem login: saveGame() REJEITA');
    var stRej=false; await w.saveTeam({id:'trs'}).catch(()=>{stRej=true;});
    chk(stRej, 'sem login: saveTeam() REJEITA');

    // 3. COM login -> app renderiza, gate some
    w.currentUser={uid:'u1',email:'rodrigosvolei@gmail.com',displayName:'Tester'}; w.render();
    var h2=w.document.getElementById('mainApp').innerHTML;
    chk(h2.indexOf('app-header')>=0, 'com login: renderiza o app (header presente)');
    chk(h2.indexOf('rea restrita')<0, 'com login: gate sumiu');

    // 4. Guards liberam COM login
    chk(w.save()!==false, 'com login: save() nao retorna false (libera)');
    var sgOk=false; await w.saveGame(w.D.games[0]).then(()=>{sgOk=true;}).catch(()=>{});
    chk(sgOk, 'com login: saveGame() de jogo existente RESOLVE (grava)');

    // 5. TELAO sem login -> livre (canal publico)
    w.currentUser=null; w.telaoMode=true; w.telaoToken='x'; w.telaoTorId='tRS'; w.render();
    var h3=w.document.getElementById('mainApp').innerHTML;
    chk(h3.indexOf('rea restrita')<0, 'telao sem login: NAO bloqueia (sem gate)');
    w.telaoMode=false;

    console.log('\n=== test_auth_gate: '+ok+' OK, '+ko+' FAIL ===');
    process.exit(ko>0?1:0);
  } catch(e){ console.log('FAIL exception: '+e.message); console.log((e.stack||'').split('\n').slice(0,4).join('\n')); process.exit(1); }
}, 80);
