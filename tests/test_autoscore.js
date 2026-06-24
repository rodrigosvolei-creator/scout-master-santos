const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');

const fakeDB = {};
const listeners = {};
function getAt(p){const a=p.split('/');let c=fakeDB;for(const x of a){if(c==null)return null;c=c[x];}return c===undefined?null:c;}
function setAt(p,v){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}c[a[a.length-1]]=JSON.parse(JSON.stringify(v));}
function makeRef(p){return{on:(e,cb)=>{listeners[p]=cb;},once:()=>Promise.resolve({val:()=>getAt(p)}),set:v=>{setAt(p,v);return Promise.resolve();},update:()=>Promise.resolve()};}

global.firebaseMock={initializeApp:()=>{},database:()=>({ref:makeRef}),auth:()=>({onAuthStateChanged:cb=>setTimeout(()=>cb({uid:'tester',email:'rodrigosvolei@gmail.com',displayName:'Tester'}),0),signInWithPopup:()=>Promise.resolve(),signOut:()=>Promise.resolve()})};

const seed={'torneio-master-santos':{
  teams:[{id:'trs_adulto',n:'RS-VOLEIBOL ADULTO MASCULINO',c:'#2563eb',roster:[{aid:'a1'},{aid:'a2'}]}],
  athletes:[{aid:'a1',nm:'Mateus',po:'Ponta'},{aid:'a2',nm:'Hugo',po:'Central'}],
  tournaments:[{id:'t_usa_open',n:'2026 Adult Open Championship',c:'#1d7a3a'}],
  games:[{id:'g1',torId:'t_usa_open',tid:'trs_adulto',opp:'VBA Highline',dt:'2026-05-22',tm:'13:00',st:'pending',lineup:[{aid:'a1',nu:1},{aid:'a2',nu:3}]}],
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
  w.openTorneioGame('g1');w.startG();
  const ss=()=>w.gF('g1').ss[w.S.cs-1];
  let pass=0,fail=0;
  function check(nome,cond){ if(cond){pass++;console.log('✅ '+nome);}else{fail++;console.log('❌ '+nome);} }

  console.log('=== PONTO AUTOMATICO — regra parcial ===');

  // Ace do saque => RS +1
  w.S.sp='a1';w.S.sa='saque';w.rcO('Ace');
  check('Ace do saque sobe placar RS', ss().u===1 && ss().t===0);

  // Ataque Ponto => RS +1
  w.S.sp='a1';w.S.sa='ataque';w.rcO('Ponto');
  check('Ataque Ponto sobe placar RS', ss().u===2 && ss().t===0);

  // Bloqueio Ponto => RS +1
  w.S.sp='a2';w.S.sa='bloqueio';w.rcO('Ponto');
  check('Bloqueio Ponto sobe placar RS', ss().u===3 && ss().t===0);

  // Saque Erro => adversario +1
  w.S.sp='a1';w.S.sa='saque';w.rcO('Erro');
  check('Saque Erro sobe placar adversario', ss().u===3 && ss().t===1);

  // Ataque Erro => adversario +1
  w.S.sp='a1';w.S.sa='ataque';w.rcO('Erro');
  check('Ataque Erro sobe placar adversario', ss().u===3 && ss().t===2);

  // Bloqueio Erro => adversario +1
  w.S.sp='a2';w.S.sa='bloqueio';w.rcO('Erro');
  check('Bloqueio Erro sobe placar adversario', ss().u===3 && ss().t===3);

  // Recepcao Erro => adversario +1 (erro nosso na recepcao = ponto do adversario)
  let antesU=ss().u,antesT=ss().t;
  w.S.sp='a1';w.S.sa='recepcao';w.rcO('Erro');
  check('Recepcao Erro sobe placar adversario', ss().u===antesU && ss().t===antesT+1);

  // Defesa Erro => adversario +1
  antesU=ss().u;antesT=ss().t;
  w.S.sp='a2';w.S.sa='defesa';w.rcO('Erro');
  check('Defesa Erro sobe placar adversario', ss().u===antesU && ss().t===antesT+1);

  // Recepcao A (boa) => NAO mexe placar
  antesU=ss().u;antesT=ss().t;
  w.S.sp='a1';w.S.sa='recepcao';w.rcO('A');
  check('Recepcao A NAO mexe placar', ss().u===antesU && ss().t===antesT);

  // Ataque Cont => NAO mexe placar
  antesU=ss().u;antesT=ss().t;
  w.S.sp='a1';w.S.sa='ataque';w.rcO('Cont');
  check('Ataque Cont NAO mexe placar', ss().u===antesU && ss().t===antesT);

  console.log('\n=== UNDO reverte ponto junto ===');
  // estado atual: u=3 t=3. Marcar Ace (u vira 4), undo (u volta 3)
  w.S.sp='a1';w.S.sa='saque';w.rcO('Ace');
  const apos=ss().u;
  w.undo();
  check('undo de Ace reverte ponto RS (u: '+apos+'->'+ss().u+')', ss().u===apos-1);

  // Marcar Saque Erro (t sobe), undo (t volta)
  w.S.sp='a1';w.S.sa='saque';w.rcO('Erro');
  const aposT=ss().t;
  w.undo();
  check('undo de Erro reverte ponto adversario (t: '+aposT+'->'+ss().t+')', ss().t===aposT-1);

  // undo de acao SEM ponto (Recepcao A) nao mexe placar
  w.S.sp='a1';w.S.sa='recepcao';w.rcO('A');
  antesU=ss().u;antesT=ss().t;
  w.undo();
  check('undo de acao sem ponto nao mexe placar', ss().u===antesU && ss().t===antesT);

  console.log('\n=== + e - manual continuam funcionando ===');
  antesU=ss().u;
  w.scUp('u');
  check('+ manual ainda soma RS', ss().u===antesU+1);
  w.scDn('u');
  check('- manual ainda subtrai RS', ss().u===antesU);

  console.log('\n=== PERSISTENCIA (F5) ===');
  const sv=getAt('torneio-master-santos/games');
  const g=Array.isArray(sv)?sv.find(x=>x&&x.id==='g1'):null;
  check('jogo gravado no banco com placar', g&&g.ss&&g.ss[0]&&typeof g.ss[0].u==='number');
  check('acoes gravadas no banco', g&&g.act&&g.act.length>0);

  console.log('\n=== RESULTADO: '+pass+' ok, '+fail+' falhas ===');
  console.log(fail===0?'✅✅✅ FASE 2 APROVADA':'❌ FASE 2 REPROVADA');
  process.exit(fail===0?0:1);
 }catch(e){console.log('❌ ERRO:',e.message);console.log(e.stack);process.exit(1);}
},600);
