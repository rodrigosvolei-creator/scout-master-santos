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
    {id:'g1',torId:'t_usa_open',tid:'trs_adulto',opp:'Arlington Empire',dt:'2026-05-22',tm:'10:00',st:'pending',lineup:[{aid:'a1',nu:1}]},
    {id:'g2',torId:'t_usa_open',tid:'trs_adulto',opp:'The Tall Ones',dt:'2026-05-22',tm:'11:00',st:'live',ss:[{u:13,t:9}],act:[{id:'a',pid:'a1',ak:'saque',oc:'Ace',set:1}],lineup:[{aid:'a1',nu:1}]},
    {id:'g3',torId:'t_usa_open',tid:'trs_adulto',opp:'VBA Highline',dt:'2026-05-22',tm:'13:00',st:'done',ss:[{u:25,t:20},{u:25,t:18}],act:[],lineup:[{aid:'a1',nu:1}]}
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
  // Fase B1.2: o URL parser nao seta mais torneioMode/torneioId/torneioToken.
  // Este teste exercita as funcoes do modo isolado legado, entao re-estabelece
  // o estado manualmente (sera removido na Fase B1.4 junto com o modo isolado).
  w.torneioMode=true; w.torneioId='t_usa_open'; w.torneioToken='usa';
  let pass=0,fail=0;function ck(n,c){if(c){pass++;console.log('✅ '+n);}else{fail++;console.log('❌ '+n);}}

  // TELA DE SENHA
  let senha='';let e1=null;
  try{ w.torneioUnlocked=false; senha=w.renderTorneioSenha(w.gF?{n:'2026 Adult Open Championship'}:{n:'x'}); }catch(e){e1=e;}
  ck('renderTorneioSenha sem erro', !e1 && senha.length>100);
  ck('senha usa tema escuro (usa-lock-card)', senha.indexOf('usa-lock-card')>=0);
  ck('senha tem logo RS (nao emoji)', senha.indexOf('usa-lock-crest')>=0 && senha.indexOf('data:image')>=0);
  var sd=(senha.match(/<div/g)||[]).length, sf=(senha.match(/<\/div>/g)||[]).length;
  ck('senha: divs balanceadas ('+sd+'/'+sf+')', sd===sf);

  // CARDS GAME DAY
  let cards='';let e2=null;
  try{ cards=w.renderTorneioCards({n:'2026 Adult Open Championship'}); }catch(e){e2=e;}
  ck('renderTorneioCards sem erro', !e2 && cards.length>100);
  ck('cards: 3 jogos renderizados', (cards.match(/gd-card/g)||[]).length>=3);
  ck('cards: tema escuro novo (gd-body)', cards.indexOf('gd-body')>=0);
  ck('cards: logo adversario detectado (Arlington->ae)', cards.indexOf('usa-opp-logo-img')>=0);
  ck('cards: badge USA sem emoji bandeira cortada', cards.indexOf('USA TOURNAMENT')>=0);
  ck('cards: status AO VIVO presente (g2 live)', cards.indexOf('AO VIVO')>=0);
  ck('cards: status FINALIZADO presente (g3 done)', cards.indexOf('FINALIZADO')>=0);
  var cd=(cards.match(/<div/g)||[]).length, cf=(cards.match(/<\/div>/g)||[]).length;
  ck('cards: divs balanceadas ('+cd+'/'+cf+')', cd===cf);

  // parse no DOM
  const cont=w.document.createElement('div');cont.innerHTML=cards;
  ck('cards parseiam no DOM', cont.querySelectorAll('.gd-card').length>=3);
  const cont2=w.document.createElement('div');cont2.innerHTML=senha;
  ck('senha parseia no DOM', cont2.querySelector('.usa-lock-card')!=null);

  // ORDENACAO: mais recente em cima (g3 13:00 done > g2 11:00 live > g1 10:00 pending)
  // o 1o card deve referenciar g3, o ultimo g1
  var cardEls=cont.querySelectorAll('.gd-card');
  ck('ordem: 1o card e o mais recente (g3)', cardEls[0].getAttribute('onclick').indexOf('g3')>=0);
  ck('ordem: ultimo card e o mais antigo (g1)', cardEls[cardEls.length-1].getAttribute('onclick').indexOf('g1')>=0);
  // PROXIMO JOGO: g1 e o unico pendente -> deve ter o badge e a classe gd-next
  ck('proximo: badge PROXIMO JOGO presente', cards.indexOf('PR\u00d3XIMO JOGO')>=0);
  ck('proximo: exatamente 1 card marcado gd-next', cont.querySelectorAll('.gd-next').length===1);
  var nextCard=cont.querySelector('.gd-next');
  ck('proximo: o card marcado e o g1 (pendente)', nextCard && nextCard.getAttribute('onclick').indexOf('g1')>=0);
  ck('proximo: card live/done NAO recebe gd-next', cardEls[0].className.indexOf('gd-next')<0);

  console.log('\n=== '+pass+' ok, '+fail+' falhas ===');
  console.log(fail===0?'✅✅✅ TORNEIO REPAGINADO APROVADO':'❌ REPROVADO');
  process.exit(fail===0?0:1);
 }catch(e){console.log('❌ ERRO:',e.message);console.log(e.stack);process.exit(1);}
},600);
