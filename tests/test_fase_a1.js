// Fase A1 - tema escuro global no shell.
// Asserta: --rs-watermark setado, body.rs-shell ligado no modo shell,
// removido em modos isolados (torneioMode/landing/signup), e que o CSS
// que pinta tabs/marca-d'agua/header escuro esta presente.
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
    teams:[{id:'trs',n:'RS',c:'#2563eb',roster:[]}],
    athletes:[],
    tournaments:[{id:'t1',n:'Liga 2026',c:'#1d7a3a'}],
    games:[],invites:{}
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
function chk(cond, msg){ if(cond){ok++;console.log('OK   '+msg);} else {ko++;console.log('FAIL '+msg);} }

setTimeout(()=>{
  try {
    // 1. --rs-watermark deve estar setado no <html> apos boot (LR ja foi definido)
    const wm = w.document.documentElement.style.getPropertyValue('--rs-watermark');
    chk(/^url\(['"]?data:image\/png/.test(wm), '--rs-watermark seta um data: PNG no documentElement ('+(wm.slice(0,40))+'...)');

    // 2. Boot inicial vai pra landing (showLanding=true). Tirar landing, render shell.
    ['teams','games','tournaments','athletes','invites'].forEach(k=>{
      const path='torneio-master-santos/'+k;
      if(listeners[path]) listeners[path]({val:()=>getAt(path)});
    });
    w.showLanding = false; w.signupMode = false; w.torneioMode = false; w.render();

    // 3. body.rs-shell deve estar ligado no shell
    chk(w.document.body.classList.contains('rs-shell'), 'body.rs-shell ligado no modo shell (nao landing, nao USA, nao signup)');

    // 4. CSS deve conter as regras Fase A1
    const css = htmlMod.match(/<style>([\s\S]*?)<\/style>/)[1];
    chk(css.indexOf('body.rs-shell::after')>=0, 'CSS contem regra body.rs-shell::after (marca dagua)');
    chk(css.indexOf('body.rs-shell .app-tabs')>=0, 'CSS contem regra body.rs-shell .app-tabs (tabs escuras)');
    chk(css.indexOf('--rs-bg-1')>=0 && css.indexOf('--rs-gold')>=0, 'CSS contem vars do tema escuro (--rs-bg-1, --rs-gold)');
    chk(css.indexOf('linear-gradient(165deg,var(--rs-bg-1)')>=0, 'CSS aplica gradiente escuro no body');

    // 5. As tabs e header devem estar no DOM apos render shell
    chk(!!w.document.querySelector('.app-header'), 'shell renderizou .app-header');
    chk(!!w.document.querySelector('.app-tabs'), 'shell renderizou .app-tabs');
    chk(!!w.document.querySelector('.app-content'), 'shell renderizou .app-content');

    // 6. Toggle: ligar torneioMode remove rs-shell
    w.torneioMode = true; w.torneioId='t_usa_open'; w.torneioUnlocked=true; w.render();
    chk(!w.document.body.classList.contains('rs-shell'), 'body.rs-shell removido em torneioMode (USA)');

    // 7. Voltar pro shell religa
    w.torneioMode = false; w.render();
    chk(w.document.body.classList.contains('rs-shell'), 'body.rs-shell religa apos sair do torneioMode');

    // 8. Landing REAL (showLanding + SEM login) nao tem rs-shell
    var _cu=w.currentUser; w.currentUser=null; w.showLanding = true; w.render();
    chk(!w.document.body.classList.contains('rs-shell'), 'body.rs-shell removido em landing (showLanding + sem login)');
    // 8b. Sessao JA logada com showLanding ainda true (login persistido do Firebase): o app renderiza
    //     normal -> rs-shell/rs-tablet DEVEM aplicar (senao as tabs nao somem no modo tablet).
    w.currentUser=_cu||{uid:'u',email:'x@x.com'}; w.render();
    chk(w.document.body.classList.contains('rs-shell'), 'body.rs-shell aplica com login mesmo se showLanding=true (sessao persistida)');
    w.showLanding = false; w.render();

    // 9. Signup tambem nao tem rs-shell
    w.signupMode = true; w.render();
    chk(!w.document.body.classList.contains('rs-shell'), 'body.rs-shell removido em signupMode');
    w.signupMode = false; w.render();

    // 10. Vars antigas ainda valem (regressao: nao quebramos --bg/--card/--txt)
    chk(css.indexOf('--bg:#f0f2f5')>=0 || css.indexOf('--bg:#')>=0, 'vars antigas (--bg etc) ainda presentes (Fase D migra)');

    console.log('\n=== '+ok+' ok, '+ko+' falhas ===');
    console.log(ko===0 ? 'OK FASE A1 APROVADA' : 'FAIL FASE A1 REPROVADA');
    process.exit(ko===0?0:1);
  } catch(e){
    console.log('ERRO GERAL: '+e.message);
    console.log(e.stack);
    process.exit(1);
  }
},700);
