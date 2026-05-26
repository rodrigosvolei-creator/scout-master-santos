const fs=require('fs');const {JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const fakeDB={};const listeners={};
function getAt(p){const a=p.split('/');let c=fakeDB;for(const x of a){if(c==null)return null;c=c[x];}return c===undefined?null:c;}
function setAt(p,v){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}c[a[a.length-1]]=JSON.parse(JSON.stringify(v));}
function makeRef(p){return{on:(e,cb)=>{listeners[p]=cb;},once:()=>Promise.resolve({val:()=>getAt(p)}),set:v=>{setAt(p,v);return Promise.resolve();},update:()=>Promise.resolve()};}
global.firebaseMock={initializeApp:()=>{},database:()=>({ref:makeRef}),auth:()=>({onAuthStateChanged:cb=>setTimeout(()=>cb(null),0),signInWithPopup:()=>Promise.resolve(),signOut:()=>Promise.resolve()})};
const seed={'torneio-master-santos':{
  teams:[{id:'trs_adulto',n:'RS-VOLEIBOL ADULTO MASCULINO',c:'#2563eb',roster:[{aid:'a1'},{aid:'a2'}]}],
  athletes:[{aid:'a1',nm:'Mateus Passaro'},{aid:'a2',nm:'Hugo Satoshi'}],
  tournaments:[{id:'t_usa_open',n:'2026 Adult Open Championship',c:'#1d7a3a'}],
  games:[{id:'g1',torId:'t_usa_open',tid:'trs_adulto',opp:'Arlington Empire',dt:'2026-05-22',tm:'10:00',st:'done',
    ss:[{u:25,t:20},{u:23,t:25},{u:25,t:18}],
    act:[
      {id:'x1',pid:'a1',ak:'saque',oc:'Ace',set:1},{id:'x2',pid:'a1',ak:'ataque',oc:'Ponto',set:1},
      {id:'x3',pid:'a2',ak:'bloqueio',oc:'Ponto',set:1},{id:'x4',pid:'a1',ak:'ataque',oc:'Erro',set:2},
      {id:'x5',pid:'a2',ak:'recepcao',oc:'A',set:2},{id:'x6',pid:'a1',ak:'ataque',oc:'Ponto',set:3}
    ],lineup:[{aid:'a1',nu:7},{aid:'a2',nu:12}]}],
  invites:{}}};
Object.assign(fakeDB,JSON.parse(JSON.stringify(seed)));
let htmlMod=html.replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>/g,'').replace('firebase.initializeApp(fc);','var firebase=window.firebaseMock; firebase.initializeApp(fc);');
const dom=new JSDOM(htmlMod,{url:'https://master.associacaoscoladevoleibol.com.br/?torneio=usa',runScripts:'dangerously',pretendToBeVisual:true,beforeParse(window){
  window.firebaseMock=global.firebaseMock;
  window.AudioContext=function(){return{createOscillator:()=>({connect:()=>{},frequency:{},start:()=>{},stop:()=>{}}),createGain:()=>({connect:()=>{},gain:{}}),destination:{},currentTime:0};};
  window.navigator.vibrate=()=>{};
  window.URL.createObjectURL=()=>'blob:fake';window.URL.revokeObjectURL=()=>{};
  window.alert=()=>{};
}});
const w=dom.window;
setTimeout(()=>{
 try{
  ['teams','games','tournaments','athletes','invites'].forEach(k=>{const p='torneio-master-santos/'+k;if(listeners[p])listeners[p]({val:()=>getAt(p)});});
  w.torneioUnlocked=true;
  let pass=0,fail=0;function ck(n,c){if(c){pass++;console.log('✅ '+n);}else{fail++;console.log('❌ '+n);}}

  console.log('=== TRAVA DE ADMIN ===');
  // sem destravar, openTorneioNovoJogo deve abrir o GATE de senha, nao o form
  w.torneioAdminUnlocked=false;
  w.openTorneioNovoJogo();
  var modal=w.document.getElementById('tnjModal');
  ck('Novo Jogo sem senha abre o gate de senha', modal && modal.innerHTML.indexOf('AREA RESTRITA')>=0 || modal.innerHTML.indexOf('RESTRITA')>=0);
  // senha errada
  var pin=w.document.getElementById('tnj-admin-pwd');pin.value='errada';
  w.checkTorneioAdminPwd();
  ck('senha errada NAO destrava', w.torneioAdminUnlocked===false);
  // senha certa
  var pin2=w.document.getElementById('tnj-admin-pwd');pin2.value='rsadmin2026';
  w.checkTorneioAdminPwd();
  ck('senha rsadmin2026 destrava admin', w.torneioAdminUnlocked===true);
  ck('apos senha certa abre o formulario de jogo', w.document.getElementById('tnj-opp')!=null);

  console.log('\n=== CRIAR JOGO ===');
  var nGamesAntes=w.D.games.length;
  // tentar salvar sem adversario
  w.document.getElementById('tnj-opp').value='';
  w.document.getElementById('tnj-dt').value='2026-05-23';
  w.salvarTorneioJogo();
  ck('nao cria jogo sem adversario', w.D.games.length===nGamesAntes);
  ck('mostra erro de adversario', (w.document.getElementById('tnj-err')||{}).textContent.indexOf('advers')>=0);
  // preencher certo
  w.document.getElementById('tnj-opp').value='Miami Thunder';
  w.document.getElementById('tnj-dt').value='2026-05-23';
  w.document.getElementById('tnj-tm').value='14:00';
  w.document.getElementById('tnj-phase').value='Semifinal';
  w.salvarTorneioJogo();
  ck('jogo criado (D.games +1)', w.D.games.length===nGamesAntes+1);
  var novo=w.D.games[w.D.games.length-1];
  ck('jogo novo tem torId do torneio', novo.torId==='t_usa_open');
  ck('jogo novo herdou a equipe RS (tid)', novo.tid==='trs_adulto');
  ck('jogo novo: adversario correto', novo.opp==='Miami Thunder');
  ck('jogo novo: data/hora/fase corretos', novo.dt==='2026-05-23'&&novo.tm==='14:00'&&novo.phase==='Semifinal');
  ck('jogo novo: status pending', novo.st==='pending');
  ck('jogo novo: ss e act vazios prontos', Array.isArray(novo.ss)&&Array.isArray(novo.act));
  ck('jogo novo gravado no banco', (function(){var sv=getAt('torneio-master-santos/games');return Array.isArray(sv)&&sv.some(function(x){return x&&x.opp==='Miami Thunder';});})());

  console.log('\n=== PDF DA PARTIDA ===');
  var e=null;
  try{ w.exGamePDF('g1'); }catch(ex){ e=ex; }
  ck('exGamePDF roda sem erro no jogo com dados', !e);
  // verificar conteudo do PDF: interceptar Blob
  var pdfHtml='';
  var OrigBlob=w.Blob;
  w.Blob=function(parts,opts){pdfHtml=parts.join('');return new OrigBlob(parts,opts);};
  w.exGamePDF('g1');
  w.Blob=OrigBlob;
  ck('PDF tem cabecalho com placar de sets', pdfHtml.indexOf('SETS')>=0);
  ck('PDF tem KPIs (Acoes totais)', pdfHtml.indexOf('es totais')>=0);
  ck('PDF tem resumo por atleta', pdfHtml.indexOf('por atleta')>=0);
  ck('PDF tem detalhamento por set (3 sets)', pdfHtml.indexOf('SET 1')>=0&&pdfHtml.indexOf('SET 2')>=0&&pdfHtml.indexOf('SET 3')>=0);
  ck('PDF mostra nome dos atletas', pdfHtml.indexOf('Mateus')>=0&&pdfHtml.indexOf('Hugo')>=0);
  ck('PDF tem chips de fundamento coloridos', pdfHtml.indexOf('class=chip')>=0);
  ck('PDF calcula pontos (destaque)', pdfHtml.indexOf('Destaque')>=0);
  // jogo sem acoes -> nao quebra
  var e2=null;try{ w.exGamePDF('inexistente'); }catch(ex){ e2=ex; }
  ck('exGamePDF em jogo inexistente nao quebra', !e2);

  console.log('\n=== '+pass+' ok, '+fail+' falhas ===');
  console.log(fail===0?'✅✅✅ FASE 3 APROVADA':'❌ FASE 3 REPROVADA');
  process.exit(fail===0?0:1);
 }catch(e){console.log('❌ ERRO:',e.message);console.log(e.stack);process.exit(1);}
},600);
