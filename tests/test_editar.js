const fs=require('fs');const {JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const fakeDB={};const listeners={};
function getAt(p){const a=p.split('/');let c=fakeDB;for(const x of a){if(c==null)return null;c=c[x];}return c===undefined?null:c;}
function setAt(p,v){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}c[a[a.length-1]]=JSON.parse(JSON.stringify(v));}
function makeRef(p){return{on:(e,cb)=>{listeners[p]=cb;},once:()=>Promise.resolve({val:()=>getAt(p)}),set:v=>{setAt(p,v);return Promise.resolve();},update:()=>Promise.resolve()};}
global.firebaseMock={initializeApp:()=>{},database:()=>({ref:makeRef}),auth:()=>({onAuthStateChanged:cb=>setTimeout(()=>cb({uid:'tester',email:'rodrigosvolei@gmail.com',displayName:'Tester'}),0),signInWithPopup:()=>Promise.resolve(),signOut:()=>Promise.resolve()})};

const seed={'torneio-master-santos':{
  teams:[{id:'trs_adulto',n:'RS-VOLEIBOL ADULTO MASCULINO',c:'#2563eb',roster:[{aid:'a1'}]}],
  athletes:[{aid:'a1',nm:'Mateus'}],
  tournaments:[{id:'t_usa_open',n:'2026 Adult Open Championship',c:'#1d7a3a'}],
  games:[
    {id:'gp',torId:'t_usa_open',tid:'trs_adulto',opp:'Old Name',dt:'2026-05-30',tm:'10:00',
     phase:'Fase de Classificação',maxSets:3,st:'pending',act:[],ss:[],lineup:[{aid:'a1',nu:1}]},
    {id:'gl',torId:'t_usa_open',tid:'trs_adulto',opp:'Live Team',dt:'2026-05-22',tm:'11:00',
     st:'live',maxSets:3,ss:[{u:5,t:3}],act:[{id:'a',pid:'a1',ak:'saque',oc:'Ace',set:1}],lineup:[{aid:'a1',nu:1}]},
    {id:'gd',torId:'t_usa_open',tid:'trs_adulto',opp:'Done Team',dt:'2026-05-20',tm:'09:00',
     st:'done',maxSets:3,ss:[{u:25,t:20}],act:[],lineup:[{aid:'a1',nu:1}]}
  ],
  invites:{}}};
Object.assign(fakeDB,JSON.parse(JSON.stringify(seed)));
let htmlMod=html.replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>/g,'').replace('firebase.initializeApp(fc);','var firebase=window.firebaseMock; firebase.initializeApp(fc);');
const dom=new JSDOM(htmlMod,{url:'https://master.associacaoscoladevoleibol.com.br/?torneio=usa',runScripts:'dangerously',pretendToBeVisual:true,beforeParse(window){
  window.firebaseMock=global.firebaseMock;
  window.AudioContext=function(){return{createOscillator:()=>({connect:()=>{},frequency:{},start:()=>{},stop:()=>{}}),createGain:()=>({connect:()=>{},gain:{}}),destination:{},currentTime:0};};
  window.navigator.vibrate=()=>{};
  window.alert=()=>{};
}});
const w=dom.window;
setTimeout(()=>{
 try{
  ['teams','games','tournaments','athletes','invites'].forEach(k=>{const p='torneio-master-santos/'+k;if(listeners[p])listeners[p]({val:()=>getAt(p)});});
  // Fase B1.2 shim: restaurar estado legado (URL parser nao seta mais).
  w.torneioMode=true; w.torneioId='t_usa_open'; w.torneioToken='usa';
  let pass=0,fail=0;function ck(n,c){if(c){pass++;console.log('✅ '+n);}else{fail++;console.log('❌ '+n+'  <-- FALHOU');}}

  ck('funcao openTorneioEditarJogo existe', typeof w.openTorneioEditarJogo==='function');
  ck('funcao cancelTorneioModal existe', typeof w.cancelTorneioModal==='function');

  // ===== BOTAO NO CARD =====
  var cards=w.renderTorneioCards({n:'2026 Adult Open Championship'});
  var cont=w.document.createElement('div');cont.innerHTML=cards;
  // jogo pendente (gp) deve ter botao editar; live (gl) e done (gd) nao
  var gpCard=Array.from(cont.querySelectorAll('.gd-card')).find(c=>c.getAttribute('onclick').indexOf('gp')>=0);
  var glCard=Array.from(cont.querySelectorAll('.gd-card')).find(c=>c.getAttribute('onclick').indexOf('gl')>=0);
  var gdCard=Array.from(cont.querySelectorAll('.gd-card')).find(c=>c.getAttribute('onclick').indexOf('gd')>=0);
  ck('card pendente tem botao .gd-edit', gpCard && gpCard.querySelector('.gd-edit')!=null);
  ck('card AO VIVO nao tem botao editar', glCard && glCard.querySelector('.gd-edit')==null);
  ck('card FINALIZADO nao tem botao editar', gdCard && gdCard.querySelector('.gd-edit')==null);
  ck('botao editar chama openTorneioEditarJogo', cards.indexOf("openTorneioEditarJogo('gp')")>=0);

  // ===== EDICAO BLOQUEADA PARA LIVE/DONE =====
  w.torneioAdminUnlocked=true; // admin ja logado
  w.openTorneioEditarJogo('gl');
  ck('editar jogo AO VIVO nao abre modal', w.document.getElementById('tnjModal')==null);
  w.openTorneioEditarJogo('gd');
  ck('editar jogo FINALIZADO nao abre modal', w.document.getElementById('tnjModal')==null);

  // ===== EDICAO DE JOGO PENDENTE — abre e pre-preenche =====
  w.openTorneioEditarJogo('gp');
  var modal=w.document.getElementById('tnjModal');
  ck('editar jogo pendente abre o modal', modal!=null);
  ck('modal em modo edicao (titulo EDITAR JOGO)', modal && modal.innerHTML.indexOf('EDITAR JOGO')>=0);
  ck('botao salvar diz Salvar Alteracoes', modal && modal.innerHTML.indexOf('Salvar Altera')>=0);
  var oppI=w.document.getElementById('tnj-opp');
  var dtI=w.document.getElementById('tnj-dt');
  var tmI=w.document.getElementById('tnj-tm');
  ck('campo adversario pre-preenchido (Old Name)', oppI && oppI.value==='Old Name');
  ck('campo data pre-preenchido', dtI && dtI.value==='2026-05-30');
  ck('campo horario pre-preenchido', tmI && tmI.value==='10:00');

  // ===== SALVAR ALTERACOES =====
  oppI.value='New Rivals';
  dtI.value='2026-06-15';
  tmI.value='16:30';
  var phI=w.document.getElementById('tnj-phase'); if(phI)phI.value='Semifinal';
  var fmI=w.document.getElementById('tnj-fmt'); if(fmI)fmI.value='5';
  w.salvarTorneioJogo();
  var gp=w.gF('gp');
  ck('apos salvar: adversario atualizado', gp && gp.opp==='New Rivals');
  ck('apos salvar: data atualizada', gp && gp.dt==='2026-06-15');
  ck('apos salvar: horario atualizado', gp && gp.tm==='16:30');
  ck('apos salvar: fase atualizada', gp && gp.phase==='Semifinal');
  ck('apos salvar: formato atualizado (5 sets)', gp && gp.maxSets===5);
  ck('apos salvar: id do jogo NAO mudou', gp && gp.id==='gp');
  ck('apos salvar: status continua pending', gp && gp.st==='pending');
  ck('apos salvar: nenhum jogo duplicado (3 jogos)', w.D.games.filter(g=>g.torId==='t_usa_open').length===3);
  ck('apos salvar: modal fechado', w.document.getElementById('tnjModal')==null);

  // ===== CANCELAR LIMPA O ESTADO DE EDICAO =====
  w.openTorneioEditarJogo('gp');
  ck('reabriu modal de edicao', w.document.getElementById('tnjModal')!=null);
  w.cancelTorneioModal();
  ck('cancelar fecha o modal', w.document.getElementById('tnjModal')==null);
  // apos cancelar, criar um jogo novo nao deve cair em modo edicao
  w.openTorneioNovoJogo();
  var m2=w.document.getElementById('tnjModal');
  ck('apos cancelar, NOVO JOGO abre em modo criar', m2 && m2.innerHTML.indexOf('NOVO JOGO')>=0 && m2.innerHTML.indexOf('Criar Jogo')>=0);
  w.cancelTorneioModal();

  console.log('\n=== '+pass+' ok, '+fail+' falhas ===');
  console.log(fail===0?'✅✅✅ EDITAR JOGO APROVADO':'❌ EDITAR REPROVADO');
  process.exit(fail===0?0:1);
 }catch(err){
  console.log('❌ ERRO FATAL: '+err.message);console.log(err.stack);process.exit(1);
 }
},400);
