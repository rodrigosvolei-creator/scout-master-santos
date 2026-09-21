// Marcacao pra analise por rotacao (posicao do levantador) nos proximos jogos:
//  - ss[i].srv0 (quem sacou primeiro no set): chip setSrv0, inferencia na 1a acao (saque/recepcao a 0-0
//    sem acoes), gravado ao escalar no modo quadra; rallyModel usa quando existe; zerar set limpa.
//  - courtHist/{set}/{key}: historico de TODAS as edicoes manuais da quadra (setup, rotate, libero, sub
//    com in/out) — court/{set} guarda so a ultima base. Mock com update() multi-caminho de verdade.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');

const fakeDB = {};
const listeners = [];
function getAt(p){const a=p.split('/');let c=fakeDB;for(const k of a){if(c==null)return null;c=c[k];}return c===undefined?null:c;}
function setAt(p,v){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}c[a[a.length-1]]=JSON.parse(JSON.stringify(v));}
function delAt(p){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c==null)return;c=c[a[i]];}if(!c)return;const k=a[a.length-1];if(Array.isArray(c)&&/^\d+$/.test(k)){const i=+k;if(i===c.length-1){c.length=i;}else c[i]=null;}else delete c[k];}
function updAt(base,obj){const ks=Object.keys(obj);for(const x of ks)for(const y of ks){if(x!==y&&y.indexOf(x+'/')===0)throw new Error('update() com caminho ancestral: '+x+' > '+y);}
  for(const k of ks){const p=base+'/'+k,v=obj[k];if(v===null)delAt(p);else if(v&&typeof v==='object'&&v['.sv']&&typeof v['.sv'].increment==='number'){const cur=getAt(p);setAt(p,(typeof cur==='number'?cur:0)+v['.sv'].increment);}else{if(JSON.stringify(v).indexOf('undefined')>=0)throw new Error('undefined em '+p);setAt(p,v);}}}
function fire(wp){listeners.forEach(function(L){if(wp===L.path||wp.indexOf(L.path+'/')===0||L.path.indexOf(wp+'/')===0)L.cb({val:function(){return getAt(L.path);}});});}
function makeRef(p){return{_path:p,on:function(e,cb){listeners.push({path:p,cb:cb});cb({val:function(){return getAt(p);}});},once:function(){return Promise.resolve({val:function(){return getAt(p);}});},
  set:function(v){setAt(p,v);fire(p);return Promise.resolve();},update:function(obj){updAt(p,obj);fire(p);return Promise.resolve();},remove:function(){delAt(p);fire(p);return Promise.resolve();}};}
const database=function(){return{ref:function(p){return makeRef(p);}};};database.ServerValue={increment:function(n){return {'.sv':{'increment':n}};}};
global.firebaseMock={initializeApp:function(){},database:database,auth:function(){return{onAuthStateChanged:function(cb){setTimeout(function(){cb({uid:'u1',email:'rodrigosvolei@gmail.com',displayName:'Mesa'});},0);},signInWithPopup:function(){return Promise.resolve();},signOut:function(){return Promise.resolve();}};}};

const seed = { 'torneio-master-santos': {
  teams:[{id:'trs',n:'RS MASC',c:'#2563eb',roster:[1,2,3,4,5,6,7,8].map(i=>({aid:'a'+i}))}],
  athletes:[1,2,3,4,5,6,7,8].map(function(i){return {aid:'a'+i,nm:'Atleta '+i,po:(i===7?'Líbero':i===1?'Levantador':'Ponteiro'),nu:i};}),
  tournaments:[{id:'tRS',n:'Liga',layout:'gameday'}],
  games:[{id:'g1',torId:'tRS',tid:'trs',opp:'Adversario',st:'pending',format:'bo5',lineup:[1,2,3,4,5,6,7,8].map(i=>({aid:'a'+i,nu:i}))}],
  invites:{} } };
Object.assign(fakeDB, JSON.parse(JSON.stringify(seed)));
const htmlMod=html.replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>/g,'').replace('firebase.initializeApp(fc);','var firebase=window.firebaseMock; firebase.initializeApp(fc);');
const dom=new JSDOM(htmlMod,{url:'https://master.exemplo.com.br/?app=1',runScripts:'dangerously',pretendToBeVisual:true,
  beforeParse(window){window.firebaseMock=global.firebaseMock;window.alert=function(){};window.navigator.vibrate=function(){};
    window.AudioContext=function(){return{createOscillator:function(){return{connect:function(){},frequency:{},start:function(){},stop:function(){}};},createGain:function(){return{connect:function(){},gain:{}};},destination:{},currentTime:0};};}});
const w=dom.window;
let ok=0,ko=0; function chk(c,m){if(c){ok++;console.log('OK   '+m);}else{ko++;console.log('FAIL '+m);}}
const G='torneio-master-santos/games/0';
const hist=(set)=>{const h=getAt(G+'/courtHist/'+set)||{};return Object.keys(h).sort().map(k=>h[k]);};

setTimeout(function(){
  try{
    w.currentUser={uid:'u1',email:'rodrigosvolei@gmail.com'}; w.isCoord=true;
    w.openGameDayCard('g1'); w.startG();
    chk(getAt(G).st==='live'&&getAt(G).ss[0].srv0===undefined, 'jogo ao vivo, set 1 sem srv0 (nao marcado)');

    console.log('\n--- 1. chip "Saque inicial" na mesa (modo classico) ---');
    w.render(); var el=w.document.querySelector('.sc-srv0');
    chk(!!el&&el.querySelectorAll('button').length===2&&el.textContent.indexOf('quem sacou primeiro?')>=0, 'chip aparece no set 1 com os 2 lados e o aviso de nao marcado');
    w.setSrv0('t');
    chk(getAt(G).ss[0].srv0==='t'&&w.gF('g1').ss[0].srv0==='t', 'setSrv0("t") grava ss/0/srv0 = "t" (eles sacaram primeiro)');
    w.render(); el=w.document.querySelector('.sc-srv0');
    chk(el.querySelectorAll('button.on').length===1&&el.querySelectorAll('button')[1].className==='on'&&el.textContent.indexOf('quem sacou')<0, 'chip marca o lado escolhido e some o aviso');
    w.setSrv0('t');
    chk(getAt(G).ss[0].srv0===undefined&&w.gF('g1').ss[0].srv0===undefined, 'tocar de novo desmarca (ss/0/srv0 = null)');
    w.setSrv0('u');
    chk(getAt(G).ss[0].srv0==='u', 'setSrv0("u") = nos sacamos primeiro');

    console.log('\n--- 2. inferencia na 1a acao do set (so a 0-0, sem acoes, e se nao marcado) ---');
    w.S.sp='a2'; w.S.sa='recepcao'; w.rcO('A');
    chk(getAt(G).ss[0].srv0==='u', '1a acao "recepcao" NAO sobrescreve o srv0 ja marcado pela mesa');
    // set 2: sem marcacao, 1a acao = saque -> "u"
    w.S.cs=1; w.gF('g1').ss[0].u=25; w.scUp('u'); w.nxS();
    chk(getAt(G).ss.length===2&&getAt(G).ss[1].srv0===undefined, 'set 2 aberto sem srv0');
    w.S.sp='a3'; w.S.sa='saque'; w.rcO('Cont');
    chk(getAt(G).ss[1].srv0==='u'&&w.gF('g1').ss[1].srv0==='u', '1a acao do set 2 = saque nosso a 0-0 -> srv0 "u" inferido e gravado junto com a acao');
    w.setSrv0('t');
    chk(getAt(G).ss[1].srv0==='t', 'a mesa corrige depois pelo chip (manda sobre a inferencia)');
    // set 3: ponto no "+" antes da 1a acao -> NAO infere (mesa comecou atrasada)
    w.gF('g1').ss[1].u=25; w.scUp('u'); w.nxS(); w.scUp('t');
    w.S.sp='a2'; w.S.sa='recepcao'; w.rcO('B');
    chk(getAt(G).ss.length===3&&getAt(G).ss[2].srv0===undefined, 'set 3: ja havia ponto no placar -> a 1a acao NAO infere (pode nao ser o 1o rally)');
    // set 4: 1a acao = ataque (nao diz quem sacou) -> nao infere
    w.gF('g1').ss[2].u=25; w.scUp('u'); w.nxS();
    w.S.sp='a2'; w.S.sa='ataque'; w.rcO('Ponto');
    chk(getAt(G).ss.length===4&&getAt(G).ss[3].srv0===undefined, 'set 4: 1a acao "ataque" nao infere');

    console.log('\n--- 3. rallyModel: srv0 marcado manda no 1o rally do set ---');
    var rm=w.rallyModel(w.gF('g1'));
    chk(rm.sets[0].rallies[0].srv==='u'&&rm.sets[1].rallies[0].srv==='t', 'set 1 (recepcao marcada, srv0=u) -> rally 0 = nos sacamos; set 2 (saque marcado, srv0=t) -> eles sacaram');
    chk(rm.sets[2].rallies[0].srv==='u', 'set 3 sem srv0: cai na alternancia (set 2 = t -> set 3 = u)');

    console.log('\n--- 4. modo quadra: escalar grava srv0 (set 0-0) e abre o historico ---');
    w.gF('g1').ss[3].u=25; w.scUp('u'); w.nxS(); // set 5, 0-0
    w.toggleCourtMode(); w.render();
    ['a1','a2','a3','a4','a5','a6'].forEach(function(aid,i){w.courtDraftPlace(aid);w.courtDraftCell(i);});
    w.courtDraftServer('them'); w.courtConfirmSetup();
    var d=getAt(G);
    chk(d.court['5'].pos.join()==='a1,a2,a3,a4,a5,a6'&&d.court['5'].serving==='them', 'base court/5 gravada');
    chk(d.ss[4].srv0==='t', 'escalar com "eles sacam" a 0-0 grava ss/4/srv0 = "t" (mesmo update)');
    var H=hist(5);
    chk(H.length===1&&H[0].kind==='setup'&&H[0].pos.join()==='a1,a2,a3,a4,a5,a6'&&H[0].serving==='them'&&typeof H[0].at==='number'&&!!H[0].dev, 'courtHist/5: 1 entrada "setup" com pos, serving, hora e aparelho');
    w.courtManualRotate(1);
    H=hist(5);
    chk(H.length===2&&H[1].kind==='rotate'&&H[1].pos[0]==='a2'&&getAt(G).court['5'].pos[0]==='a2', 'rodar manual: base nova + entrada "rotate"');
    w.courtLiberoSwap('a6');
    H=hist(5);
    chk(H.length===3&&H[2].kind==='libero'&&H[2]['in']==='a7'&&H[2].out==='a6'&&H[2].libPair&&H[2].libPair.lib==='a7', 'libero entra por a6: entrada "libero" com in/out e o par');
    w._courtSubOut='a3'; w.courtSubDoIn('a8');
    H=hist(5);
    chk(H.length===4&&H[3].kind==='sub'&&H[3]['in']==='a8'&&H[3].out==='a3'&&H[3].pos.indexOf('a8')>=0&&H[3].pos.indexOf('a3')<0, 'substituicao a8 por a3: entrada "sub" com in/out e a quadra depois da troca');
    chk(Object.keys(getAt(G+'/courtHist/5')).every(function(k){return /^h\d{13}_/.test(k);}), 'chaves do historico sao cronologicas (h<ms>_rand)');
    chk(w.gF('g1').courtHist&&Object.keys(w.gF('g1').courtHist['5']).length===4&&w.gF('g1').court['5'].pos.indexOf('a8')>=0, 'estado local: courtHist e quadra derivada seguem o banco');
    // ponto marcado NAO cria entrada (quadra derivada do sq)
    w.S.sp='a2'; w.S.sa='ataque'; w.rcO('Ponto');
    chk(hist(5).length===4, 'ponto (side-out que roda) NAO grava historico — so edicoes manuais');

    console.log('\n--- 5. zerar set limpa srv0 e historico; serializacao preserva os campos ---');
    w.resetSet(); var okBtn=w.document.getElementById('rsConfirmOk'); if(okBtn)okBtn.onclick();
    d=getAt(G);
    chk(d.ss[4].u===0&&d.ss[4].srv0===undefined&&!(d.courtHist&&d.courtHist['5'])&&!(d.court&&d.court['5']), 'zerar set 5: placar, srv0, quadra e historico do set apagados');
    chk(d.ss[1].srv0==='t'&&d.ss[0].srv0==='u', 'sets anteriores intactos');
    var ser=w._gmSerialize(w.gF('g1'));
    chk(ser.ss[0].srv0==='u'&&ser.ss[1].srv0==='t'&&ser.ss[0].sqk===undefined, '_gmSerialize leva srv0 (e nao leva campos internos)');

    console.log('\n--- 6. modo tablet: chip na coluna de controles ---');
    try{w.localStorage.setItem('rs_scout_tablet','1');}catch(e){}
    // o tablet liga o modo quadra sozinho e so mostra os controles com a quadra escalada (set 5 foi zerado)
    w.render(); ['a1','a2','a3','a4','a5','a6'].forEach(function(aid,i){w.courtDraftPlace(aid);w.courtDraftCell(i);});
    w.courtDraftServer('them'); w.courtConfirmSetup(); w.render();
    var tc=w.document.querySelector('.sct-srv0');
    chk(!!tc&&tc.querySelectorAll('button').length===2&&tc.querySelectorAll('button')[1].className==='on'&&!tc.classList.contains('miss'), 'tablet: escalou com "eles sacam" -> chip com o adversario marcado (sem aviso)');
    w.setSrv0('t'); w.render(); tc=w.document.querySelector('.sct-srv0');
    chk(!!tc&&tc.classList.contains('miss')&&tc.querySelectorAll('button.on').length===0&&getAt(G).ss[4].srv0===undefined, 'tablet: tocar de novo desmarca -> borda de aviso e ss/4/srv0 apagado');

    console.log('\n=== test_srv0_courthist: '+ok+' OK, '+ko+' FAIL ===');
    process.exit(ko?1:0);
  }catch(e){console.log('FAIL exception: '+e.message);console.log((e.stack||'').split('\n').slice(0,6).join('\n'));process.exit(1);}
},400);
