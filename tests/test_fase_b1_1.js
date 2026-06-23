// Fase B1.1 — rTorDetail abre GAME DAY quando torneio tem layout 'gameday'.
// Asserta: tnyLayout heuristica; rTorDetail emite gd-card para torneio gameday;
// click no card via openGameDayCard prepara o jogo e vai pra tab=scout;
// botoes admin (gd-edit/gd-del) NAO aparecem no fluxo unificado;
// torneio default continua usando renderTeamHub.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');

const fakeDB = {};
const listeners = {};
function getAt(p){const a=p.split('/');let c=fakeDB;for(const k of a){if(c==null)return null;c=c[k];}return c===undefined?null:c;}
function setAt(p,v){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}c[a[a.length-1]]=JSON.parse(JSON.stringify(v));}
function makeRef(p){return{_path:p,on:function(e,cb){listeners[p]=cb;},once:function(){return Promise.resolve({val:()=>getAt(p)});},set:function(v){setAt(p,v);return Promise.resolve();},update:function(){return Promise.resolve();}};}
global.firebaseMock={initializeApp:()=>{},database:()=>({ref:makeRef}),auth:()=>({onAuthStateChanged:function(cb){setTimeout(()=>cb({uid:'visit',email:'visitante@rs.com',displayName:'Visitante'}),0);},signInWithPopup:()=>Promise.resolve(),signOut:()=>Promise.resolve()})};

// 2 torneios: um com layout gameday (legacy USA), outro default.
const seed = {
  'torneio-master-santos': {
    teams:[{id:'trs',n:'RS Adulto Masc',c:'#2563eb',roster:[{aid:'a1'},{aid:'a2'}]}],
    athletes:[{aid:'a1',nm:'Atleta 1',po:'Ponta'},{aid:'a2',nm:'Atleta 2',po:'Central'}],
    tournaments:[
      {id:'t_usa_open',n:'2026 Adult Open Championship',c:'#1d7a3a',color:'#1d7a3a',cat:'Adulto',season:'2026'},
      {id:'t_normal',n:'Liga Estadual 2026',c:'#2563eb',color:'#2563eb',cat:'Adulto',season:'2026'}
    ],
    games:[
      {id:'g_usa_1',torId:'t_usa_open',tid:'trs',opp:'Arlington Empire',dt:'2026-06-10',tm:'10:00',st:'pending',lineup:[{aid:'a1',nu:1}]},
      {id:'g_usa_2',torId:'t_usa_open',tid:'trs',opp:'The Tall Ones',dt:'2026-06-11',tm:'11:00',st:'pending',lineup:[{aid:'a1',nu:1}]},
      {id:'g_normal_1',torId:'t_normal',tid:'trs',opp:'Time A',dt:'2026-06-12',tm:'18:00',st:'pending',lineup:[{aid:'a1',nu:1}]}
    ],
    invites:{}
  }
};
Object.assign(fakeDB, JSON.parse(JSON.stringify(seed)));

const htmlMod = html
  .replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>/g,'')
  .replace('firebase.initializeApp(fc);','var firebase=window.firebaseMock; firebase.initializeApp(fc);');

// Boot SEM ?torneio=usa — fluxo aba unificado.
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
    // Entregar dados
    ['teams','games','tournaments','athletes','invites'].forEach(k=>{
      const path='torneio-master-santos/'+k;
      if(listeners[path]) listeners[path]({val:()=>getAt(path)});
    });

    // Confirmar boot em modo aba (nao isolado)
    chk(w.torneioMode===false,'boot sem ?torneio=usa: torneioMode = false');

    // 1. Helpers existem
    chk(typeof w.tnyLayout==='function','tnyLayout(tor) helper existe');
    chk(typeof w.openGameDayCard==='function','openGameDayCard(gid) dispatcher existe');

    // 2. tnyLayout: USA legacy + flag layout='gameday' + default
    const torUsa = w.tFnd('t_usa_open');
    const torNormal = w.tFnd('t_normal');
    chk(w.tnyLayout(torUsa)==='gameday','tnyLayout: USA (fallback por id) = gameday');
    chk(w.tnyLayout(torNormal)==='gameday','tnyLayout: torneio sem flag = gameday (novo padrao unificado)');
    chk(w.tnyLayout({id:'x',layout:'gameday'})==='gameday','tnyLayout: flag explicita layout=gameday respeitada');
    chk(w.tnyLayout(null)==='default','tnyLayout(null) = default (defensivo)');

    // 3. Sair do landing e renderizar shell em tab=torneios
    w.showLanding=false; w.torneioMode=false; w.signupMode=false;
    w.tab='torneios'; w.selTor=null; w.render();
    const m0 = w.document.getElementById('mainApp').innerHTML;
    chk(m0.indexOf('rs-tor-page')>=0,'aba Torneios renderiza listagem (rs-tor-page)');

    // 4. Selecionar o torneio USA leva pro detalhe com GAME DAY cards
    w.selectTor('t_usa_open');
    const m1 = w.document.getElementById('mainApp').innerHTML;
    chk(m1.indexOf('rs-tor-detail')>=0,'rTorDetail wrapper presente');
    chk(m1.indexOf('gd-card')>=0,'gameday: emite gd-card');
    chk((m1.match(/gd-card/g)||[]).length>=2,'gameday: emite pelo menos 2 gd-cards (2 jogos USA)');
    chk(m1.indexOf('gd-next-tag')>=0 || m1.indexOf('gd-next')>=0,'gameday: ao menos um card eh marcado como PROXIMO JOGO');

    // 5. NO modo aba, botoes admin (gd-edit/gd-del) NAO devem aparecer
    chk(m1.indexOf('gd-edit')<0,'gameday em modo aba: SEM botao gd-edit (Editar jogo)');
    chk(m1.indexOf('gd-del')<0,'gameday em modo aba: SEM botao gd-del (Excluir jogo)');
    chk(m1.indexOf('openTorneioEditarJogo')<0,'gameday em modo aba: SEM handler openTorneioEditarJogo');

    // 6. Click handler dos cards eh openGameDayCard (nao mais openTorneioGame direto)
    chk(m1.indexOf('openGameDayCard')>=0,'gameday: click handler eh openGameDayCard');

    // 7. Disparar openGameDayCard prepara o jogo e vai pra tab=scout
    w.openGameDayCard('g_usa_1');
    const g = w.gF('g_usa_1');
    chk(g.ss && g.ss.length>=1,'openGameDayCard cria/preserva ss (placar)');
    chk(Array.isArray(g.act),'openGameDayCard cria/preserva act (acoes)');
    chk(w.S && w.S.aid==='g_usa_1','S.aid setado pro jogo selecionado');
    chk(w.tab==='scout','tab navega pra "scout" apos abrir GAME DAY card');
    chk(w.torneioMode===false,'tab mode NAO ativa torneioMode (continua unificado)');

    // 8. Selecionar o torneio NORMAL: AGORA tambem usa GAME DAY (padrao unificado, decisao Rodrigo)
    w.tab='torneios'; w.selectTor('t_normal');
    const m2 = w.document.getElementById('mainApp').innerHTML;
    chk(m2.indexOf('rs-tor-detail')>=0,'rTorDetail wrapper presente no torneio sem flag');
    chk(m2.indexOf('gd-card')>=0,'torneio sem flag AGORA emite gd-card (gameday eh o padrao)');
    chk(m2.indexOf('Por Equipe')<0 && m2.indexOf('th-card')<0,'torneio sem flag NAO usa mais team-hub (agora eh gameday)');

    // 9. Voltar pra listagem nao quebra
    w.selectTor(null);
    chk(w.selTor===null,'selectTor(null) volta pra listagem');

    // 10. No fluxo legado (torneioMode=true), botoes admin VOLTAM (regressao reversa)
    //     Isso garante que nao quebramos quem ainda usa ?torneio=usa.
    w.torneioMode=true; w.torneioId='t_usa_open'; w.torneioUnlocked=true; w.render();
    const m3 = w.document.getElementById('mainApp').innerHTML;
    chk(m3.indexOf('gd-card')>=0,'modo isolado: GAME DAY cards continuam renderizando');
    chk(m3.indexOf('gd-edit')>=0,'modo isolado: botao gd-edit VOLTA (admin gate via senha)');
    chk(m3.indexOf('gd-del')>=0,'modo isolado: botao gd-del VOLTA');
    chk(m3.indexOf('openGameDayCard')>=0,'modo isolado: tambem usa openGameDayCard (dispatcher delega)');

    console.log('\n=== '+ok+' ok, '+ko+' falhas ===');
    console.log(ko===0?'OK FASE B1.1 APROVADA':'FAIL FASE B1.1 REPROVADA');
    process.exit(ko===0?0:1);
  } catch(e){
    console.log('ERRO GERAL: '+e.message);
    console.log(e.stack);
    process.exit(1);
  }
},700);
