// Fase 1a — Torneio Minis RS: pagina isolada ?torneio=minis SEM senha (openAccess),
// bootstrap das 5 equipes (com logo + elenco de 5) e isolamento do app RS.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');

const fakeDB = {};
const listeners = {};
function getAt(p){const a=p.split('/');let c=fakeDB;for(const k of a){if(c==null)return null;c=c[k];}return c===undefined?null:c;}
function setAt(p,v){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}c[a[a.length-1]]=JSON.parse(JSON.stringify(v));}
function makeRef(p){return{_path:p,on:function(e,cb){listeners[p]=cb;},once:function(){return Promise.resolve({val:()=>getAt(p)});},set:function(v){setAt(p,v);return Promise.resolve();},update:function(){return Promise.resolve();}};}
global.firebaseMock={initializeApp:()=>{},database:()=>({ref:makeRef}),auth:()=>({onAuthStateChanged:function(cb){setTimeout(()=>cb(null),0);},signInWithPopup:()=>Promise.resolve(),signOut:()=>Promise.resolve()})};

// Banco do RS com 1 equipe propria (pra confirmar que os minis nao vazam pro RS)
const seed = {
  'torneio-master-santos': {
    teams:[{id:'trs',n:'RS FEM',c:'#db2777',roster:[{aid:'r1'}]}],
    athletes:[{aid:'r1',nm:'Rosa',po:'Ponta'}],
    tournaments:[{id:'tRS',n:'Liga RS'}],
    games:[],
    invites:{}
  }
};
Object.assign(fakeDB, JSON.parse(JSON.stringify(seed)));

const htmlMod = html
  .replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>/g,'')
  .replace('firebase.initializeApp(fc);','var firebase=window.firebaseMock; firebase.initializeApp(fc);');

const dom = new JSDOM(htmlMod, {
  url: 'https://master.associacaoscoladevoleibol.com.br/?torneio=minis',
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

    // 1. URL parser: ?torneio=minis ativa modo isolado SEM senha
    chk(w.torneioMode===true,'?torneio=minis: torneioMode=true');
    chk(w.torneioToken==='minis','token=minis');
    chk(w.torneioId==='t_minis_open','torneioId=t_minis_open');
    chk(w.torneioUnlocked===true,'openAccess: destravado SEM senha (torneioUnlocked)');
    chk(w.torneioAdminUnlocked===true,'openAccess: admin liberado direto (cria jogo sem senha)');
    chk(w.canManageTorneio()===true,'canManageTorneio()=true (qualquer um cria jogo)');

    // 2. Constantes das 5 equipes + logos embutidos
    chk(Array.isArray(w.MINIS_TEAMS) && w.MINIS_TEAMS.length===5,'MINIS_TEAMS: 5 equipes');
    chk(typeof w.MINIS_LOGO_COL==='string' && w.MINIS_LOGO_COL.indexOf('data:image')===0,'logo COLOMBIA embutido (data URI)');
    chk(typeof w.MINIS_LOGO_ITA==='string' && w.MINIS_LOGO_ITA.indexOf('data:image')===0,'logo ITALIA embutido (data URI)');

    // 3. Bootstrap: cria torneio + 5 equipes + atletas
    w.ensureStandaloneTeams(w.TOURNEY_ACCESS.minis);
    chk(!!w.tFnd('t_minis_open'),'bootstrap: torneio t_minis_open criado');
    var col=w.tF('t_minis_col');
    chk(col && col.n==='RS COLOMBIA','equipe COLOMBIA criada com nome certo');
    chk(col && col.roster && col.roster.length===5,'COLOMBIA: elenco de 5');
    chk(col && col.brandLogoData && col.brandLogoData.indexOf('data:image')===0,'COLOMBIA: logo associado na equipe');
    chk(col && (col.c==='#eab308'||col.color==='#eab308'),'COLOMBIA: cor amarela');
    var afr=w.tF('t_minis_afr');
    chk(afr && /ÁFRICA DO SUL/.test(afr.n),'AFRICA DO SUL: acento OK no nome');
    // atletas
    chk(w.aFind('t_minis_col_a0') && w.aFind('t_minis_col_a0').nm==='RAICA','atleta RAICA (Colombia) criada');
    var ita=w.tF('t_minis_ita');
    var tatao=ita.roster.map(function(r){return w.aFind(r.aid)?w.aFind(r.aid).nm:'';});
    chk(tatao.indexOf('TATÃO')>=0,'ITALIA: TATAO com acento OK');
    var nMinis=(w.D.teams||[]).filter(function(t){return t.id.indexOf('t_minis_')===0;}).length;
    chk(nMinis===5,'5 equipes minis no D.teams: '+nMinis);

    // 4. Idempotente: rodar de novo nao duplica
    w.ensureStandaloneTeams(w.TOURNEY_ACCESS.minis);
    var nMinis2=(w.D.teams||[]).filter(function(t){return t.id.indexOf('t_minis_')===0;}).length;
    chk(nMinis2===5,'bootstrap idempotente: continua 5 (sem duplicar)');

    // 5. Isolamento: minis sao "special" e nao vazam pro app RS
    chk(w.isSpecialTeam('t_minis_col')===true,'isSpecialTeam: COLOMBIA e special');
    chk(w.isSpecialTeam('trs')===false,'isSpecialTeam: equipe RS NAO e special');
    chk(w.isSpecialTour(w.tFnd('t_minis_open'))===true,'isSpecialTour: torneio minis e special');
    // getPublicTeams (fora do modo torneio) exclui os minis
    var wasMode=w.torneioMode; w.torneioMode=false;
    var pub=w.getPublicTeams();
    chk(!pub.some(function(t){return t.id.indexOf('t_minis_')===0;}),'getPublicTeams: app RS NAO mostra equipes minis');
    chk(pub.some(function(t){return t.id==='trs';}),'getPublicTeams: app RS continua mostrando a equipe RS');
    w.torneioMode=wasMode;

    // 6. Brand do torneio
    var b=w.getBrand('minis');
    chk(b.title==='TORNEIO MINIS RS','getBrand(minis).title=TORNEIO MINIS RS');

    console.log('\n=== '+ok+' ok, '+ko+' falhas ===');
    console.log(ko===0?'OK MINIS FASE 1a APROVADA':'FAIL MINIS FASE 1a REPROVADA');
    process.exit(ko===0?0:1);
  } catch(e){
    console.log('ERRO GERAL: '+e.message);
    console.log(e.stack);
    process.exit(1);
  }
},700);
