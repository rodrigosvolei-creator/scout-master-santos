const fs=require('fs');const {JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const fakeDB={};const listeners={};
function getAt(p){const a=p.split('/');let c=fakeDB;for(const x of a){if(c==null)return null;c=c[x];}return c===undefined?null:c;}
function setAt(p,v){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}c[a[a.length-1]]=JSON.parse(JSON.stringify(v));}
function makeRef(p){return{on:(e,cb)=>{listeners[p]=cb;},once:()=>Promise.resolve({val:()=>getAt(p)}),set:v=>{setAt(p,v);return Promise.resolve();},update:()=>Promise.resolve()};}
global.firebaseMock={initializeApp:()=>{},database:()=>({ref:makeRef}),auth:()=>({onAuthStateChanged:cb=>setTimeout(()=>cb(null),0),signInWithPopup:()=>Promise.resolve(),signOut:()=>Promise.resolve()})};
const seed={'torneio-master-santos':{teams:[{id:'trs_adulto',n:'RS-VOLEIBOL ADULTO MASCULINO',c:'#2563eb',roster:[{aid:'a1'}]}],athletes:[{aid:'a1',nm:'Mateus'}],tournaments:[{id:'t_usa_open',n:'USA Open',c:'#1d7a3a'}],games:[
  {id:'g1',torId:'t_usa_open',tid:'trs_adulto',opp:'Arlington Empire',dt:'2026-05-22',tm:'10:00',st:'live',ss:[{u:5,t:3}],act:[{id:'x',pid:'a1',ak:'saque',oc:'Ace',set:1}],lineup:[{aid:'a1',nu:1}]},
  {id:'g2',torId:'t_usa_open',tid:'trs_adulto',opp:'Erro Que Quero Apagar',dt:'2026-05-22',tm:'11:00',st:'pending',lineup:[{aid:'a1',nu:1}]}
],invites:{}}};
Object.assign(fakeDB,JSON.parse(JSON.stringify(seed)));
let htmlMod=html.replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>/g,'').replace('firebase.initializeApp(fc);','var firebase=window.firebaseMock; firebase.initializeApp(fc);');
const dom=new JSDOM(htmlMod,{url:'https://master.associacaoscoladevoleibol.com.br/?torneio=usa',runScripts:'dangerously',pretendToBeVisual:true,beforeParse(window){window.firebaseMock=global.firebaseMock;window.AudioContext=function(){return{createOscillator:()=>({connect:()=>{},frequency:{},start:()=>{},stop:()=>{}}),createGain:()=>({connect:()=>{},gain:{}}),destination:{},currentTime:0};};window.navigator.vibrate=()=>{};window.alert=()=>{};window.URL.createObjectURL=()=>'blob:x';window.URL.revokeObjectURL=()=>{};}});
const w=dom.window;
setTimeout(()=>{
 try{
  ['teams','games','tournaments','athletes','invites'].forEach(k=>{const p='torneio-master-santos/'+k;if(listeners[p])listeners[p]({val:()=>getAt(p)});});
  w.torneioUnlocked=true;
  let pass=0,fail=0;function ck(n,c){if(c){pass++;console.log('✅ '+n);}else{fail++;console.log('❌ '+n);}}

  console.log('=== PDF disponivel com jogo AO VIVO ===');
  w.isScouter=true;w.openTorneioGame('g1');w.startG();
  ck('botao PDF Partida aparece com jogo ao vivo+dados', w.rSct().indexOf('PDF Partida')>=0);

  console.log('\n=== card tem botao excluir ===');
  ck('card tem botao de excluir', w.renderTorneioCards({n:'USA Open'}).indexOf('excluirTorneioJogo')>=0);

  console.log('\n=== EXCLUIR sem senha pede admin ===');
  w.torneioAdminUnlocked=false;
  w.excluirTorneioJogo('g2');
  ck('excluir sem senha abre gate de admin', (w.document.getElementById('tnjModal')||{}).innerHTML.indexOf('RESTRITA')>=0);
  // senha errada
  w.document.getElementById('tnj-admin-pwd').value='xxx';
  w.checkTorneioAdminPwd();
  ck('senha errada nao destrava', w.torneioAdminUnlocked===false);
  // senha certa -> apos o gate, deve abrir confirmacao de exclusao do g2
  w.document.getElementById('tnj-admin-pwd').value='rsadmin2026';
  w.checkTorneioAdminPwd();
  var m=w.document.getElementById('tnjModal');
  ck('apos senha certa abre confirmacao de exclusao', m && m.innerHTML.indexOf('EXCLUIR JOGO')>=0);
  ck('confirmacao mostra o nome do jogo', m && m.innerHTML.indexOf('Erro Que Quero Apagar')>=0);

  console.log('\n=== confirmar exclusao ===');
  var nAntes=w.D.games.length;
  w.confirmarExclusaoTorneioJogo('g2');
  ck('jogo g2 excluido (D.games -1)', w.D.games.length===nAntes-1);
  ck('g2 nao existe mais', !w.D.games.some(function(x){return x.id==='g2';}));
  ck('g1 (com dados) preservado', w.D.games.some(function(x){return x.id==='g1';}));
  ck('exclusao gravada no banco', (function(){var sv=getAt('torneio-master-santos/games');return Array.isArray(sv)&&!sv.some(function(x){return x&&x.id==='g2';});})());

  console.log('\n=== aviso de perda de dados (admin ja destravado) ===');
  // agora admin ja esta destravado, excluir g1 direto abre a confirmacao
  w.excluirTorneioJogo('g1');
  var m3=w.document.getElementById('tnjModal');
  ck('excluir jogo com acoes avisa sobre perda de dados', m3 && m3.innerHTML.indexOf('de scout')>=0);
  w.closeTorneioModal();

  console.log('\n'+pass+' ok, '+fail+' falhas');
  console.log(fail===0?'✅✅✅ EXCLUIR + PDF APROVADO':'❌ REPROVADO');
  process.exit(fail===0?0:1);
 }catch(e){console.log('❌ ERRO:',e.message);console.log(e.stack);process.exit(1);}
},600);
