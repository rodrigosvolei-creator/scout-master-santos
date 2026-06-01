// Fase C — torneio encerrado / historico.
// Asserta:
//   1. Helpers isArchivedTor, canEditTorneioGames, toggleTorneioArchived existem
//   2. rTor lista torneios arquivados em grupo "Encerrados / Histórico"
//   3. Card arquivado tem classe is-archived e badge ENCERRADO
//   4. rTorDetail de arquivado mostra badge + botao Reativar (admin)
//   5. Em arquivado: NAO mostra Novo Jogo, NAO mostra gd-edit/gd-del
//   6. Funcoes admin (openTorneioNovoJogo/Editar/Excluir) recusam em torneio arquivado
//   7. toggleTorneioArchived flipa o estado e persiste
//   8. Em torneio NAO arquivado: tudo segue normal (regressao)
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');

const fakeDB = {};
const listeners = {};
function getAt(p){const a=p.split('/');let c=fakeDB;for(const k of a){if(c==null)return null;c=c[k];}return c===undefined?null:c;}
function setAt(p,v){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}c[a[a.length-1]]=JSON.parse(JSON.stringify(v));}
function makeRef(p){return{_path:p,on:function(e,cb){listeners[p]=cb;},once:function(){return Promise.resolve({val:()=>getAt(p)});},set:function(v){setAt(p,v);return Promise.resolve();},update:function(){return Promise.resolve();}};}
global.firebaseMock={initializeApp:()=>{},database:()=>({ref:makeRef}),auth:()=>({onAuthStateChanged:function(cb){setTimeout(()=>cb(null),0);},signInWithPopup:()=>Promise.resolve(),signOut:()=>Promise.resolve()})};

// 2 torneios: t_arch_test encerrado (archived=true), Liga ativa.
// (NAO usar t_usa_open aqui porque isSpecialTour filtra todos torneios do
// TOURNEY_ACCESS — USA some completamente do app principal, igual o PG.)
const seed = {
  'torneio-master-santos': {
    teams:[{id:'trs',n:'RS Adulto Masc',c:'#2563eb',roster:[{aid:'a1'}]}],
    athletes:[{aid:'a1',nm:'Atleta 1',po:'Ponta'}],
    tournaments:[
      {id:'t_arch_test',n:'Torneio Encerrado Teste',c:'#1d7a3a',color:'#1d7a3a',cat:'Adulto',season:'2026',archived:true},
      {id:'t_liga',n:'Liga Ativa',c:'#2563eb',color:'#2563eb',cat:'Adulto',season:'2026'}
    ],
    games:[
      {id:'g_usa_1',torId:'t_arch_test',tid:'trs',opp:'Arlington',dt:'2026-06-10',tm:'10:00',st:'pending',lineup:[{aid:'a1',nu:1}]},
      {id:'g_liga_1',torId:'t_liga',tid:'trs',opp:'Time A',dt:'2026-07-10',tm:'10:00',st:'pending',lineup:[{aid:'a1',nu:1}]}
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

    // 1. Helpers existem
    chk(typeof w.isArchivedTor==='function','isArchivedTor() helper existe');
    chk(typeof w.canEditTorneioGames==='function','canEditTorneioGames() helper existe');
    chk(typeof w.toggleTorneioArchived==='function','toggleTorneioArchived() helper existe');

    // 2. Comportamento dos helpers
    var torUsa = w.tFnd('t_arch_test');
    var torLiga = w.tFnd('t_liga');
    chk(w.isArchivedTor(torUsa)===true,'isArchivedTor: torneio com archived=true => true');
    chk(w.isArchivedTor(torLiga)===false,'isArchivedTor: torneio sem flag => false');
    chk(w.isArchivedTor(null)===false,'isArchivedTor(null) = false (defensivo)');

    w.isAdmin=true; w.isCoord=false; w.torneioMode=false;
    chk(w.canEditTorneioGames(torLiga)===true,'canEditTorneioGames: admin + ativo = true');
    chk(w.canEditTorneioGames(torUsa)===false,'canEditTorneioGames: admin + arquivado = false');

    // 3. Boot na aba Torneios — listagem mostra dois grupos: ativos e encerrados
    w.showLanding=false; w.signupMode=false; w.torneioMode=false;
    w.tab='torneios'; w.selTor=null; w.render();
    var main = w.document.getElementById('mainApp').innerHTML;
    chk(main.indexOf('Encerrados / Histórico')>=0,'rTor: grupo "Encerrados / Histórico" presente');
    chk(main.indexOf('rs-tor-card is-archived')>=0,'rTor: card USA tem classe is-archived');
    chk(main.indexOf('rs-tor-archived-badge')>=0,'rTor: card arquivado tem badge ENCERRADO');
    // Os 2 torneios estao em grupos diferentes: 1 em "Em andamento"/"Programados" e 1 em "Encerrados"
    var groupCount = (main.match(/rs-tor-group-title/g)||[]).length;
    chk(groupCount===2,'rTor: 2 grupos (1 ativo + 1 encerrado): '+groupCount);

    // 4. Selecionar o USA (arquivado) — detalhe deve mostrar badge encerrado + botao Reativar
    w.selectTor('t_arch_test');
    var m1 = w.document.getElementById('mainApp').innerHTML;
    chk(m1.indexOf('rs-tor-detail is-archived')>=0,'rTorDetail USA tem classe is-archived');
    chk(m1.indexOf('rs-tor-detail-archived-badge')>=0,'rTorDetail USA mostra badge ENCERRADO');
    chk(m1.indexOf('Reativar')>=0,'rTorDetail USA mostra botao Reativar (admin)');
    chk(m1.indexOf('toggleTorneioArchived')>=0,'rTorDetail USA: onclick chama toggleTorneioArchived');

    // 5. Em arquivado: NAO mostra Novo Jogo, NAO mostra gd-edit/gd-del
    chk(m1.indexOf('➕ Novo Jogo')<0 && m1.indexOf('+ Novo Jogo')<0,'arquivado: SEM botao Novo Jogo');
    chk(m1.indexOf('gd-edit')<0,'arquivado: SEM botao gd-edit');
    chk(m1.indexOf('gd-del')<0,'arquivado: SEM botao gd-del');

    // 6. Selecionar a Liga (NAO arquivada) — botoes admin voltam (regressao)
    w.selectTor('t_liga');
    var m2 = w.document.getElementById('mainApp').innerHTML;
    chk(m2.indexOf('rs-tor-detail-archived-badge')<0,'rTorDetail Liga (ativa): SEM badge encerrado');
    chk(m2.indexOf('📦 Encerrar')>=0 || m2.indexOf('Encerrar')>=0,'rTorDetail Liga: mostra botao Encerrar (admin)');
    // Liga eh default layout (sem gameday): nao testa gd-edit aqui, mas o Novo Jogo direto via rTorDetail estaria visivel via openGameEditor
    chk(m2.indexOf('Novo Jogo neste Torneio')>=0,'rTorDetail Liga ativa: botao Novo Jogo (default layout)');

    // 7. Funcoes admin recusam em torneio arquivado (defense-in-depth)
    w.selectTor('t_arch_test'); // contexto = USA arquivado
    // Captura toasts pra inspecionar mensagens (sem depender da UI real)
    var toasts=[];
    w.toast = function(msg,kind){ toasts.push({msg:msg,kind:kind}); };

    // Limpa modal previo
    var prev = w.document.getElementById('tnjModal'); if(prev) prev.remove();
    var gamesAntes = w.D.games.length;
    w.openTorneioNovoJogo();
    chk(w.document.getElementById('tnjModal')==null,'openTorneioNovoJogo arquivado: NAO abre modal');
    chk(toasts.some(function(t){return /encerrado/i.test(t.msg);}),'openTorneioNovoJogo arquivado: toast com "encerrado"');
    chk(w.D.games.length===gamesAntes,'openTorneioNovoJogo arquivado: nenhum jogo criado');

    // Editar tambem recusa
    toasts.length=0;
    w.openTorneioEditarJogo('g_usa_1');
    chk(w.document.getElementById('tnjModal')==null,'openTorneioEditarJogo arquivado: NAO abre modal');
    chk(toasts.some(function(t){return /encerrado/i.test(t.msg);}),'openTorneioEditarJogo arquivado: toast com "encerrado"');

    // Excluir tambem recusa
    toasts.length=0;
    w.excluirTorneioJogo('g_usa_1');
    chk(w.gF('g_usa_1')!=null,'excluirTorneioJogo arquivado: jogo NAO foi excluido');
    chk(toasts.some(function(t){return /encerrado/i.test(t.msg);}),'excluirTorneioJogo arquivado: toast com "encerrado"');

    // 8. toggleTorneioArchived flipa o estado
    w.toggleTorneioArchived('t_arch_test');
    chk(w.tFnd('t_arch_test').archived===false,'toggleTorneioArchived: torneio arquivado => ativo (false)');
    w.toggleTorneioArchived('t_arch_test');
    chk(w.tFnd('t_arch_test').archived===true,'toggleTorneioArchived: ativo => arquivado (true) novamente');

    // 9. Sem permissao: toggle nao funciona
    w.isAdmin=false; w.isCoord=false; toasts.length=0;
    var stAntes = w.tFnd('t_liga').archived;
    w.toggleTorneioArchived('t_liga');
    chk(w.tFnd('t_liga').archived===stAntes,'toggleTorneioArchived sem papel: NAO muda estado');
    chk(toasts.length>0,'toggleTorneioArchived sem papel: emite toast');

    // 10. CSS tem as regras Fase C
    var css = htmlMod.match(/<style>([\s\S]*?)<\/style>/)[1];
    chk(css.indexOf('.rs-tor-card.is-archived')>=0,'CSS: .rs-tor-card.is-archived');
    chk(css.indexOf('.rs-tor-archived-badge')>=0,'CSS: .rs-tor-archived-badge');
    chk(css.indexOf('.rs-tor-detail-archived-badge')>=0,'CSS: .rs-tor-detail-archived-badge');
    chk(css.indexOf('.rs-tor-detail.is-archived')>=0,'CSS: .rs-tor-detail.is-archived');

    console.log('\n=== '+ok+' ok, '+ko+' falhas ===');
    console.log(ko===0?'OK FASE C APROVADA':'FAIL FASE C REPROVADA');
    process.exit(ko===0?0:1);
  } catch(e){
    console.log('ERRO GERAL: '+e.message);
    console.log(e.stack);
    process.exit(1);
  }
},700);
