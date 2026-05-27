// Fase PG — página isolada do Time Praia Grande (?torneio=pg).
// Asserta:
//   1. TOURNEY_ACCESS.pg existe com pwd/adminPwd corretos e standalone:true
//   2. PG_LOGO e PG_ROSTER definidos no escopo global
//   3. URL ?torneio=pg ativa modo isolado (torneioMode=true, torneioToken="pg")
//   4. URL ?torneio=usa CONTINUA redirecionando pra aba unificada (regressao B1.2)
//   5. Sem senha, renderTorneioIsolado mostra a tela de senha (gate religado pra PG)
//   6. Com senha (pwd correta), checkTorneioPwd destrava e mostra cards
//   7. getBrand("pg") retorna o brand correto (logo PG, texto Praia Grande)
//   8. renderTorneioCards usa o brand parametrizado (NAO mostra USA TOURNAMENT)
//   9. renderGameDayCard usa o brand parametrizado (NAO mostra RS VOLEIBOL)
//  10. salvarTorneioJogo em PG cria torneio+equipe automaticamente (bootstrap)
//  11. Senha de admin pgadmin2026 destrava
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');

const fakeDB = {};
const listeners = {};
function getAt(p){const a=p.split('/');let c=fakeDB;for(const k of a){if(c==null)return null;c=c[k];}return c===undefined?null:c;}
function setAt(p,v){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}c[a[a.length-1]]=JSON.parse(JSON.stringify(v));}
function makeRef(p){return{_path:p,on:function(e,cb){listeners[p]=cb;},once:function(){return Promise.resolve({val:()=>getAt(p)});},set:function(v){setAt(p,v);return Promise.resolve();},update:function(){return Promise.resolve();}};}
global.firebaseMock={initializeApp:()=>{},database:()=>({ref:makeRef}),auth:()=>({onAuthStateChanged:function(cb){setTimeout(()=>cb(null),0);},signInWithPopup:()=>Promise.resolve(),signOut:()=>Promise.resolve()})};

// Seed minimal — produção real PG nao tem torneio nem time ainda, queremos
// testar o bootstrap. So colocamos uma equipe RS pra confirmar que NAO eh herdada.
const seed = {
  'torneio-master-santos': {
    teams:[{id:'trs',n:'RS Adulto Masc',c:'#dc2626',roster:[{aid:'a_rs1'}]}],
    athletes:[{aid:'a_rs1',nm:'Atleta RS 1',po:'Ponta'}],
    tournaments:[],
    games:[],
    invites:{}
  }
};
Object.assign(fakeDB, JSON.parse(JSON.stringify(seed)));

const htmlMod = html
  .replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>/g,'')
  .replace('firebase.initializeApp(fc);','var firebase=window.firebaseMock; firebase.initializeApp(fc);');

const dom = new JSDOM(htmlMod, {
  url: 'https://master.associacaoscoladevoleibol.com.br/?torneio=pg',
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

    // 1. TOURNEY_ACCESS.pg configurado
    chk(w.TOURNEY_ACCESS && w.TOURNEY_ACCESS.pg,'TOURNEY_ACCESS.pg existe');
    chk(w.TOURNEY_ACCESS.pg.pwd==='PG2026','PG: senha de acesso = PG2026');
    chk(w.TOURNEY_ACCESS.pg.adminPwd==='pgadmin2026','PG: senha de admin = pgadmin2026');
    chk(w.TOURNEY_ACCESS.pg.standalone===true,'PG: flag standalone=true (pagina isolada)');
    chk(w.TOURNEY_ACCESS.pg.torId==='t_pg_open','PG: torId = t_pg_open');
    chk(w.TOURNEY_ACCESS.pg.teamId==='t_pg_main','PG: teamId = t_pg_main (separado do RS)');

    // 2. PG_LOGO e PG_ROSTER no escopo global
    chk(typeof w.PG_LOGO==='string' && w.PG_LOGO.indexOf('data:image/svg')===0,'PG_LOGO: data URI SVG presente');
    chk(Array.isArray(w.PG_ROSTER),'PG_ROSTER: array (vazio por enquanto)');

    // 3. URL ?torneio=pg ATIVOU modo isolado
    chk(w.torneioMode===true,'?torneio=pg ativa torneioMode=true (modo isolado)');
    chk(w.torneioToken==='pg','torneioToken=pg');
    chk(w.torneioId==='t_pg_open','torneioId=t_pg_open');
    chk(w.torneioUnlocked===false,'torneioUnlocked=false (senha sera pedida)');

    // 5. renderTorneioIsolado sem senha => tela de senha
    var html_a = w.renderTorneioIsolado();
    chk(html_a.indexOf('usa-lock-card')>=0,'sem senha: renderiza .usa-lock-card (tela de senha)');
    chk(html_a.indexOf('checkTorneioPwd')>=0,'sem senha: HTML chama checkTorneioPwd ao submeter');
    chk(html_a.indexOf('PG_LOGO')<0,'sem senha: nao expoe nome da variavel (security)');
    // Logo da tela de senha eh o do PG (data URI)
    chk(html_a.indexOf(w.PG_LOGO.substring(0,80))>=0,'sem senha: tela usa o PG_LOGO (nao o RS LR)');

    // 7. getBrand("pg") retorna brand correto
    var brand=w.getBrand('pg');
    chk(brand.logo===w.PG_LOGO,'getBrand("pg"): logo = PG_LOGO');
    chk(brand.team==='PRAIA GRANDE','getBrand("pg"): team = PRAIA GRANDE');
    chk(brand.title==='JOGOS REGIONAIS 2026','getBrand("pg"): title = JOGOS REGIONAIS 2026');
    chk(brand.color==='#06b6d4','getBrand("pg"): color = #06b6d4 (placeholder)');
    // Default (sem token) volta pro USA pra backward compat
    var brand0=w.getBrand(null);
    chk(brand0.logo===w.LR,'getBrand(null): default logo = LR (USA fallback)');
    chk(brand0.team==='RS VOLEIBOL','getBrand(null): default team = RS VOLEIBOL');

    // 6. Destrava senha PG2026
    w.torneioUnlocked=false;
    // Simular input da senha (renderTorneioIsolado ja renderizou no DOM via render())
    w.render();
    var inp=w.document.getElementById('usa-pwd');
    chk(inp!=null,'campo de senha #usa-pwd presente no DOM');
    if(inp){
      inp.value='PG2026';
      w.checkTorneioPwd();
      chk(w.torneioUnlocked===true,'PG2026 destrava (torneioUnlocked=true)');
    }

    // 8. renderTorneioCards usa brand PG
    var html_b = w.renderTorneioCards({n:'Jogos Regionais 2026'});
    chk(html_b.indexOf('PRAIA GRANDE')>=0,'cards: header mostra PRAIA GRANDE');
    chk(html_b.indexOf('USA TOURNAMENT')<0,'cards: NAO mostra USA TOURNAMENT (brand correto)');
    chk(html_b.indexOf('RS-VOLEIBOL')<0,'cards: NAO mostra RS-VOLEIBOL (sem vinculo com RS)');

    // 9. renderGameDayCard com um jogo mock — usa brand PG
    var mockG={id:'g_mock',torId:'t_pg_open',opp:'Adversario X',dt:'2026-08-10',tm:'10:00',st:'pending',lineup:[]};
    var html_c = w.renderGameDayCard(mockG, true);
    chk(html_c.indexOf('PRAIA GRANDE')>=0,'GAME DAY card: time = PRAIA GRANDE');
    chk(html_c.indexOf('RS VOLEIBOL')<0,'GAME DAY card: NAO mostra RS VOLEIBOL');
    chk(html_c.indexOf('JOGOS REGIONAIS 2026')>=0,'GAME DAY card: faixa lateral = JOGOS REGIONAIS 2026');
    chk(html_c.indexOf('ADULT OPEN CHAMPIONSHIP')<0,'GAME DAY card: NAO mostra texto do USA');

    // 10. salvarTorneioJogo (admin) bootstrap: cria torneio + equipe PG
    w.torneioAdminUnlocked=true; // bypass admin gate p/ teste
    w.openTorneioNovoJogo();
    // O modal foi aberto. Preenche e salva.
    w.document.getElementById('tnj-opp').value='Time Y';
    w.document.getElementById('tnj-dt').value='2026-09-01';
    w.document.getElementById('tnj-tm').value='14:00';
    var torAntes = (w.D.tournaments||[]).length;
    var teamsAntes = (w.D.teams||[]).length;
    var gamesAntes = (w.D.games||[]).length;
    w.salvarTorneioJogo();
    chk(w.D.tournaments.length===torAntes+1,'bootstrap: torneio t_pg_open criado em D.tournaments');
    chk(!!w.tFnd('t_pg_open'),'bootstrap: t_pg_open existe via tFnd');
    chk(w.D.teams.length===teamsAntes+1,'bootstrap: equipe t_pg_main criada em D.teams');
    chk(!!w.tF('t_pg_main'),'bootstrap: t_pg_main existe via tF');
    chk(w.tF('t_pg_main').n==='PRAIA GRANDE','bootstrap: nome da equipe = PRAIA GRANDE');
    chk(w.D.games.length===gamesAntes+1,'bootstrap: 1o jogo criado');
    // Critico: novo jogo tem tid=t_pg_main, NAO trs (RS)
    var novo = w.D.games[w.D.games.length-1];
    chk(novo.tid==='t_pg_main','NOVO JOGO: tid=t_pg_main (NAO herda equipe RS)');
    chk(novo.torId==='t_pg_open','NOVO JOGO: torId=t_pg_open');

    // 11. Editor de brand (logo + nome + subtitulo) — editavel pelo app
    chk(typeof w.openBrandEditor==='function','openBrandEditor() funcao existe');
    chk(typeof w.handleBrandLogo==='function','handleBrandLogo() funcao existe');
    chk(typeof w.saveBrandEditor==='function','saveBrandEditor() funcao existe');

    // Botao "Editar brand" aparece pra admin no header dos cards
    var html_d = w.renderTorneioCards({n:'Jogos Regionais 2026'});
    chk(html_d.indexOf('usa-brand-edit')>=0,'admin: botao .usa-brand-edit aparece no header');
    chk(html_d.indexOf('openBrandEditor')>=0,'admin: botao chama openBrandEditor');

    // Sem permissao: botao NAO aparece
    w.torneioAdminUnlocked=false;
    var html_e = w.renderTorneioCards({n:'Jogos Regionais 2026'});
    chk(html_e.indexOf('usa-brand-edit')<0,'sem admin: botao Editar brand NAO aparece');
    w.torneioAdminUnlocked=true;

    // Abrir o editor + salvar novo brand
    var prev=w.document.getElementById('tnjModal'); if(prev) prev.remove();
    w.openBrandEditor();
    var modal=w.document.getElementById('tnjModal');
    chk(modal!=null,'openBrandEditor abre modal');
    if(modal){
      chk(modal.innerHTML.indexOf('EDITAR BRAND')>=0,'modal: titulo EDITAR BRAND');
      chk(modal.innerHTML.indexOf('brand-title')>=0,'modal: campo brand-title');
      chk(modal.innerHTML.indexOf('brand-sub')>=0,'modal: campo brand-sub');
      chk(modal.innerHTML.indexOf('brand-logo-input')>=0,'modal: input file pro logo');
    }

    // Trocar titulo e subtitulo + salvar
    w.document.getElementById('brand-title').value='Praia Grande Open 2026';
    w.document.getElementById('brand-sub').value='PRAIA GRANDE · CATEGORIA LIVRE';
    w.saveBrandEditor();
    var torDepois = w.tFnd('t_pg_open');
    chk(torDepois && torDepois.n==='Praia Grande Open 2026','saveBrandEditor: tor.n atualizado');
    chk(torDepois && torDepois.brandSub==='PRAIA GRANDE · CATEGORIA LIVRE','saveBrandEditor: tor.brandSub atualizado');
    chk(w.document.getElementById('tnjModal')==null,'saveBrandEditor: modal fecha');

    // getBrand reflete novo brand
    var brand2=w.getBrand('pg');
    chk(brand2.title==='Praia Grande Open 2026','getBrand("pg"): title agora = brand editado');
    chk(brand2.sub==='PRAIA GRANDE · CATEGORIA LIVRE','getBrand("pg"): sub agora = brand editado');

    // renderTorneioCards reflete novo brand
    var html_f = w.renderTorneioCards(torDepois);
    chk(html_f.indexOf('Praia Grande Open 2026')>=0,'cards: header mostra novo nome');
    chk(html_f.indexOf('PRAIA GRANDE · CATEGORIA LIVRE')>=0,'cards: header mostra novo subtitulo');

    // Simular upload de logo via _brandLogoData (sem File real no jsdom)
    var prev2=w.document.getElementById('tnjModal'); if(prev2) prev2.remove();
    w.openBrandEditor();
    // Inject fake base64 image manualmente (jsdom nao tem FileReader real facil)
    w._brandLogoData='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    w.saveBrandEditor();
    var torLogoDepois = w.tFnd('t_pg_open');
    chk(torLogoDepois && torLogoDepois.brandLogoData && torLogoDepois.brandLogoData.indexOf('data:image/png')===0,'saveBrandEditor: tor.brandLogoData persistido');
    chk(w.getBrand('pg').logo===torLogoDepois.brandLogoData,'getBrand: logo agora vem do torneio (prevalece sobre PG_LOGO constante)');

    // 12. Sanity: USA continua redirecionando pra fluxo unificado (regressao B1.2)
    var dom2 = new JSDOM(htmlMod,{
      url:'https://master.associacaoscoladevoleibol.com.br/?torneio=usa',
      runScripts:'dangerously', pretendToBeVisual:true,
      beforeParse(window){window.firebaseMock=global.firebaseMock;window.AudioContext=function(){return{createOscillator:()=>({connect:()=>{},frequency:{},start:()=>{},stop:()=>{}}),createGain:()=>({connect:()=>{},gain:{}}),destination:{},currentTime:0};};window.navigator.vibrate=()=>{};}
    });
    setTimeout(()=>{
      try {
        var w2 = dom2.window;
        chk(w2.torneioMode===false,'?torneio=usa: torneioMode=false (continua redirecionando pra aba — regressao B1.2)');
        chk(w2.selTor==='t_usa_open','?torneio=usa: selTor=t_usa_open');
        console.log('\n=== '+ok+' ok, '+ko+' falhas ===');
        console.log(ko===0?'OK FASE PG APROVADA':'FAIL FASE PG REPROVADA');
        process.exit(ko===0?0:1);
      } catch(e){ console.log('ERRO INNER: '+e.message); process.exit(1); }
    },400);

  } catch(e){
    console.log('ERRO GERAL: '+e.message);
    console.log(e.stack);
    process.exit(1);
  }
},700);
