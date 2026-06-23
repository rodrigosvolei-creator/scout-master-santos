// Taça SP — pagina isolada ?torneio=taca SEM senha (openAccess), equipe RS Adulto
// Masculino, criar jogo (final vs Caru) + escalacao automatica do TACA_ROSTER.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');

const fakeDB = {};
const listeners = {};
function getAt(p){const a=p.split('/');let c=fakeDB;for(const k of a){if(c==null)return null;c=c[k];}return c===undefined?null:c;}
function setAt(p,v){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}c[a[a.length-1]]=JSON.parse(JSON.stringify(v));}
function makeRef(p){return{_path:p,on:function(e,cb){listeners[p]=cb;},once:function(){return Promise.resolve({val:()=>getAt(p)});},set:function(v){setAt(p,v);return Promise.resolve();},update:function(){return Promise.resolve();}};}
global.firebaseMock={initializeApp:()=>{},database:()=>({ref:makeRef}),auth:()=>({onAuthStateChanged:function(cb){setTimeout(()=>cb({uid:'tester',email:'rodrigosvolei@gmail.com',displayName:'Tester'}),0);},signInWithPopup:()=>Promise.resolve(),signOut:()=>Promise.resolve()})};

const seed = { 'torneio-master-santos': { teams:[], athletes:[], tournaments:[], games:[], invites:{} } };
Object.assign(fakeDB, JSON.parse(JSON.stringify(seed)));

const htmlMod = html
  .replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>/g,'')
  .replace('firebase.initializeApp(fc);','var firebase=window.firebaseMock; firebase.initializeApp(fc);');

const dom = new JSDOM(htmlMod, {
  url: 'https://master.associacaoscoladevoleibol.com.br/?torneio=taca',
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

    // 1. URL ?torneio=taca abre SEM senha
    chk(w.torneioMode===true && w.torneioToken==='taca','?torneio=taca: modo isolado');
    chk(w.torneioId==='t_taca_open','torId t_taca_open');
    chk(w.torneioUnlocked===true && w.torneioAdminUnlocked===true,'openAccess: sem senha, admin liberado');
    chk(w.canManageTorneio()===true,'canManageTorneio()=true');

    // 2. Brand
    var b=w.getBrand('taca');
    chk(b.title==='TAÇA SP 2026','brand title');
    chk(b.team==='RS ADULTO MASCULINO','brand team RS adulto masculino');

    // 3. Elenco TACA_ROSTER monta lineup (Extra distintos, sem colapsar)
    chk(Array.isArray(w.TACA_ROSTER) && w.TACA_ROSTER.length===17,'TACA_ROSTER: 17 atletas');
    var lu=w.buildUsaLineup(w.TACA_ROSTER);
    chk(lu.length===17,'buildUsaLineup: 17 entradas');
    var nms=lu.map(function(l){var a=w.aFind(l.aid);return a?a.nm:'';});
    chk(nms.indexOf('Vinny')>=0 && nms.indexOf('Satoshi')>=0 && nms.indexOf('Everton')>=0,'inclui Vinny/Satoshi/Everton');
    chk(nms.filter(function(n){return n.indexOf('Extra')===0;}).length===3,'3 Extra distintos (nao colapsaram)');

    // 4. isSpecialTeam isola a equipe RS taca do app principal
    chk(w.isSpecialTeam('t_taca_rs')===true,'isSpecialTeam: equipe taca e special');

    // 5. Criar o jogo da final (fluxo standalone) + escalacao automatica
    w.openTorneioNovoJogo();
    w.document.getElementById('tnj-opp').value='CARÚ FENERBOUAS (MA)';
    w.document.getElementById('tnj-dt').value='2026-06-21';
    w.document.getElementById('tnj-tm').value='17:15';
    w.document.getElementById('tnj-fmt').value='5';
    w.salvarTorneioJogo();
    var gt=w.D.games.filter(function(g){return g.torId==='t_taca_open';})[0];
    chk(!!gt,'jogo Taça SP criado');
    chk(gt && gt.tid==='t_taca_rs','jogo na equipe RS adulto masculino');
    chk(gt && /CAR/.test(gt.opp||''),'adversario = Caru Fenerbouas');
    chk(gt && gt.maxSets===5,'melhor de 5 sets');
    chk(!!w.tF('t_taca_rs'),'equipe RS criada no bootstrap standalone');
    // abrir o jogo escala automatico do roster
    w.openTorneioGame(gt.id);
    var g2=w.gF(gt.id);
    chk(g2.lineup && g2.lineup.length===17,'ao abrir: escalado com 17 do TACA_ROSTER ('+(g2.lineup?g2.lineup.length:0)+')');

    console.log('\n=== '+ok+' ok, '+ko+' falhas ===');
    console.log(ko===0?'OK TACA APROVADA':'FAIL TACA REPROVADA');
    process.exit(ko===0?0:1);
  } catch(e){
    console.log('ERRO GERAL: '+e.message);
    console.log(e.stack);
    process.exit(1);
  }
},700);
