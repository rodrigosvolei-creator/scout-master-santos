// Fase 1b — Minis: criar jogo entre 2 das 5 equipes (escala auto + 2 logos),
// formato "single"/bo3/bo5/fixed3 e PONTOS editaveis (setPoints/tiePoints).
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');

const fakeDB = {};
const listeners = {};
function getAt(p){const a=p.split('/');let c=fakeDB;for(const k of a){if(c==null)return null;c=c[k];}return c===undefined?null:c;}
function setAt(p,v){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}c[a[a.length-1]]=JSON.parse(JSON.stringify(v));}
function makeRef(p){return{_path:p,on:function(e,cb){listeners[p]=cb;},once:function(){return Promise.resolve({val:()=>getAt(p)});},set:function(v){setAt(p,v);return Promise.resolve();},update:function(){return Promise.resolve();}};}
global.firebaseMock={initializeApp:()=>{},database:()=>({ref:makeRef}),auth:()=>({onAuthStateChanged:function(cb){setTimeout(()=>cb(null),0);},signInWithPopup:()=>Promise.resolve(),signOut:()=>Promise.resolve()})};

const seed = { 'torneio-master-santos': { teams:[], athletes:[], tournaments:[], games:[], invites:{} } };
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
    w.ensureStandaloneTeams(w.TOURNEY_ACCESS.minis); // garante as 5 equipes

    // 1. Form abre com as 5 equipes
    w.openMinisNovoJogo('');
    chk(!!w.document.getElementById('mn-a') && !!w.document.getElementById('mn-b'),'form: selects de equipe A e B');
    chk(w.document.getElementById('mn-a').options.length===5,'form: 5 equipes no select A');
    chk(!!w.document.getElementById('mn-fmt') && !!w.document.getElementById('mn-pts'),'form: formato + pontos editaveis');

    // 2. Criar jogo single 21: Colombia x Portugal
    w.document.getElementById('mn-a').value='t_minis_col';
    w.document.getElementById('mn-b').value='t_minis_por';
    w.document.getElementById('mn-dt').value='2026-06-20';
    w.document.getElementById('mn-fmt').value='single';
    w.document.getElementById('mn-pts').value='21';
    w.salvarMinisJogo('');
    var gs=w.D.games.filter(function(g){return g.torId==='t_minis_open';});
    chk(gs.length===1,'jogo criado no torneio minis');
    var g=gs[0];
    chk(g.tid==='t_minis_col' && g.tidB==='t_minis_por','jogo: tid=Colombia, tidB=Portugal');
    chk(g.opp==='RS PORTUGAL','jogo: adversaria = RS PORTUGAL (nome auto)');
    chk(g.oppLogoData && g.oppLogoData.indexOf('data:image')===0,'jogo: logo da adversaria associado (oppLogoData)');
    chk(g.lineup && g.lineup.length===5,'escala auto da casa: 5 atletas');
    chk(g.lineupB && g.lineupB.length===5,'escala auto da adversaria (lineupB): 5 atletas');
    chk(g.lineup.every(function(l){return l.nu==null;}),'escala minis sem numero (nu null)');
    chk(g.format==='single' && g.maxSets===1 && g.setPoints===21,'formato single, 1 set, 21 pontos');

    // 3. Regras de set respeitam os pontos editaveis (21)
    chk(w.gameFmt(g)==='single' && w.gameMaxSets(g)===1,'gameFmt single + maxSets 1');
    chk(w.setTarget(g,1)===21,'setTarget = 21 (pontos escolhidos)');
    g.ss=[{u:21,t:19}]; chk(w.setIsOver(g,1),'21-19 encerra o set');
    g.ss=[{u:21,t:20}]; chk(!w.setIsOver(g,1),'21-20 NAO encerra (precisa 2 de vantagem)');
    g.ss=[{u:21,t:19}]; chk(w.gameIsDecided(g),'single: jogo decidido apos o set 1');

    // 4. Validacoes
    var err;
    w.openMinisNovoJogo('');
    w.document.getElementById('mn-a').value='t_minis_hol';
    w.document.getElementById('mn-b').value='t_minis_hol'; // iguais
    w.document.getElementById('mn-dt').value='2026-06-21';
    w.salvarMinisJogo('');
    err=w.document.getElementById('mn-err');
    chk(err && /diferentes/i.test(err.textContent),'bloqueia equipes iguais');
    chk(w.D.games.filter(function(g){return g.torId==='t_minis_open';}).length===1,'nao criou jogo invalido');
    w.closeTorneioModal();

    // 5. Pontos editaveis em bo3 (ex: 15 normal, 11 decisivo)
    w.openMinisNovoJogo('');
    w.document.getElementById('mn-a').value='t_minis_afr';
    w.document.getElementById('mn-b').value='t_minis_ita';
    w.document.getElementById('mn-dt').value='2026-06-22';
    w.document.getElementById('mn-fmt').value='bo3';
    w.document.getElementById('mn-pts').value='15';
    w.document.getElementById('mn-tie').value='11';
    w.salvarMinisJogo('');
    var g2=w.D.games.filter(function(g){return g.tid==='t_minis_afr';})[0];
    chk(g2 && g2.setPoints===15 && g2.tiePoints===11,'bo3: pontos editaveis salvos (15 / decisivo 11)');
    chk(w.setTarget(g2,1)===15 && w.setTarget(g2,3)===11,'bo3: set1=15, set3 (decisivo)=11');
    chk(w.gameMaxSets(g2)===3,'bo3: 3 sets');

    // 6. Card GAME DAY mostra as duas equipes
    var card=w.renderGameDayCard(g,false);
    chk(card.indexOf('RS COLOMBIA')>=0,'card: equipe da casa (RS COLOMBIA)');
    chk(card.indexOf('PORTUGAL')>=0,'card: adversaria (PORTUGAL)');

    console.log('\n=== '+ok+' ok, '+ko+' falhas ===');
    console.log(ko===0?'OK MINIS FASE 1b APROVADA':'FAIL MINIS FASE 1b REPROVADA');
    process.exit(ko===0?0:1);
  } catch(e){
    console.log('ERRO GERAL: '+e.message);
    console.log(e.stack);
    process.exit(1);
  }
},700);
