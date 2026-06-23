const fs=require('fs');const {JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const fakeDB={};const listeners={};
function getAt(p){const a=p.split('/');let c=fakeDB;for(const x of a){if(c==null)return null;c=c[x];}return c===undefined?null:c;}
function setAt(p,v){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}c[a[a.length-1]]=JSON.parse(JSON.stringify(v));}
function makeRef(p){return{on:(e,cb)=>{listeners[p]=cb;},once:()=>Promise.resolve({val:()=>getAt(p)}),set:v=>{setAt(p,v);return Promise.resolve();},update:()=>Promise.resolve()};}
global.firebaseMock={initializeApp:()=>{},database:()=>({ref:makeRef}),auth:()=>({onAuthStateChanged:cb=>setTimeout(()=>cb({uid:'tester',email:'rodrigosvolei@gmail.com',displayName:'Tester'}),0),signInWithPopup:()=>Promise.resolve(),signOut:()=>Promise.resolve()})};

// Acoes de teste — numeros propositalmente conhecidos para conferir a matematica:
// MARINA (a1): ataque 10 Ponto + 3 Erro (13 acoes) -> Ef = (10-3)/13 = 53.8 -> 54%
//              recepcao 8 A + 1 Erro (9 acoes)     -> Apr = 8/9 = 88.9 -> 89%  (>=70 => good no passe)
//              ...mas ataque Ef 54 (>=50) tambem good -> veredito GOOD
// JULIA (a2):  ataque 1 Ponto + 5 Erro (6) -> Ef = (1-5)/6 = -66.7 -> -67% (negativo) => veredito BAD
// Tudo no set 1. Set 2 tem so a JULIA com 1 erro de recepcao, pra testar o filtro de set.
function act(pid,ak,oc,set){return {id:'x'+Math.random(),pid:pid,ak:ak,oc:oc,set:set};}
const acts=[];
for(let i=0;i<10;i++)acts.push(act('a1','ataque','Ponto',1));
for(let i=0;i<3;i++)acts.push(act('a1','ataque','Erro',1));
for(let i=0;i<8;i++)acts.push(act('a1','recepcao','A',1));
acts.push(act('a1','recepcao','Erro',1));
for(let i=0;i<1;i++)acts.push(act('a2','ataque','Ponto',1));
for(let i=0;i<5;i++)acts.push(act('a2','ataque','Erro',1));
acts.push(act('a2','recepcao','Erro',2)); // set 2

const seed={'torneio-master-santos':{
  teams:[{id:'trs_adulto',n:'RS-VOLEIBOL ADULTO MASCULINO',c:'#2563eb',roster:[{aid:'a1'},{aid:'a2'}]}],
  athletes:[{aid:'a1',nm:'Marina Souza'},{aid:'a2',nm:'Julia Lima'}],
  tournaments:[{id:'t_usa_open',n:'2026 Adult Open Championship',c:'#1d7a3a'}],
  games:[
    {id:'g1',torId:'t_usa_open',tid:'trs_adulto',opp:'Thunder VB',dt:'2026-05-22',tm:'10:00',st:'live',
     ss:[{u:14,t:11},{u:3,t:2}],act:acts,lineup:[{aid:'a1',nu:12},{aid:'a2',nu:7}]}
  ],
  invites:{}}};
Object.assign(fakeDB,JSON.parse(JSON.stringify(seed)));
let htmlMod=html.replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>/g,'').replace('firebase.initializeApp(fc);','var firebase=window.firebaseMock; firebase.initializeApp(fc);');
const dom=new JSDOM(htmlMod,{url:'https://master.associacaoscoladevoleibol.com.br/?torneio=usa',runScripts:'dangerously',pretendToBeVisual:true,beforeParse(window){
  window.firebaseMock=global.firebaseMock;
  window.AudioContext=function(){return{createOscillator:()=>({connect:()=>{},frequency:{},start:()=>{},stop:()=>{}}),createGain:()=>({connect:()=>{},gain:{}}),destination:{},currentTime:0};};
  window.navigator.vibrate=()=>{};
}});
const w=dom.window;
setTimeout(()=>{
 try{
  ['teams','games','tournaments','athletes','invites'].forEach(k=>{const p='torneio-master-santos/'+k;if(listeners[p])listeners[p]({val:()=>getAt(p)});});
  let pass=0,fail=0;function ck(n,c){if(c){pass++;console.log('✅ '+n);}else{fail++;console.log('❌ '+n+'  <-- FALHOU');}}

  const gm=w.gF('g1');
  ck('jogo de teste carregado', !!(gm && gm.act && gm.act.length===29));

  // ===== ETAPA 1: livePanelStats existe =====
  ck('livePanelStats definida', typeof w.livePanelStats==='function');

  // ===== ETAPA 2: SET ATUAL (set 2 e o ultimo set) =====
  // No set 2 so existe 1 acao: recepcao Erro da Julia.
  const sSet=w.livePanelStats(gm,'set',2);
  ck('set atual: ataque sem acoes -> eficiencia null', sSet.team.atkEff===null);
  ck('set atual: passe 0% (1 erro, 0 bons)', sSet.team.recApr===0);
  ck('set atual: 1 erro nao-forcado', sSet.team.errAll===1);
  ck('set atual: 1 atleta com acoes (Julia)', sSet.players.length===1);

  // ===== ETAPA 3: JOGO TODO — a matematica do caso descrito =====
  const sGame=w.livePanelStats(gm,'game',2);
  // Time: ataques totais = 10+3 (Marina) + 1+5 (Julia) = 19 ; Pontos=11 Erros=8 -> (11-8)/19 = 15.8 -> 16%
  ck('jogo: efic. ataque do time = 16%', sGame.team.atkEff===16);
  // Recepcao: 8 A + 1 erro (Marina) + 1 erro (Julia) = 10 ; bons=8 -> 80%
  ck('jogo: aprov. passe do time = 80%', sGame.team.recApr===80);
  // Erros totais: ataque 3+5 + recepcao 1+1 = 10
  ck('jogo: erros nao-forcados = 10', sGame.team.errAll===10);
  ck('jogo: 2 atletas com acoes', sGame.players.length===2);

  // ===== ETAPA 4: por atleta — Marina (#12) =====
  const marina=sGame.players.find(p=>p.pid==='a1');
  ck('Marina: 10 ataques-ponto', marina.atkPt===10);
  ck('Marina: 3 erros de ataque', marina.atkErr===3);
  ck('Marina: eficiencia ataque = 54%', marina.atkEff===54);
  ck('Marina: 8 passes bons (A+B)', marina.recGood===8);
  ck('Marina: aproveitamento passe = 89%', marina.recApr===89);
  ck('Marina: veredito GOOD (ef 54 e passe 89)', marina.verdict==='good');

  // ===== ETAPA 5: por atleta — Julia (#7), candidata a troca =====
  const julia=sGame.players.find(p=>p.pid==='a2');
  ck('Julia: eficiencia ataque negativa (-67%)', julia.atkEff===-67);
  ck('Julia: veredito BAD (ataque negativo)', julia.verdict==='bad');

  // ===== ETAPA 6: ordenacao por volume =====
  // Marina tem 23 acoes, Julia 6 -> Marina primeiro
  ck('atletas ordenados por volume (Marina 1o)', sGame.players[0].pid==='a1');

  // ===== ETAPA 7: render do painel no DOM =====
  let eRender=null;
  try{ w.openLivePanel('g1'); }catch(e){eRender=e;}
  ck('openLivePanel sem erro', !eRender);
  let ov=w.document.getElementById('_livePanel');
  ck('overlay do painel inserido no DOM', ov!=null);
  ck('painel tem marca dagua RS (--rs-watermark)', ov && ov.innerHTML.indexOf('--rs-watermark')>=0);
  ck('painel mostra os 3 KPIs do termometro', ov && ov.querySelectorAll('.lv-kpi').length===3);
  ck('painel tem toggle set/jogo', ov && ov.querySelectorAll('.lv-tbtn').length===2);
  // o painel abre no SET ATUAL (set 2) — so a Julia tem acoes nele
  ck('abre no set atual: 1 card de atleta', ov && ov.querySelectorAll('.lv-card').length===1);

  // ===== ETAPA 8: toggle de escopo para JOGO TODO =====
  let eTgl=null;
  try{ w.setLivePanelScope('game'); }catch(e){eTgl=e;}
  ck('setLivePanelScope sem erro', !eTgl);
  ov=w.document.getElementById('_livePanel');
  ck('apos toggle, painel ainda no DOM', ov!=null);
  ck('toggle JOGO TODO fica ativo', ov && ov.querySelectorAll('.lv-tbtn.on').length===1 && ov.querySelectorAll('.lv-tbtn')[1].className.indexOf('on')>=0);
  ck('jogo todo: 2 cards de atleta', ov && ov.querySelectorAll('.lv-card').length===2);
  ck('jogo todo: mostra nome do atleta (Marina)', ov && ov.innerHTML.indexOf('Marina')>=0);
  ck('jogo todo: mostra numero da camisa (12)', ov && ov.innerHTML.indexOf('>12<')>=0);
  ck('jogo todo: marca candidato a troca (ATENÇÃO)', ov && ov.innerHTML.indexOf('ATEN')>=0);
  const od=(ov.innerHTML.match(/<div/g)||[]).length, ofz=(ov.innerHTML.match(/<\/div>/g)||[]).length;
  ck('painel: divs balanceadas ('+od+'/'+ofz+')', od===ofz);

  // ===== ETAPA 9: fechar =====
  w.closeLivePanel();
  ck('closeLivePanel remove o overlay', w.document.getElementById('_livePanel')==null);

  // ===== ETAPA 10: jogo sem acoes nao quebra =====
  let eEmpty=null;
  try{ const empty=w.livePanelStats({act:[]},'game',1); ck('jogo vazio: efic null, 0 erros', empty.team.atkEff===null && empty.team.errAll===0 && empty.players.length===0); }
  catch(e){eEmpty=e; ck('jogo vazio nao quebra', false); }

  console.log('\n=== '+pass+' ok, '+fail+' falhas ===');
  console.log(fail===0?'✅✅✅ PAINEL AO VIVO APROVADO':'❌ PAINEL REPROVADO');
  process.exit(fail===0?0:1);
 }catch(err){
  console.log('❌ ERRO FATAL NO TESTE: '+err.message);
  console.log(err.stack);
  process.exit(1);
 }
},400);
