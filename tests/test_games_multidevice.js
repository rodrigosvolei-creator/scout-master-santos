// C2 — 2 aparelhos marcando o MESMO jogo (escrita granular em games/{idx}).
// Antes: cada ponto fazia set() do jogo INTEIRO a partir do estado local -> o ultimo a gravar
// apagava a marcacao do outro (pior ainda com a aba suspensa / offline: estado velho por minutos).
// Agora: act/{aid} e ss/{i}/sq/{k} sao nos proprios, ss/{i}/u|t sobem com increment, e sets /
// quadra / status vao em update() multi-caminho so com o que mudou.
// Mock do Firebase COMPARTILHADO entre 2 doms, com update() multi-caminho de verdade (null apaga,
// {".sv":{increment:n}} soma), ServerValue.increment, e "suspender" o listener de um aparelho
// (simula aba em background: ele fica com estado VELHO enquanto o outro grava).
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');

const fakeDB = {};
const listeners = []; // {path, cb, dev}
const suspended = {}; // dev -> true (listener nao recebe nada ate resumir)
const pendingResume = {}; // dev -> true (perdeu evento enquanto suspenso)
function getAt(p){const a=p.split('/');let c=fakeDB;for(const k of a){if(c==null)return null;c=c[k];}return c===undefined?null:c;}
function setAt(p,v){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};else if(Array.isArray(c[a[i]])&&!/^\d+$/.test(a[i+1]))c[a[i]]=Object.assign({},c[a[i]]);c=c[a[i]];}c[a[a.length-1]]=JSON.parse(JSON.stringify(v));}
// apagar o ULTIMO indice de um array encolhe o array (como o Firebase devolve); indice do meio vira null
function delAt(p){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c==null)return;c=c[a[i]];}if(!c)return;const k=a[a.length-1];if(Array.isArray(c)&&/^\d+$/.test(k)){const i=+k;if(i===c.length-1){c.length=i;while(c.length&&c[c.length-1]==null)c.length--;}else if(i<c.length)c[i]=null;}else delete c[k];}
function updAt(base,obj){
  // como o Firebase: nenhum caminho pode ser ancestral de outro no mesmo update()
  const ks=Object.keys(obj);
  for(const x of ks)for(const y of ks){if(x!==y&&y.indexOf(x+'/')===0)throw new Error('update() com caminho ancestral: '+x+' > '+y);}
  for(const k of ks){const p=base+'/'+k,v=obj[k];
    if(v===null)delAt(p);
    else if(v&&typeof v==='object'&&v['.sv']&&typeof v['.sv'].increment==='number'){const cur=getAt(p);setAt(p,(typeof cur==='number'?cur:0)+v['.sv'].increment);}
    else{ if(JSON.stringify(v).indexOf('undefined')>=0)throw new Error('undefined em '+p); setAt(p,v); }
  }
}
function fire(writtenPath){
  listeners.forEach(function(L){
    if(writtenPath===L.path || writtenPath.indexOf(L.path+'/')===0 || L.path.indexOf(writtenPath+'/')===0){
      if(suspended[L.dev]){pendingResume[L.dev]=true;return;}
      L.cb({val:function(){return getAt(L.path);}});
    }
  });
}
function suspend(dev){suspended[dev]=true;}
function resume(dev){delete suspended[dev];if(pendingResume[dev]){delete pendingResume[dev];listeners.filter(L=>L.dev===dev).forEach(L=>L.cb({val:()=>getAt(L.path)}));}}
function makeRef(p,dev){return{_path:p,
  on:function(e,cb){listeners.push({path:p,cb:cb,dev:dev}); cb({val:function(){return getAt(p);}});},
  once:function(){return Promise.resolve({val:function(){return getAt(p);}});},
  set:function(v){setAt(p,v);fire(p);return Promise.resolve();},
  update:function(obj){updAt(p,obj);fire(p);return Promise.resolve();},
  remove:function(){delAt(p);fire(p);return Promise.resolve();}
};}
function makeMock(dev){
  const database=function(){return{ref:function(p){return makeRef(p,dev);}};};
  database.ServerValue={increment:function(n){return {'.sv':{'increment':n}};}}; // igual ao SDK
  return {initializeApp:function(){},database:database,
    auth:function(){return{onAuthStateChanged:function(cb){setTimeout(function(){cb({uid:'u_'+dev,email:'rodrigosvolei@gmail.com',displayName:'Mesa '+dev});},0);},signInWithPopup:function(){return Promise.resolve();},signOut:function(){return Promise.resolve();}};}};
}

const seed = { 'torneio-master-santos': {
  teams:[{id:'trs',n:'RS FEM',c:'#db2777',roster:[1,2,3,4,5,6,7].map(i=>({aid:'a'+i}))}],
  athletes:[1,2,3,4,5,6,7].map(function(i){return {aid:'a'+i,nm:'Atleta '+i,po:(i===7?'Libero':'Ponta'),nu:i};}),
  tournaments:[{id:'tRS',n:'Liga',layout:'gameday'}],
  games:[
    {id:'g1',torId:'tRS',tid:'trs',opp:'Adversario',st:'pending',lineup:[1,2,3,4,5,6,7].map(i=>({aid:'a'+i,nu:i}))},
    // g2: FORMATO ANTIGO (act array, sq array) ja ao vivo — como todos os jogos de producao hoje
    {id:'g2',torId:'tRS',tid:'trs',opp:'Legado FC',st:'live',lineup:[1,2,3,4,5,6,7].map(i=>({aid:'a'+i,nu:i})),
     act:[{id:'aL1',pid:'a1',ak:'ataque',oc:'Ponto',set:1,ts:5},{id:'aL2',pid:'a2',ak:'saque',oc:'Ace',set:1,ts:9},{id:'aL3',pid:'a1',ak:'ataque',oc:'Erro',set:1,ts:14}],
     ss:[{u:2,t:1,sq:['u','u','t']}]}
  ],
  invites:{} } };
Object.assign(fakeDB, JSON.parse(JSON.stringify(seed)));

const htmlMod = html
  .replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>/g,'')
  .replace('firebase.initializeApp(fc);','var firebase=window.__mock; firebase.initializeApp(fc);');

function makeLS(){var m={};return{getItem:function(k){return k in m?m[k]:null;},setItem:function(k,v){m[k]=String(v);},removeItem:function(k){delete m[k];},clear:function(){m={};}};}
function boot(dev,tablet){
  return new JSDOM(htmlMod, { url:'https://master.exemplo.com.br/?app=1', runScripts:'dangerously', pretendToBeVisual:true,
    beforeParse(window){
      window.__mock=makeMock(dev);
      var ls=makeLS(); if(tablet)ls.setItem('rs_scout_tablet','1');
      try{Object.defineProperty(window,'localStorage',{value:ls,configurable:true});}catch(e){window.__ls=ls;}
      window.AudioContext=function(){return{createOscillator:function(){return{connect:function(){},frequency:{},start:function(){},stop:function(){}};},createGain:function(){return{connect:function(){},gain:{}};},destination:{},currentTime:0};};
      window.navigator.vibrate=function(){};
      window.alert=function(){};
    }});
}
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
let ok=0,ko=0; function chk(c,m){if(c){ok++;console.log('OK   '+m);}else{ko++;console.log('FAIL '+m);}}
const G1='torneio-master-santos/games/0', G2='torneio-master-santos/games/1';
const nAct=g=>(g&&g.act&&!Array.isArray(g.act))?Object.keys(g.act).length:-1;
const nSq=(g,i)=>(g&&g.ss&&g.ss[i]&&g.ss[i].sq&&!Array.isArray(g.ss[i].sq))?Object.keys(g.ss[i].sq).length:-1;
const intKeys=o=>Object.keys(o||{}).filter(k=>/^\d+$/.test(k));

(async function(){
 try{
  const A=boot('A',false); await sleep(140);
  const B=boot('B',false); await sleep(140);
  const wa=A.window, wb=B.window;
  wa.currentUser={uid:'uA',email:'rodrigosvolei@gmail.com'};
  wb.currentUser={uid:'uB',email:'rodrigosvolei@gmail.com'};

  console.log('\n--- 1. leitura: formato antigo e normalizado, o app segue com arrays ---');
  var l2=wa.gF('g2');
  chk(Array.isArray(l2.act)&&l2.act.length===3&&l2.act[0].id==='aL1'&&l2.act[2].id==='aL3', 'g2 (array no banco): local act e array na ordem original');
  chk(l2._legacy===true&&l2._actN===3, 'g2 marcado _legacy (converte na 1a escrita)');
  chk(Array.isArray(l2.ss[0].sq)&&l2.ss[0].sq.join('')==='uut'&&Array.isArray(l2.ss[0].sqk)&&l2.ss[0].sqk.length===3, 'g2: sq local e array com sqk (chaves sinteticas) alinhado');
  chk(Array.isArray(getAt(G2).act)&&Array.isArray(getAt(G2).ss[0].sq), 'g2 no banco continua array (leitura NAO muta o snapshot)');

  console.log('\n--- 2. A inicia g1 (st gravado granular) e os dois abrem o jogo ---');
  wa.openGameDayCard('g1'); wa.startG();
  chk(getAt(G1).st==='live'&&getAt(G1).ss&&getAt(G1).ss[0].u===0, 'startG: st=live + ss gravados (sem save() dos 4 nos)');
  wb.openGameDayCard('g1');
  chk(wb.gF('g1').st==='live', 'B ve g1 ao vivo');

  console.log('\n--- 3. os dois ONLINE marcam no mesmo set ---');
  wa.S.sp='a1'; wa.S.sa='ataque'; wa.rcO('Ponto');   // u=1
  wb.S.sp='a2'; wb.S.sa='ataque'; wb.rcO('Erro');    // t=1
  wa.S.sp='a3'; wa.S.sa='saque';  wa.rcO('Ace');     // u=2
  wb.S.sp='a4'; wb.S.sa='ataque'; wb.rcO('Bloq');    // t=2
  var db1=getAt(G1);
  chk(nAct(db1)===4, 'banco: act e OBJETO chaveado com as 4 acoes (act/{aid}) — nenhuma apagou a outra');
  chk(db1.ss[0].u===2&&db1.ss[0].t===2, 'banco: placar 2-2 (increment)');
  chk(nSq(db1,0)===4, 'banco: sq do set 1 e objeto chaveado com 4 entradas');
  var la=wa.gF('g1'), lb=wb.gF('g1');
  chk(la.act.length===4&&lb.act.length===4, 'os 2 aparelhos veem as 4 acoes');
  chk(la.ss[0].u===2&&la.ss[0].t===2&&lb.ss[0].u===2&&lb.ss[0].t===2, 'os 2 aparelhos veem 2-2');
  chk(la.ss[0].sq.length===4&&la.ss[0].sqk.length===4&&la.ss[0].sq.join('')==='utut', 'sq local: 4 entradas na ordem cronologica (u t u t), sqk alinhado');
  var devs={}; la.act.forEach(a=>{devs[a.dev]=1;});
  chk(la.act.every(a=>/^a\d{13}_[a-z0-9]+$/.test(a.id)&&a.dev)&&Object.keys(devs).length===2, 'cada acao tem id unico (a<ms>_<rand>) e dev do aparelho (2 aparelhos distintos)');
  chk(la.act.map(a=>a.id).join()===lb.act.map(a=>a.id).join(), 'ordem das acoes igual nos 2 aparelhos (chave = cronologica)');

  console.log('\n--- 4. A fica com estado VELHO (aba suspensa) enquanto B marca; depois A marca sem ter recebido ---');
  suspend('A');
  wb.S.sp='a1'; wb.S.sa='ataque'; wb.rcO('Ponto');
  wb.S.sp='a1'; wb.S.sa='ataque'; wb.rcO('Ponto');
  wb.S.sp='a2'; wb.S.sa='bloqueio'; wb.rcO('Ponto'); // u=5 no banco
  chk(wa.gF('g1').act.length===4&&wa.gF('g1').ss[0].u===2, 'A (suspenso) ainda ve 4 acoes e 2-2 — estado VELHO de proposito');
  wa.S.sp='a5'; wa.S.sa='ataque'; wa.rcO('Ponto');  // A grava com estado velho
  wa.S.sp='a6'; wa.S.sa='ataque'; wa.rcO('Ponto');
  var db2=getAt(G1);
  chk(nAct(db2)===9, 'banco: 9 acoes — as 3 de B NAO foram apagadas pela gravacao de A com estado velho (antes: perdia as 3)');
  chk(db2.ss[0].u===7&&db2.ss[0].t===2, 'banco: 7-2 — increment somou os 5 pontos (antes: A gravaria 4, apagando 3 de B)');
  chk(nSq(db2,0)===9, 'banco: sq com 9 entradas (nenhuma perdida)');
  resume('A');
  la=wa.gF('g1');
  chk(la.act.length===9&&la.ss[0].u===7&&la.ss[0].sq.length===9, 'A voltou: ve as 9 acoes, 7-2 e sq completo');
  chk(wa._pdfLadderHTML(la).indexOf('SET 1')>=0, 'PDF: sequencia de pontos do set 1 e "real" (sq.length == u+t) mesmo com 2 aparelhos');

  console.log('\n--- 5. desfazer e POR APARELHO: cada um tira so a propria ultima acao ---');
  var lastA=wa.S.us[wa.S.us.length-1].a.id;
  wa.undo();
  var db3=getAt(G1);
  chk(nAct(db3)===8&&!db3.act[lastA]&&db3.ss[0].u===6&&nSq(db3,0)===8, 'A desfez: so a acao de A saiu, placar 6-2 (increment -1), sq 8');
  var lastB=wb.S.us[wb.S.us.length-1].a.id;
  wb.undo();
  var db4=getAt(G1);
  chk(nAct(db4)===7&&!db4.act[lastB]&&db4.ss[0].u===5, 'B desfez a dele: 7 acoes, 5-2');
  chk(Object.keys(db4.act).every(k=>k!==lastA&&k!==lastB), 'as duas acoes desfeitas sumiram do banco; as outras 7 ficaram');

  console.log('\n--- 6. +/- manual ---');
  wb.scDn('u');
  var db5=getAt(G1);
  chk(db5.ss[0].u===4&&nSq(db5,0)===6, 'B "-" nosso: 4-2, sq perdeu a ultima entrada "u"');
  wa.scUp('t');
  var db6=getAt(G1);
  chk(db6.ss[0].t===3&&nSq(db6,0)===7&&wa.gF('g1').ss[0].sq.slice(-1)[0]==='t', 'A "+" adversario: 4-3, sq ganhou "t" no fim');
  wa.undo(); // desfaz o + manual
  chk(getAt(G1).ss[0].t===2&&nSq(getAt(G1),0)===6, 'undo do + manual: volta 4-2 e tira a entrada certa do sq');

  console.log('\n--- 7. jogo no formato ANTIGO converte na 1a marcacao (sem migracao em lote) ---');
  wa.openGameDayCard('g2');
  wa.S.sp='a3'; wa.S.sa='ataque'; wa.rcO('Ponto');
  var d2=getAt(G2);
  chk(!Array.isArray(d2.act)&&nAct(d2)===4&&intKeys(d2.act).length===0&&d2.act.aL1&&d2.act.aL2&&d2.act.aL3, 'g2 banco: act virou objeto com as 3 antigas (mesmos ids) + a nova, sem indices 0/1/2');
  chk(!Array.isArray(d2.ss[0].sq)&&nSq(d2,0)===4&&intKeys(d2.ss[0].sq).length===0, 'g2 banco: sq virou objeto com 4 entradas, sem indices');
  chk(d2.ss[0].u===3&&d2.ss[0].t===1, 'g2 banco: placar 3-1');
  l2=wa.gF('g2');
  chk(l2._legacy===false&&l2.act.map(a=>a.id).slice(0,3).join()==='aL1,aL2,aL3'&&l2.act.length===4, 'g2 local: nao e mais legacy, ordem preservada (antigas primeiro, nova no fim)');
  chk(l2.ss[0].sq.join('')==='uutu'&&wa._buildLadder(l2,0).length===4, 'g2 local: sq na ordem certa (u u t u) — ladder com 4 colunas');
  // B ainda tinha o g2 VELHO (array)? B recebeu a conversao pelo listener; mas se estivesse
  // suspenso, gravaria a conversao de novo — tem que convergir sem duplicar nem perder.
  suspend('B');
  wa.S.sp='a4'; wa.S.sa='ataque'; wa.rcO('Erro'); // A: 5 acoes no banco, 3-2
  wb.openGameDayCard('g2');
  var lb2=wb.gF('g2');
  chk(lb2.act.length===4, 'B (suspenso) ve g2 com 4 acoes (estado velho)');
  wb.S.sp='a5'; wb.S.sa='saque'; wb.rcO('Ace');   // B grava com estado velho
  var d2b=getAt(G2);
  chk(nAct(d2b)===6&&intKeys(d2b.act).length===0&&d2b.ss[0].u===4&&d2b.ss[0].t===2&&nSq(d2b,0)===6, 'g2 banco: 6 acoes, 4-2, sq 6 — nada perdido nem duplicado');
  resume('B');
  chk(wb.gF('g2').act.length===6&&wb.gF('g2').ss[0].u===4, 'B voltou e ve tudo');

  console.log('\n--- 8. set novo / zerar set / remover set / tempo — granular ---');
  wa.openGameDayCard('g1'); wb.openGameDayCard('g1');
  // deixar o set 1 com placar pra poder abrir o set 2 (trava do 0-0)
  wa.nxS();
  var d7=getAt(G1);
  chk(Array.isArray(d7.ss)&&d7.ss.length===2&&d7.ss[1].u===0&&nAct(d7)===7, 'nxS: ss/1 criado sem reescrever as acoes (7 continuam)');
  chk(wb.gF('g1').ss.length===2, 'B recebe o set 2');
  wb.S.cs=2; wb.S.sp='a1'; wb.S.sa='ataque'; wb.rcO('Ponto');
  wa.S.sp='a2'; wa.S.sa='ataque'; wa.rcO('Ponto'); // A tambem no set 2 (S.cs=2 pelo nxS)
  var d8=getAt(G1);
  chk(d8.ss[1].u===2&&nSq(d8,1)===2&&d8.ss[0].u===4&&nSq(d8,0)===6, 'set 2 fecha 2-0 pelos 2 aparelhos; set 1 intacto (4-2, sq 6)');
  wa.sctTimeoutAdd('u'); wb.sctTimeoutAdd('u');
  chk(getAt(G1).ss[1].toU===2, 'tempo pedido nos 2 aparelhos: toU=2 (increment)');
  // zerar set 2 (confirmModal: dispara o onConfirm pelo botao)
  wa.resetSet(); wa.document.getElementById('rsConfirmOk').onclick();
  var d9=getAt(G1);
  chk(d9.ss[1].u===0&&d9.ss[1].t===0&&!d9.ss[1].sq&&d9.ss[1].toU===2&&nAct(d9)===9, 'resetSet: zera u/t e apaga sq do set 2; tempos e acoes ficam');
  wa.delLastSet(); var okBtn0=wa.document.getElementById('rsConfirmOk'); if(okBtn0)okBtn0.onclick();
  chk(getAt(G1).ss.length===2&&!okBtn0, 'delLastSet: set 2 tem acoes -> nao remove (nem pede confirmacao)');
  // set 3 vazio por engano -> remove
  wa.S.cs=2; wa.gF('g1').ss[1].u=1; wa.scUp('u'); // garante placar no set 2 pra passar a trava do nxS
  wa.nxS(); chk(getAt(G1).ss.length===3, 'nxS abriu set 3');
  wa.delLastSet(); var okBtn=wa.document.getElementById('rsConfirmOk'); if(okBtn)okBtn.onclick();
  chk(getAt(G1).ss.length===2&&wa.S.cs===2, 'delLastSet: set 3 vazio removido (ss/2=null), volta pro set 2');

  console.log('\n--- 9. quadra (courtMode) granular: court/{set} ---');
  wa.toggleCourtMode();
  chk(getAt(G1).courtMode===true&&wb.gF('g1').courtMode===true, 'toggleCourtMode grava so courtMode; B recebe');
  wa.render(); // cria o rascunho do set atual
  ['a1','a2','a3','a4','a5','a6'].forEach(function(aid,i){ wa.courtDraftPlace(aid); wa.courtDraftCell(i); });
  wa.courtDraftServer('them'); wa.courtConfirmSetup();
  var dc=getAt(G1);
  chk(dc.court&&dc.court['2']&&dc.court['2'].pos.join()==='a1,a2,a3,a4,a5,a6'&&dc.court['2'].serving==='them', 'courtConfirmSetup grava court/2 (escalacao do set atual)');
  var before=nAct(dc);
  wa.S.sp='a4'; wa.S.sa='ataque'; wa.rcO('Ponto'); // side-out: rotaciona
  var dc2=getAt(G1);
  chk(dc2.court['2'].serving==='us'&&dc2.court['2'].pos[0]==='a2', 'ponto com side-out: rotacao gravada em court/2 junto com a acao');
  chk(nAct(dc2)===before+1&&wb.gF('g1').court['2'].pos[0]==='a2', 'acao gravada e B recebe a quadra rodada');
  wa.undo();
  chk(getAt(G1).court['2'].pos[0]==='a1'&&getAt(G1).court['2'].serving==='them'&&nAct(getAt(G1))===before, 'undo restaura a quadra (court/2) e tira a acao');

  console.log('\n--- 10. corrigir atleta (reassignActions) e finalizar — granular ---');
  var g1a=wa.gF('g1'); var nA2=g1a.act.filter(a=>a.pid==='a2').length; var nTot=g1a.act.length;
  var moved=wa.reassignActions('g1','a2','a7');
  var dr=getAt(G1);
  chk(moved===nA2&&nAct(dr)===nTot&&Object.values(dr.act).filter(a=>a.pid==='a7').length===nA2&&Object.values(dr.act).every(a=>a.pid!=='a2'), 'reassignActions: so o pid mudou (act/{aid}/pid), total de acoes igual');
  wa.enG(); wa.document.getElementById('rsConfirmOk').onclick();
  var dEnd=getAt(G1);
  chk(dEnd.st==='done'&&nAct(dEnd)===nTot&&wb.gF('g1').st==='done', 'finalizar grava so st=done; acoes intactas; B ve encerrado');

  console.log('\n--- 11. save() inteiro grava no formato do banco (sem campos internos) ---');
  wa.tab='torneios'; wa.save();
  var all=getAt('torneio-master-santos/games');
  chk(Array.isArray(all)&&all.length===2&&all.every(g=>!Array.isArray(g.act)&&g._legacy===undefined&&g._actN===undefined), 'save(): act chaveado, sem _legacy/_actN');
  chk(all.every(g=>(g.ss||[]).every(s=>s.sqk===undefined&&s._sqN===undefined&&(!s.sq||!Array.isArray(s.sq)))), 'save(): sq chaveado, sem sqk/_sqN');
  chk(nAct(all[0])===nTot&&nAct(all[1])===6, 'save(): nenhuma acao perdida na serializacao');
  var la2=wa.gF('g1');
  chk(la2&&Array.isArray(la2.act)&&la2.act.length===nTot&&Array.isArray(la2.ss[0].sq), 'depois do save() o local continua com arrays (normalizado)');

  console.log('\n=== test_games_multidevice: '+ok+' OK, '+ko+' FAIL ===');
  process.exit(ko>0?1:0);
 }catch(e){ console.log('FAIL exception: '+e.message); console.log((e.stack||'').split('\n').slice(0,8).join('\n')); process.exit(1); }
})();
