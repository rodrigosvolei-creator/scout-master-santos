// Fase B2.1 — gameAutoTarja helper + tarja universal nos cards.
// Asserta:
//   1. Helper gameAutoTarja existe e retorna 'cancelled' / 'no_data' / null.
//   2. Manual (g.status_tag) prevalece sobre auto.
//   3. Auto-tarja "SEM DADOS" para jogo passado, sem acoes, sem result.type.
//   4. renderGameCard mostra tarja CANCELADO E SEM DADOS no card simples.
//   5. renderGameDayCard mostra tarja overlay + atributo data-tarja.
//   6. Jogos futuros, com acoes, ou com resultado NAO recebem tarja auto.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');

const fakeDB = {};
const listeners = {};
function getAt(p){const a=p.split('/');let c=fakeDB;for(const k of a){if(c==null)return null;c=c[k];}return c===undefined?null:c;}
function setAt(p,v){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}c[a[a.length-1]]=JSON.parse(JSON.stringify(v));}
function makeRef(p){return{_path:p,on:function(e,cb){listeners[p]=cb;},once:function(){return Promise.resolve({val:()=>getAt(p)});},set:function(v){setAt(p,v);return Promise.resolve();},update:function(){return Promise.resolve();}};}
global.firebaseMock={initializeApp:()=>{},database:()=>({ref:makeRef}),auth:()=>({onAuthStateChanged:function(cb){setTimeout(()=>cb(null),0);},signInWithPopup:()=>Promise.resolve(),signOut:()=>Promise.resolve()})};

// Datas relativas a "hoje" pro teste ser deterministico
function offsetDate(days){
  var d=new Date();d.setDate(d.getDate()+days);
  var z=function(n){return(n<10?"0":"")+n;};
  return d.getFullYear()+"-"+z(d.getMonth()+1)+"-"+z(d.getDate());
}
const PAST   = offsetDate(-7);   // 1 semana atras
const FUTURE = offsetDate(+7);   // 1 semana a frente

// Mix de jogos: passado sem dados, passado com acoes, passado com result,
// futuro, manualmente cancelado, manualmente no_data.
const seed = {
  'torneio-master-santos': {
    teams:[{id:'trs',n:'RS Adulto Masc',c:'#2563eb',roster:[{aid:'a1'}]}],
    athletes:[{aid:'a1',nm:'Atleta 1',po:'Ponta'}],
    tournaments:[{id:'t_usa_open',n:'2026 Adult Open Championship',c:'#1d7a3a',color:'#1d7a3a'}],
    games:[
      {id:'g_past_nodata', torId:'t_usa_open',tid:'trs',opp:'Time A',dt:PAST,  tm:'10:00',st:'pending',lineup:[]},
      {id:'g_past_acted',  torId:'t_usa_open',tid:'trs',opp:'Time B',dt:PAST,  tm:'11:00',st:'done',act:[{id:'a1',pid:'a1',ak:'saque',oc:'Ace',set:1}],lineup:[]},
      {id:'g_past_result', torId:'t_usa_open',tid:'trs',opp:'Time C',dt:PAST,  tm:'12:00',st:'done',result:{type:'win',sets:'3x1'},lineup:[]},
      {id:'g_future',      torId:'t_usa_open',tid:'trs',opp:'Time D',dt:FUTURE,tm:'10:00',st:'pending',lineup:[]},
      {id:'g_manual_cancel',torId:'t_usa_open',tid:'trs',opp:'Time E',dt:FUTURE,tm:'14:00',st:'pending',status_tag:'cancelled',lineup:[]},
      {id:'g_manual_nodata',torId:'t_usa_open',tid:'trs',opp:'Time F',dt:FUTURE,tm:'15:00',st:'pending',status_tag:'no_data',lineup:[]}
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

    // 1. Helper existe
    chk(typeof w.gameAutoTarja==='function','gameAutoTarja(g) helper existe');

    // 2. Comportamento do helper
    chk(w.gameAutoTarja(null)===null,'gameAutoTarja(null) = null (defensivo)');
    chk(w.gameAutoTarja(w.gF('g_past_nodata'))==='no_data','jogo passado + sem acoes + sem result => "no_data"');
    chk(w.gameAutoTarja(w.gF('g_past_acted'))===null,'jogo passado COM acoes => null (nao recebe tarja)');
    chk(w.gameAutoTarja(w.gF('g_past_result'))===null,'jogo passado COM result.type => null');
    chk(w.gameAutoTarja(w.gF('g_future'))===null,'jogo futuro => null (sem tarja)');

    // 3. Manual prevalece
    chk(w.gameAutoTarja(w.gF('g_manual_cancel'))==='cancelled','g.status_tag="cancelled" prevalece (mesmo jogo futuro)');
    chk(w.gameAutoTarja(w.gF('g_manual_nodata'))==='no_data','g.status_tag="no_data" prevalece (mesmo jogo futuro)');

    // Manual prevalece tambem sobre auto: jogo passado SEM dados, marcado como cancelled vira "cancelled" (nao "no_data")
    const g2 = Object.assign({}, w.gF('g_past_nodata'), {status_tag:'cancelled'});
    chk(w.gameAutoTarja(g2)==='cancelled','manual "cancelled" sobrescreve auto "no_data"');

    // 4. renderGameCard emite a tarja (HTML do card simples)
    if(typeof w.renderGameCard==='function'){
      const hNoData = w.renderGameCard(w.gF('g_past_nodata'), '#1d7a3a');
      chk(hNoData.indexOf('game-tarja')>=0 && hNoData.indexOf('SEM DADOS')>=0,'renderGameCard: jogo passado sem dados emite tarja SEM DADOS');
      chk(hNoData.indexOf('game-no-data')>=0,'renderGameCard: card recebe classe game-no-data');

      const hCancel = w.renderGameCard(w.gF('g_manual_cancel'), '#1d7a3a');
      chk(hCancel.indexOf('CANCELADO')>=0,'renderGameCard: status_tag=cancelled emite tarja CANCELADO');
      chk(hCancel.indexOf('game-cancelled')>=0,'renderGameCard: card recebe classe game-cancelled');
      chk(hCancel.indexOf('is-cancelled')>=0,'renderGameCard: span da tarja tem modifier is-cancelled');

      const hFuture = w.renderGameCard(w.gF('g_future'), '#1d7a3a');
      chk(hFuture.indexOf('game-tarja')<0 && hFuture.indexOf('CANCELADO')<0,'renderGameCard: jogo futuro nao emite tarja');
    }

    // 5. renderGameDayCard emite tarja overlay + data-tarja
    const hGdNoData = w.renderGameDayCard(w.gF('g_past_nodata'), false);
    chk(hGdNoData.indexOf('data-tarja="no_data"')>=0,'renderGameDayCard: jogo passado sem dados tem data-tarja="no_data"');
    chk(hGdNoData.indexOf('gd-tarja')>=0 && hGdNoData.indexOf('SEM DADOS')>=0,'renderGameDayCard: overlay .gd-tarja com texto SEM DADOS');

    const hGdCancel = w.renderGameDayCard(w.gF('g_manual_cancel'), false);
    chk(hGdCancel.indexOf('data-tarja="cancelled"')>=0,'renderGameDayCard: status_tag=cancelled => data-tarja="cancelled"');
    chk(hGdCancel.indexOf('CANCELADO')>=0,'renderGameDayCard: overlay com texto CANCELADO');
    chk(hGdCancel.indexOf('is-cancelled')>=0,'renderGameDayCard: span da tarja tem modifier is-cancelled');

    const hGdFuture = w.renderGameDayCard(w.gF('g_future'), false);
    chk(hGdFuture.indexOf('data-tarja')<0,'renderGameDayCard: jogo futuro sem data-tarja');
    chk(hGdFuture.indexOf('gd-tarja')<0,'renderGameDayCard: jogo futuro sem overlay');

    const hGdResult = w.renderGameDayCard(w.gF('g_past_result'), false);
    chk(hGdResult.indexOf('data-tarja')<0,'renderGameDayCard: jogo passado COM result NAO recebe tarja');

    // 6. CSS tem as regras
    const css = htmlMod.match(/<style>([\s\S]*?)<\/style>/)[1];
    chk(css.indexOf('.gd-tarja{')>=0,'CSS contem .gd-tarja');
    chk(css.indexOf('.gd-tarja-text.is-cancelled')>=0,'CSS contem modifier is-cancelled (GAME DAY)');
    chk(css.indexOf('.game-tarja-text.is-cancelled')>=0,'CSS contem modifier is-cancelled (card simples)');
    chk(css.indexOf('.gd-card[data-tarja]')>=0,'CSS contem .gd-card[data-tarja] (opacity + grayscale)');

    // 7. Integracao com B1.1: rTorDetail no torneio gameday tambem renderiza tarjas
    w.showLanding=false; w.torneioMode=false; w.signupMode=false;
    w.tab='torneios'; w.selectTor('t_usa_open');
    const main = w.document.getElementById('mainApp').innerHTML;
    chk(main.indexOf('SEM DADOS')>=0,'rTorDetail (gameday): exibe tarja SEM DADOS no jogo passado');
    chk(main.indexOf('CANCELADO')>=0,'rTorDetail (gameday): exibe tarja CANCELADO no jogo manualmente marcado');
    chk(main.indexOf('data-tarja="cancelled"')>=0,'rTorDetail (gameday): atributo data-tarja="cancelled" presente');

    console.log('\n=== '+ok+' ok, '+ko+' falhas ===');
    console.log(ko===0?'OK FASE B2.1 APROVADA':'FAIL FASE B2.1 REPROVADA');
    process.exit(ko===0?0:1);
  } catch(e){
    console.log('ERRO GERAL: '+e.message);
    console.log(e.stack);
    process.exit(1);
  }
},700);
