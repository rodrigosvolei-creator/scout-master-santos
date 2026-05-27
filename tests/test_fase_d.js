// Fase D — tema escuro global nas demais abas (CSS sweep).
// Asserta:
//   1. CSS escopa as overrides em body.rs-shell .app-content (nao vaza pro header)
//   2. Vars antigas redefinidas no scope (--navy, --gray, --txt, --txl, --brd, --card2)
//   3. .cd cards ganham regra dark (gradient + border + shadow)
//   4. .th-card (renderTeamHub) tambem ganha regra dark
//   5. Inputs/selects ganham fundo translucido + texto claro
//   6. .stb (sub-tabs) e .bg/.bo buttons ganham contraste no dark
//   7. Header (.app-header) NAO recebe override de --navy (continua dark navy puro)
//   8. Em tempo de render: ao navegar pra Stats/Agenda/Scout/Config nada quebra
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
    tournaments:[{id:'t_liga',n:'Liga Ativa',c:'#2563eb',color:'#2563eb',cat:'Adulto',season:'2026'}],
    games:[
      {id:'g1',torId:'t_liga',tid:'trs',opp:'Time A',dt:'2026-07-10',tm:'10:00',st:'pending',lineup:[{aid:'a1',nu:1}]}
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

    const css = htmlMod.match(/<style>([\s\S]*?)<\/style>/)[1];

    // 1. Scope correto: overrides ancorados em body.rs-shell .app-content
    chk(css.indexOf('body.rs-shell .app-content{')>=0,'CSS: bloco scopado em body.rs-shell .app-content');

    // 2. Vars antigas redefinidas dentro do scope (texto inline com style="color:var(--navy)" vira claro)
    chk(/body\.rs-shell \.app-content\{[\s\S]*?--navy:#e8eef9/.test(css),'CSS: --navy redefinido pra valor claro');
    chk(/body\.rs-shell \.app-content\{[\s\S]*?--gray:rgba\(232,238,249/.test(css),'CSS: --gray redefinido pra muted claro');
    chk(/body\.rs-shell \.app-content\{[\s\S]*?--txt:#e8eef9/.test(css),'CSS: --txt redefinido pra texto claro');
    chk(/body\.rs-shell \.app-content\{[\s\S]*?--brd:rgba\(255,255,255,\.10\)/.test(css),'CSS: --brd redefinido pra borda translucida');
    chk(/body\.rs-shell \.app-content\{[\s\S]*?--card2:rgba\(255,255,255,\.05\)/.test(css),'CSS: --card2 redefinido pra surface translucida');

    // 3. Override explicito de .cd
    chk(css.indexOf('body.rs-shell .app-content .cd{')>=0,'CSS: regra .cd dark presente');
    chk(/body\.rs-shell \.app-content \.cd\{[\s\S]*?linear-gradient/.test(css),'CSS: .cd usa linear-gradient escuro');

    // 4. Override de .th-card
    chk(css.indexOf('body.rs-shell .app-content .th-card{')>=0,'CSS: regra .th-card dark presente');

    // 5. Inputs/selects
    chk(/body\.rs-shell \.app-content input,[\s\S]{0,80}select,[\s\S]{0,80}textarea\{/.test(css),'CSS: inputs/selects/textareas com override dark');
    chk(css.indexOf('::placeholder')>=0,'CSS: placeholder color override presente');

    // 6. .stb buttons e .bg ghost
    chk(css.indexOf('body.rs-shell .app-content .stb button{')>=0,'CSS: .stb button override presente');
    chk(css.indexOf('body.rs-shell .app-content .bg{')>=0,'CSS: .bg button override presente');

    // 7. Header NAO recebe override de --navy (scope nao alcanca .app-header, que e sibling)
    //    Confirmando via inspecao: nao existe regra body.rs-shell .app-header{--navy:...}
    //    Regex usa [^}] pra parar no fechamento da propria regra, sem vazar pra .app-content vizinho.
    chk(!/body\.rs-shell \.app-header\{[^}]*--navy/.test(css),'CSS: header NAO redefine --navy (preserva navy original)');
    // .app-header continua usando var(--navy) global (#0f172a)
    chk(css.indexOf('.app-header{background:var(--navy)')>=0,'CSS: .app-header ainda usa var(--navy) global');

    // 8. Render nas abas — nada explode
    w.showLanding=false; w.signupMode=false; w.torneioMode=false;
    w.tab='torneios'; w.selTor=null; w.render();
    chk(w.document.getElementById('mainApp').innerHTML.indexOf('rs-tor-page')>=0,'render: Torneios renderiza (rs-tor-page)');

    w.tab='scout'; w.selTor=null; w.render();
    const mainScout = w.document.getElementById('mainApp').innerHTML;
    chk(mainScout.length>500,'render: Scout renderiza algum conteudo');

    w.tab='agenda'; w.render();
    const mainAge = w.document.getElementById('mainApp').innerHTML;
    chk(mainAge.length>200,'render: Agenda renderiza algum conteudo');

    w.tab='stats'; w.isAtleta=true; w.isScouter=true; w.render();
    const mainStats = w.document.getElementById('mainApp').innerHTML;
    chk(mainStats.length>200,'render: Stats renderiza algum conteudo');

    w.tab='config'; w.isAdmin=true; w.isCoord=true; w.render();
    const mainCfg = w.document.getElementById('mainApp').innerHTML;
    chk(mainCfg.length>200,'render: Config renderiza algum conteudo');
    chk(mainCfg.indexOf('class="cd"')>=0 || mainCfg.indexOf('class="cd ')>=0,'render: Config emite cards .cd que vao ganhar tema dark via CSS');

    // 9. Sintaxe das vars antigas continuam disponiveis fora do scope (header, body)
    chk(css.indexOf(':root{--bg:#f0f2f5;--card:#fff')>=0,'CSS: vars antigas em :root preservadas (compat)');

    // 10. Shell ainda ativa rs-shell (regressao A1)
    chk(w.document.body.classList.contains('rs-shell'),'shell: body.rs-shell continua ativo');

    console.log('\n=== '+ok+' ok, '+ko+' falhas ===');
    console.log(ko===0?'OK FASE D APROVADA':'FAIL FASE D REPROVADA');
    process.exit(ko===0?0:1);
  } catch(e){
    console.log('ERRO GERAL: '+e.message);
    console.log(e.stack);
    process.exit(1);
  }
},700);
