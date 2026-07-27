// Relatorio CONSOLIDADO do torneio (Rodrigo: "relatorio especifico consolidado do
// torneio Taca Mauricio Borges"). Soma todos os jogos com scout, com a mesma regua.
// Confere: agregacao consolidada (fecha), V/D + sets, ad-hoc de mesmo nome fundido
// numa linha (Regis/Robert/Andre entram avulsos em jogos diferentes -> aids diferentes),
// cadastrados NUNCA fundidos, linhas nao clicaveis, e o miolo reusado do relatorio de time.
const fs=require('fs'); const {JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const fakeDB={}; const listeners={};
function getAt(p){const a=p.split('/');let c=fakeDB;for(const k of a){if(c==null)return null;c=c[k];}return c===undefined?null:c;}
function makeRef(p){return{_path:p,on:function(e,cb){listeners[p]=cb;},once:function(){return Promise.resolve({val:()=>getAt(p)});},set:function(){return Promise.resolve();},update:function(){return Promise.resolve();}};}
global.firebaseMock={initializeApp:()=>{},database:()=>({ref:makeRef}),auth:()=>({onAuthStateChanged:function(cb){setTimeout(()=>cb({uid:'m',email:'rodrigosvolei@gmail.com',displayName:'M'}),0);},signInWithPopup:()=>Promise.resolve(),signOut:()=>Promise.resolve()})};

function A(pid,ak,oc){return {id:pid+ak+oc+Math.random(),pid:pid,ak:ak,oc:oc,set:1};}
const seed={'torneio-master-santos':{
  teams:[{id:'trs',n:'RS ADULTO',c:'#0e254c',roster:[{aid:'a1'},{aid:'a2'}]}],
  // a1 e a3 tem o MESMO nome "Ana" (cadastrados) — nao podem se fundir
  athletes:[{aid:'a1',nm:'Ana',po:'Ponteiro(a)',nu:5},{aid:'a2',nm:'Bia',po:'Central',nu:7},{aid:'a3',nm:'Ana',po:'Oposto(a)',nu:8}],
  tournaments:[{id:'tA',n:'Taça Teste'},{id:'tB',n:'Outro'}],
  games:[
    // 2 vitorias + 1 derrota; "Kaue" entra AD-HOC em 2 jogos com aids diferentes
    {id:'gW1',torId:'tA',tid:'trs',opp:'Alfa',dt:'2026-07-25',tm:'10:00',st:'done',ss:[{u:25,t:20},{u:25,t:18}],
      lineup:[{aid:'a1',nu:5},{aid:'adhoc_k1',nm:'Kaue',nu:9}],
      act:[A('a1','ataque','Ponto'),A('a1','ataque','Ponto'),A('adhoc_k1','recepcao','A')]},
    {id:'gW2',torId:'tA',tid:'trs',opp:'Beta',dt:'2026-07-25',tm:'12:00',st:'done',ss:[{u:25,t:22},{u:25,t:19}],
      lineup:[{aid:'a2',nu:7},{aid:'adhoc_k2',nm:'Kaue',nu:9}],
      act:[A('a2','bloqueio','Ponto'),A('adhoc_k2','recepcao','A')]},
    {id:'gL',torId:'tA',tid:'trs',opp:'Gama',dt:'2026-07-25',tm:'14:00',st:'done',ss:[{u:20,t:25},{u:18,t:25}],
      lineup:[{aid:'a1',nu:5}],act:[A('a1','ataque','Erro')]},
    // sem scout -> nao entra
    {id:'gVazio',torId:'tA',tid:'trs',opp:'Delta',dt:'2026-07-26',tm:'10:00',st:'pending',ss:[{u:0,t:0}],lineup:[{aid:'a1',nu:5}]},
    // de OUTRO torneio -> nao entra
    {id:'gOutro',torId:'tB',tid:'trs',opp:'Zeta',dt:'2026-07-25',tm:'09:00',st:'done',ss:[{u:25,t:10},{u:25,t:11}],lineup:[{aid:'a1',nu:5}],act:[A('a1','ataque','Ponto')]}
  ],
  invites:{}}};
Object.assign(fakeDB,JSON.parse(JSON.stringify(seed)));

const mod=html.replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>/g,'').replace('firebase.initializeApp(fc);','var firebase=window.firebaseMock; firebase.initializeApp(fc);');
const dom=new JSDOM(mod,{url:'https://master.exemplo.com.br/',runScripts:'dangerously',pretendToBeVisual:true,
  beforeParse(window){window.firebaseMock=global.firebaseMock;
    window.AudioContext=function(){return{createOscillator:()=>({connect:()=>{},frequency:{},start:()=>{},stop:()=>{}}),createGain:()=>({connect:()=>{},gain:{}}),destination:{},currentTime:0};};
    window.navigator.vibrate=()=>{};window.alert=()=>{};}});
const w=dom.window;
let ok=0,ko=0; function chk(c,m){if(c){ok++;console.log('OK   '+m);}else{ko++;console.log('FAIL '+m);}}

setTimeout(function(){
 try{
  ['teams','games','tournaments','athletes','invites'].forEach(function(k){var p='torneio-master-santos/'+k;if(listeners[p])listeners[p]({val:function(){return getAt(p);}});});
  w.currentUser={uid:'m',email:'rodrigosvolei@gmail.com'};

  chk(typeof w.reportTournamentHTML==='function' && typeof w.exTournamentReport==='function','reportTournamentHTML/exTournamentReport existem');

  // 1) _tourGames: so jogos com scout do torneio, em ordem cronologica
  var tg=w._tourGames('tA').map(function(g){return g.id;});
  chk(tg.join(',')==='gW1,gW2,gL','_tourGames(tA)=gW1,gW2,gL (exclui vazio/outro torneio, ordem cronologica) — deu '+tg.join(','));

  var h=w.reportTournamentHTML('tA');

  // 2) HERO: 2 vitorias x 1 derrota, 6 jogos? nao — 3 jogos; 4x2 sets
  chk(h.indexOf('Taça Teste')>=0,'hero mostra o nome do torneio');
  chk(/>2<\/span>[\s\S]*?×[\s\S]*?>1<\/span>/.test(h),'hero: 2 × 1 (vitorias × derrotas)');
  chk(h.indexOf('3 jogos')>=0,'hero: 3 jogos');
  chk(h.indexOf('4 × 2 sets')>=0,'hero: 4 × 2 sets (soma dos sets)');

  // 3) JOGOS DO TORNEIO: lista os 3 com resultado
  chk(/vs Alfa/.test(h)&&/vs Beta/.test(h)&&/vs Gama/.test(h),'lista os 3 jogos (Alfa/Beta/Gama)');
  chk((h.match(/gm-v">Vitória/g)||[]).length===2 && (h.match(/gm-d">Derrota/g)||[]).length===1,'2 vitorias + 1 derrota marcadas');

  // 4) CONSOLIDADO (soma): Kaue (ad-hoc em 2 jogos) vira UMA linha
  var agg=w.repAgg(null, w._consolidatePids((function(){var acts=[];w._tourGames('tA').forEach(function(g){g.act.forEach(function(a){acts.push(a);});});return acts;})(), {a1:'gW1',a2:'gW2',adhoc_k1:'gW1',adhoc_k2:'gW2'}));
  var byName={}; agg.players.forEach(function(p){var pf=w.pFind(p.pid, p.pid.indexOf('adhoc')>=0?(p.pid==='adhoc_k1'?'gW1':'gW2'):null);byName[(pf?pf.nm:p.pid)]=(byName[(pf?pf.nm:p.pid)]||0)+1;});
  chk(agg.players.length===3,'consolidado: 3 atletas (Ana, Bia, Kaue) — Kaue fundido, nao 4 — deu '+agg.players.length);
  var kaue=agg.players.filter(function(p){return p.pid==='adhoc_k1'||p.pid==='adhoc_k2';});
  chk(kaue.length===1 && kaue[0].byF.recepcao && kaue[0].byF.recepcao.o.A===2,'Kaue (ad-hoc x2) fundido: 2 recepcoes A numa linha só');

  // 5) a1 agregado pelos 2 jogos (gW1: 2 Ponto, gL: 1 Erro)
  var pa1=agg.players.filter(function(p){return p.pid==='a1';})[0];
  chk(pa1 && pa1.byF.ataque.o.Ponto===2 && pa1.byF.ataque.o.Erro===1,'a1 agregado nos 2 jogos: 2 Ponto + 1 Erro');

  // 6) team fecha: pos = 2(a1)+1(a2)+2(Kaue)=5, err=1
  chk(agg.team.pos===5 && agg.team.err===1,'team consolidado fecha: pos5 err1 (soma dos atletas) — deu pos'+agg.team.pos+' err'+agg.team.err);

  // 7) SEGURANCA: dois CADASTRADOS de mesmo nome (a1/a3 = "Ana") NAO se fundem
  var out=w._consolidatePids([A('a1','ataque','Ponto'),A('a3','ataque','Ponto'),A('adhoc_k1','recepcao','A'),A('adhoc_k2','recepcao','A')], {a1:'gW1',a3:'gW1',adhoc_k1:'gW1',adhoc_k2:'gW2'});
  var pidsOut={}; out.forEach(function(a){pidsOut[a.pid]=1;});
  chk(pidsOut['a1'] && pidsOut['a3'],'cadastrados de mesmo nome (a1/a3 "Ana") NAO se fundem (seguranca)');
  chk(!pidsOut['adhoc_k2'] && pidsOut['adhoc_k1'],'ad-hoc de mesmo nome (Kaue) fundem no primeiro id');

  // 8) linhas NAO clicaveis no consolidado (nao ha 1 jogo so pra abrir o individual)
  chk(h.indexOf('exPlayerReport')<0,'consolidado: linhas do atleta NAO clicaveis (sem exPlayerReport)');
  chk(h.indexOf('no torneio')>=0,'KPI/rotulos dizem "no torneio" (escopo torneio)');

  // 9) markup fechado (nao engole secao no PDF)
  chk(((h.match(/<div/g)||[]).length-(h.match(/<\/div>/g)||[]).length)===0,'divs balanceadas');

  // 10) reportTeamHTML (1 jogo) intacto apos o refactor do miolo
  chk(w.reportTeamHTML(w.gF('gW1')).indexOf('exPlayerReport')>=0,'relatorio de UM jogo continua com atleta clicavel (refactor nao quebrou)');

  console.log('\n=== test_relatorio_torneio: '+ok+' OK, '+ko+' FAIL ===');
  process.exit(ko>0?1:0);
 }catch(e){console.log('FAIL exception:',e.message);console.log((e.stack||'').split('\n').slice(0,6).join('\n'));process.exit(1);}
},250);
