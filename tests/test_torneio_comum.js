// Torneio COMUM (criado pelo usuario) nao herda mais o legado USA/taca:
//  - escalacao vem da EQUIPE do jogo (nao do USA_ROSTER masculino);
//  - card mostra nome/categoria/equipe do PROPRIO torneio (nao "ADULTO MASCULINO
//    / ADULT OPEN CHAMPIONSHIP"); modal idem;
//  - equipes legadas (TOURNEY_ACCESS) somem das listas de gestao (getOwnTeams).
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');

const fakeDB = {};
const listeners = {};
function getAt(p){const a=p.split('/');let c=fakeDB;for(const k of a){if(c==null)return null;c=c[k];}return c===undefined?null:c;}
function setAt(p,v){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}c[a[a.length-1]]=JSON.parse(JSON.stringify(v));}
function makeRef(p){return{_path:p,on:function(e,cb){listeners[p]=cb;},once:function(){return Promise.resolve({val:()=>getAt(p)});},set:function(v){setAt(p,v);return Promise.resolve();},update:function(){return Promise.resolve();}};}
global.firebaseMock={initializeApp:()=>{},database:()=>({ref:makeRef}),auth:()=>({onAuthStateChanged:function(cb){setTimeout(()=>cb({uid:'tester',email:'rodrigosvolei@gmail.com',displayName:'Tester'}),0);},signInWithPopup:()=>Promise.resolve(),signOut:()=>Promise.resolve()})};

// Equipe feminina propria (com roster) + equipe legada (id de TOURNEY_ACCESS.taca) + torneio comum.
const seed = { 'torneio-master-santos': {
  teams:[
    {id:'trs_fem', n:'RS FEMININO C', c:'#ec4899', color:'#ec4899', roster:[{aid:'af1'},{aid:'af2'},{aid:'af3'}]},
    {id:'trs_e1', n:'RS FEMININO E1', c:'#0891b2', color:'#0891b2', roster:[{aid:'ae1'},{aid:'ae2'}]},
    {id:'t_taca_rs', n:'RS ADULTO MASCULINO', c:'#1d4ed8', roster:[]}
  ],
  athletes:[
    {aid:'af1',nm:'Ana',po:'Ponta'},{aid:'af2',nm:'Bia',po:'Levantadora'},{aid:'af3',nm:'Cris',po:'Central'},
    {aid:'ae1',nm:'Duda',po:'Oposto'},{aid:'ae2',nm:'Eva',po:'Central'}
  ],
  tournaments:[{id:'t_copa', n:'COPA DAZMENINAS', cat:'Misto', color:'#ec4899', tid:'trs_fem', st:'live', season:'2026.1', layout:'gameday'}],
  games:[{id:'gx', torId:'t_copa', tid:'trs_fem', opp:'SBTC', dt:'2026-07-11', st:'pending'}],
  invites:{}
}};
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

setTimeout(function(){
  try{
    ['teams','games','tournaments','athletes','invites'].forEach(function(k){
      var path='torneio-master-santos/'+k; if(listeners[path]) listeners[path]({val:function(){return getAt(path);}});
    });
    w.isCoord=true; w.isAdmin=true;

    // 1) getOwnTeams esconde a equipe legada, mantem a propria
    var own=w.getOwnTeams().map(function(t){return t.id;});
    chk(own.indexOf('t_taca_rs')<0,'getOwnTeams ESCONDE equipe legada (t_taca_rs / RS ADULTO MASCULINO)');
    chk(own.indexOf('trs_fem')>=0,'getOwnTeams MOSTRA equipe propria (RS FEMININO C)');

    // 2) Abrir GAME DAY card de jogo sem escalacao escala a EQUIPE (nao USA_ROSTER)
    w.openGameDayCard('gx');
    var gx=w.gF('gx');
    chk(gx.lineup && gx.lineup.length===3,'openGameDayCard: escala 3 da equipe (nao 15 do USA_ROSTER) ['+(gx.lineup?gx.lineup.length:0)+']');
    var nm1=(gx.lineup||[]).map(function(le){var a=w.aFind(le.aid);return a?a.nm:'';});
    chk(nm1.indexOf('Mateus')<0 && nm1.indexOf('Walisson')<0,'sem atletas-fantasma masculinos do USA_ROSTER');
    chk(nm1.indexOf('Ana')>=0 && nm1.indexOf('Bia')>=0,'lineup tem as atletas reais (Ana/Bia/Cris)');

    // 3) Criar jogo novo via salvarTorneioJogo herda equipe/categoria/escalacao do torneio
    w.selTor='t_copa';
    w.openTorneioNovoJogo();
    // modal ABERTO: textos refletem o torneio/equipe reais (nao "Torneio USA / RS-Voleibol")
    var modalSub=(w.document.querySelector('.tnj-sub')||{}).textContent||'';
    chk(modalSub.indexOf('Torneio USA')<0 && modalSub.indexOf('COPA DAZMENINAS')>=0,'modal: subtitulo = nome do torneio real');
    var teamOpts=Array.prototype.map.call(w.document.querySelectorAll('#tnj-team option'),function(o){return o.textContent;});
    chk(teamOpts.indexOf('RS FEMININO C')>=0 && teamOpts.indexOf('RS FEMININO E1')>=0,'modal: select traz VARIAS equipes (multi-equipe por torneio)');
    chk(teamOpts.indexOf('RS ADULTO MASCULINO')<0,'modal: select esconde equipe legada');
    // cria escolhendo OUTRA equipe que nao a default do torneio (prova multi-equipe)
    w.document.getElementById('tnj-team').value='trs_e1';
    w.document.getElementById('tnj-opp').value='ADVERSARIA FC';
    w.document.getElementById('tnj-dt').value='2026-07-20';
    w.salvarTorneioJogo();
    var gnew=w.D.games.filter(function(g){return g.torId==='t_copa' && g.opp==='ADVERSARIA FC';})[0];
    chk(!!gnew,'jogo novo criado no torneio comum');
    chk(gnew && gnew.tid==='trs_e1','jogo usa a EQUIPE ESCOLHIDA no modal (multi-equipe), nao a default');
    chk(gnew && gnew.cat==='Misto','jogo herda a CATEGORIA do torneio (nao "Adulto" fixo)');
    chk(gnew && gnew.lineup && gnew.lineup.length===2,'escalado com a equipe escolhida (Duda/Eva=2), nao USA_ROSTER');

    // 4) Card GAME DAY mostra brand do PROPRIO torneio, sem o legado USA
    var card=w.renderGameDayCard(gx,false);
    chk(card.indexOf('ADULT OPEN CHAMPIONSHIP')<0,'card SEM "ADULT OPEN CHAMPIONSHIP" (legado USA)');
    chk(card.indexOf('ADULTO')<0,'card SEM "ADULTO MASCULINO" (categoria real = Misto)');
    chk(card.indexOf('COPA DAZMENINAS')>=0,'card mostra o nome do PROPRIO torneio');
    chk(card.indexOf('RS FEMININO C')>=0,'card mostra a equipe mandante real');

    // 6) Numero da camisa: assume o cadastrado; sem numero NAO vira "UNDEFINED"
    chk(w._lineupNu({nu:7}, null, 'tx')===7,'numero: usa o da lineup quando existe');
    chk(w._lineupNu({aid:'x'}, {last_nu_by_team:{trs_fem:9}}, 'trs_fem')===9,'numero: assume o cadastrado (last_nu_by_team) quando a lineup so tem aid');
    chk(w._lineupNu({aid:'x'}, {nm:'Sem Num'}, 'trs_fem')===null,'numero: sem cadastro retorna null (vira "-", nunca "UNDEFINED")');

    console.log('\n=== '+ok+' ok, '+ko+' falhas ===');
    console.log(ko===0?'OK TORNEIO-COMUM APROVADO':'FAIL TORNEIO-COMUM REPROVADO');
    process.exit(ko===0?0:1);
  }catch(e){ console.log('ERRO GERAL: '+e.message); console.log(e.stack); process.exit(1); }
},700);
