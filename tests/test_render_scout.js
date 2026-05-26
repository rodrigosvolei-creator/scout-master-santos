const fs=require('fs');const {JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const fakeDB={};const listeners={};
function getAt(p){const a=p.split('/');let c=fakeDB;for(const x of a){if(c==null)return null;c=c[x];}return c===undefined?null:c;}
function setAt(p,v){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}c[a[a.length-1]]=JSON.parse(JSON.stringify(v));}
function makeRef(p){return{on:(e,cb)=>{listeners[p]=cb;},once:()=>Promise.resolve({val:()=>getAt(p)}),set:v=>{setAt(p,v);return Promise.resolve();},update:()=>Promise.resolve()};}
global.firebaseMock={initializeApp:()=>{},database:()=>({ref:makeRef}),auth:()=>({onAuthStateChanged:cb=>setTimeout(()=>cb(null),0),signInWithPopup:()=>Promise.resolve(),signOut:()=>Promise.resolve()})};
const seed={'torneio-master-santos':{
  teams:[{id:'trs_adulto',n:'RS-VOLEIBOL ADULTO MASCULINO',c:'#2563eb',roster:[{aid:'a1'},{aid:'a2'},{aid:'a3'}]}],
  athletes:[{aid:'a1',nm:'Mateus Passaro',po:'Ponta'},{aid:'a2',nm:'Hugo Satoshi',po:'Central'},{aid:'a3',nm:'Yuri Ohtani',po:'Levantador'}],
  tournaments:[{id:'t_usa_open',n:'2026 Adult Open Championship',c:'#1d7a3a'}],
  games:[{id:'g1',torId:'t_usa_open',tid:'trs_adulto',opp:'VBA Highline',dt:'2026-05-22',tm:'13:00',st:'pending',lineup:[{aid:'a1',nu:1},{aid:'a2',nu:3},{aid:'a3',nu:7}]}],
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
  w.torneioUnlocked=true;w.render();
  w.isScouter=true;
  w.openTorneioGame("g1");w.startG();
  let pass=0,fail=0;
  function ck(n,c){if(c){pass++;console.log('✅ '+n);}else{fail++;console.log('❌ '+n);}}

  // Renderizar a tela de scout de verdade
  let scoutHTML='';
  let err=null;
  try{ var _sv=w.isScouter;w.isScouter=true;scoutHTML=w.rSct();w.isScouter=_sv; }catch(e){ err=e; }
  if(err){ console.log('❌ rSct() lançou erro:',err.message); process.exit(1); }
  ck('rSct() renderiza sem erro', scoutHTML.length>100);

  // Balanco de <div> — abrir e fechar tem que bater
  const abertas=(scoutHTML.match(/<div/g)||[]).length;
  const fechadas=(scoutHTML.match(/<\/div>/g)||[]).length;
  console.log('   <div> abertas: '+abertas+' | </div> fechadas: '+fechadas);
  ck('tags <div> balanceadas', abertas===fechadas);

  // Inserir no DOM e conferir que parseou sem quebrar estrutura
  const cont=w.document.createElement('div');
  cont.innerHTML=scoutHTML;
  ck('HTML parseia no DOM', cont.querySelectorAll('div').length>0);

  // Elementos-chave presentes
  ck('placar contem botoes + (scUp)', scoutHTML.indexOf('scUp(')>=0);
  ck('placar contem botoes - (scDn)', scoutHTML.indexOf('scDn(')>=0);
  ck('controles: Finalizar presente', scoutHTML.indexOf('enG()')>=0);
  // dica do ponto automatico: o markup tem <b>...</b> no meio (negrito dourado .sc-hint b),
  // entao a substring contigua 'Ace / Ponto sobem' nao existe — checar o texto sem as tags.
  const hintTxt=scoutHTML.replace(/<[^>]+>/g,'');
  ck('dica do ponto automatico presente', hintTxt.indexOf('Ace / Ponto sobem o placar do RS')>=0);
  ck('painel de atleta presente', scoutHTML.indexOf('slP(')>=0);
  ck('nome equipe nao quebrado feio (sem substring 22 antigo)', scoutHTML.indexOf('ADULTO MAS')<0 || scoutHTML.indexOf('RS · ')>=0);

  // funcional: + e marcar acao ainda funcionam apos repaginar
  const ss=()=>w.gF('g1').ss[w.S.cs-1];
  w.scUp('u'); ck('+ funciona apos repaginar', ss().u===1);
  w.S.sp='a1';w.S.sa='saque';w.rcO('Ace'); ck('Ace marca acao + ponto auto', ss().u===2 && w.gF('g1').act.length===1);

  console.log('\n=== '+pass+' ok, '+fail+' falhas ===');
  console.log(fail===0?'✅✅✅ FASE 1 APROVADA (render OK, tags balanceadas)':'❌ FASE 1 REPROVADA');
  process.exit(fail===0?0:1);
 }catch(e){console.log('❌ ERRO:',e.message);console.log(e.stack);process.exit(1);}
},600);
