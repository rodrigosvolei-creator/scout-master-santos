const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');

const fakeDB = {};
const listeners = {};  // path -> callback do .on()

function getAt(path){
  const parts = path.split('/');
  let cur = fakeDB;
  for(const p of parts){ if(cur==null) return null; cur = cur[p]; }
  return cur===undefined? null : cur;
}
function setAt(path, v){
  const parts = path.split('/');
  let cur = fakeDB;
  for(let i=0;i<parts.length-1;i++){ if(cur[parts[i]]==null||typeof cur[parts[i]]!=='object') cur[parts[i]]={}; cur=cur[parts[i]]; }
  cur[parts[parts.length-1]] = JSON.parse(JSON.stringify(v));
}
function makeRef(path){
  return {
    _path: path,
    on: function(ev, cb){ listeners[path]=cb; },
    once: function(){ return Promise.resolve({ val: ()=>getAt(path) }); },
    set: function(v){ setAt(path,v); return Promise.resolve(); },
    update: function(){ return Promise.resolve(); },
  };
}

global.firebaseMock = {
  initializeApp: ()=>{},
  database: ()=>({ ref: makeRef }),
  auth: ()=>({
    onAuthStateChanged: function(cb){ setTimeout(()=>cb(null),0); },
    signInWithPopup: ()=>Promise.resolve(),
    signOut: ()=>Promise.resolve(),
  }),
};

const seed = {
  'torneio-master-santos': {
    teams: [ {id:'trs_adulto', n:'RS-VOLEIBOL ADULTO MASCULINO', c:'#2563eb', roster:[{aid:'a1'},{aid:'a2'}]} ],
    athletes: [ {aid:'a1', nm:'Mateus', po:'Ponta'}, {aid:'a2', nm:'Hugo', po:'Central'} ],
    tournaments: [ {id:'t_usa_open', n:'2026 Adult Open Championship', c:'#1d7a3a'} ],
    games: [ {id:'g_usa_1', torId:'t_usa_open', tid:'trs_adulto', opp:'Arlington Empire', dt:'2026-05-22', tm:'10:00', st:'pending', lineup:[{aid:'a1',nu:1},{aid:'a2',nu:3}]} ],
    invites: {},
  }
};
Object.assign(fakeDB, JSON.parse(JSON.stringify(seed)));

let htmlMod = html
  .replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>/g, '')
  .replace('firebase.initializeApp(fc);', 'var firebase=window.firebaseMock; firebase.initializeApp(fc);');

const dom = new JSDOM(htmlMod, {
  url: 'https://master.associacaoscoladevoleibol.com.br/?torneio=usa',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  beforeParse(window){
    window.firebaseMock = global.firebaseMock;
    window.AudioContext = function(){ return {createOscillator:()=>({connect:()=>{},frequency:{},start:()=>{},stop:()=>{}}),createGain:()=>({connect:()=>{},gain:{}}),destination:{},currentTime:0}; };
    window.navigator.vibrate = ()=>{};
  }
});
const w = dom.window;

setTimeout(()=>{
  try {
    console.log('=== ETAPA 1: app carregou ===');
    console.log('torneioMode =', w.torneioMode, '| torneioId =', w.torneioId);
    console.log('listeners registrados:', Object.keys(listeners).join(', '));

    console.log('\n=== ETAPA 2: entregar dados do banco aos listeners ===');
    ['teams','games','tournaments','athletes','invites'].forEach(k=>{
      const path = 'torneio-master-santos/'+k;
      if(listeners[path]) listeners[path]({ val: ()=>getAt(path) });
    });
    console.log('D.games =', w.D&&w.D.games?w.D.games.length:'undef', '| D.teams =', w.D&&w.D.teams?w.D.teams.length:'undef');

    console.log('\n=== ETAPA 3: desbloquear senha ===');
    w.torneioUnlocked = true; w.render();

    console.log('\n=== ETAPA 4: abrir scout (openTorneioGame) ===');
    w.openTorneioGame('g_usa_1');
    const g = w.gF('g_usa_1');
    console.log('S.aid =', w.S.aid);
    console.log('jogo.ss =', JSON.stringify(g.ss), g.ss?'✅ ss criado':'❌ ss FALTANDO');
    console.log('jogo.act =', Array.isArray(g.act)?'✅ array':'❌ FALTANDO');

    console.log('\n=== ETAPA 5: INICIAR PARTIDA ===');
    w.startG();
    console.log('jogo.st =', w.gF('g_usa_1').st, w.gF('g_usa_1').st==='live'?'✅':'❌');

    console.log('\n=== ETAPA 6: BOTAO + DO PLACAR ===');
    let e1=null; try{ w.scUp('u'); }catch(e){e1=e;}
    if(e1){ console.log('❌ scUp travou:', e1.message); }
    else {
      const u = w.gF('g_usa_1').ss[0].u;
      console.log('placar u apos +:', u, u===1?'✅ + FUNCIONA':'❌');
    }
    try{ w.scUp('u'); w.scUp('t'); w.scDn('u'); }catch(e){ console.log('❌ erro +/-:',e.message); }
    const s = w.gF('g_usa_1').ss[0];
    console.log('apos +u +u +t -u => u='+s.u+' t='+s.t, (s.u===1&&s.t===1)?'✅':'❌');

    console.log('\n=== ETAPA 7: MARCAR ACAO ATLETA (rcO) ===');
    w.S.sp='a1'; w.S.sa='Saque';
    let e2=null; try{ w.rcO('Ace'); }catch(e){e2=e;}
    if(e2){ console.log('❌ rcO travou:', e2.message); }
    else {
      const n = w.gF('g_usa_1').act.length;
      console.log('acoes registradas:', n, n===1?'✅ MARCAR FUNCIONA':'❌');
    }

    console.log('\n=== ETAPA 8: showFlash ===');
    console.log('typeof showFlash =', typeof w.showFlash, typeof w.showFlash==='function'?'✅':'❌');

    console.log('\n=== ETAPA 9: PERSISTENCIA (simula F5) ===');
    // o save() escreveu em fakeDB? conferir
    const savedGames = getAt('torneio-master-santos/games');
    const savedG = Array.isArray(savedGames)? savedGames.find(x=>x&&x.id==='g_usa_1') : null;
    if(savedG){
      console.log('jogo no banco: st='+savedG.st+' ss='+JSON.stringify(savedG.ss)+' act='+(savedG.act?savedG.act.length:0));
      const persisteOk = savedG.st==='live' && savedG.ss && savedG.ss[0] && savedG.ss[0].u===2 && savedG.act && savedG.act.length===1;
      console.log(persisteOk?'✅ DADOS GRAVADOS NO BANCO (sobrevive F5)':'❌ dados NAO gravados');
    } else { console.log('❌ jogo nao encontrado no banco gravado'); }

    console.log('\n=== RESULTADO FINAL ===');
    const ss = w.gF('g_usa_1').ss[0];
    const ac = w.gF('g_usa_1').act;
    const savedOk = savedG && savedG.st==='live' && savedG.ss[0].u===2 && savedG.act.length===1;
    const ok = ss.u===2 && ss.t===1 && ac.length===1 && typeof w.showFlash==='function' && savedOk;
    console.log(ok ? '✅✅✅ APROVADO — placar, acoes e gravacao OK' : '❌ REPROVADO');
    process.exit(ok?0:1);
  } catch(e){
    console.log('❌ ERRO GERAL:', e.message);
    console.log(e.stack);
    process.exit(1);
  }
}, 600);
