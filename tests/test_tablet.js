// MODO TABLET (1 toque) — prova que scTap(ak,oc) == slP+slA+rcO (mesmo {pid,ak,oc,set}),
// o auto-sacador, a ladder (sq) mantida em rcO/scUp/scDn/undo, o toggle localStorage,
// e que o scout classico/placar nao e afetado.
// NB: o mock do Firebase deep-copia o jogo a cada saveGame (setAt JSON), entao o objeto
// retornado por gF muda de identidade apos cada save — por isso relemos gF a cada check
// (G()). No app real o objeto local persiste; o .on('value') reidrata assincrono e igual.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');

const fakeDB = {};
const listeners = {};
function getAt(p){const a=p.split('/');let c=fakeDB;for(const k of a){if(c==null)return null;c=c[k];}return c===undefined?null:c;}
function setAt(p,v){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}c[a[a.length-1]]=JSON.parse(JSON.stringify(v));}
function makeRef(p){return{_path:p,on:function(e,cb){listeners[p]=cb;},once:function(){return Promise.resolve({val:()=>getAt(p)});},set:function(v){setAt(p,v);return Promise.resolve();},update:function(){return Promise.resolve();}};}
global.firebaseMock={initializeApp:()=>{},database:()=>({ref:makeRef}),auth:()=>({onAuthStateChanged:function(cb){setTimeout(()=>cb({uid:'tester',email:'rodrigosvolei@gmail.com',displayName:'Tester'}),0);},signInWithPopup:()=>Promise.resolve(),signOut:()=>Promise.resolve()})};

const base=["a1","a2","a3","a4","a5","a6"];
const seed = {
  'torneio-master-santos': {
    teams:[{id:'trs',n:'RS VOLEIBOL',c:'#db2777',roster:[{aid:'a1'}]}],
    athletes:[{aid:'a1',nm:'Ana',po:'P'},{aid:'a2',nm:'Bia',po:'C'},{aid:'a3',nm:'Lui',po:'L'},{aid:'a4',nm:'Car',po:'C'},{aid:'a5',nm:'Dud',po:'O'},{aid:'a6',nm:'Fer',po:'P'},{aid:'a7',nm:'Gi',po:'P'}],
    tournaments:[{id:'tA',n:'Liga'}],
    games:[
      {id:'g_court',torId:'tA',tid:'trs',opp:'X',st:'live',courtMode:true,
        court:{ "1":{pos:base.slice(), serving:"us"} },
        ss:[{u:0,t:0}], act:[],
        lineup:[{aid:'a1',nu:1},{aid:'a2',nu:2},{aid:'a3',nu:3},{aid:'a4',nu:4},{aid:'a5',nu:5},{aid:'a6',nu:6},{aid:'a7',nu:7}]}
    ],
    invites:{}
  }
};
Object.assign(fakeDB, JSON.parse(JSON.stringify(seed)));

const htmlMod = html
  .replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>/g,'')
  .replace('firebase.initializeApp(fc);','var firebase=window.firebaseMock; firebase.initializeApp(fc);');

const dom = new JSDOM(htmlMod, {
  url: 'https://master.associacaoscoladevoleibol.com.br/',
  runScripts: 'dangerously', pretendToBeVisual: true,
  beforeParse(window){
    window.firebaseMock = global.firebaseMock;
    window.AudioContext = function(){return{createOscillator:()=>({connect:()=>{},frequency:{},start:()=>{},stop:()=>{}}),createGain:()=>({connect:()=>{},gain:{}}),destination:{},currentTime:0};};
    window.navigator.vibrate = ()=>{};
  }
});
const w = dom.window;

let ok=0, ko=0;
function chk(c,m){if(c){ok++;console.log('OK   '+m);}else{ko++;console.log('FAIL '+m);}}
function setS(){ w.S={aid:'g_court',sp:null,sa:null,cs:1,us:[],tm:0,rn:false,ti:null}; }
function G(){ return w.gF('g_court'); }                              // jogo VIVO (relido sempre)
function resetCourt(serving){ var g=G(); g.court={ "1":{pos:base.slice(),serving:serving||"us"} }; g.act=[]; g.ss=[{u:0,t:0}]; }
function last(){ var a=G().act; return a[a.length-1]; }

setTimeout(()=>{
  try {
    ['teams','games','tournaments','athletes','invites'].forEach(k=>{
      const path='torneio-master-santos/'+k;
      if(listeners[path]) listeners[path]({val:()=>getAt(path)});
    });
    w.isScouter=true;

    // 1. toggle localStorage (preferencia de dispositivo)
    try{w.localStorage.removeItem('rs_scout_tablet');}catch(e){}
    chk(w.isTabletMode()===false,'isTabletMode() false por padrao (sem localStorage)');
    w.toggleTabletMode();
    chk(w.isTabletMode()===true,'toggleTabletMode() liga (localStorage=1)');
    w.toggleTabletMode();
    chk(w.isTabletMode()===false,'toggleTabletMode() desliga (localStorage=0)');

    // 2. scTap == slP + slA + rcO  (mesma acao {pid,ak,oc,set})
    setS(); resetCourt("us");
    w.slP("a4"); w.slA("ataque"); w.rcO("Ponto");
    var ca=last();
    setS(); resetCourt("us");
    w.S.sp="a4"; w.scTap("ataque","Ponto");
    var ta=last();
    chk(ca&&ta&&ca.pid===ta.pid&&ca.ak===ta.ak&&ca.oc===ta.oc&&ca.set===ta.set,
        'scTap gera a MESMA acao que slP+slA+rcO {pid,ak,oc,set}');
    chk(ta.pid==='a4'&&ta.ak==='ataque'&&ta.oc==='Ponto'&&ta.set===1,'scTap: acao correta (a4/ataque/Ponto/set1)');

    // 3. auto-sacador: saque sem atleta selecionado, nosso serve -> vai no P1
    setS(); resetCourt("us"); // P1 = a1
    w.S.sp=null;
    w.scTap("saque","Ace");
    var sa=last();
    chk(sa&&sa.pid==='a1'&&sa.ak==='saque'&&sa.oc==='Ace','auto-sacador: saque sem selecao marca no P1 (a1)');

    // 4. fora do saque, scTap exige atleta selecionado (nao grava sem)
    setS(); resetCourt("us"); w.S.sp=null;
    var nb=G().act.length;
    w.scTap("ataque","Ponto");
    chk(G().act.length===nb,'scTap ataque SEM atleta: nao grava (exige selecao)');

    // 5. ladder (sq) cresce em scUp e bate com o placar
    setS(); resetCourt("us");
    w.scUp("u"); w.scUp("u"); w.scUp("t"); // 2-1
    chk((G().ss[0].sq||[]).join(",")==="u,u,t",'sq registra a sequencia de pontos (u,u,t)');
    var cols=w._buildLadder(G(),0);
    chk(cols.length===3,'ladder: 3 colunas pra 2-1');
    chk(cols[2].s==="t"&&cols[2].n===1,'ladder: 3a coluna = adversario, ponto numero 1');
    chk(cols[1].s==="u"&&cols[1].n===2,'ladder: 2a coluna = nosso, ponto numero 2');

    // 6. rcO mantem sq e undo reverte (placar + sq juntos)
    setS(); resetCourt("us");
    w.S.sp="a4"; w.S.sa="ataque"; w.rcO("Ponto"); // 1-0
    chk(G().ss[0].u===1 && (G().ss[0].sq||[]).join(",")==="u",'rcO ataque-ponto: placar 1-0 e sq=u');
    w.undo();
    chk(G().ss[0].u===0 && (G().ss[0].sq||[]).length===0,'undo: reverte placar E remove do sq');

    // 7. scDn remove a ultima ocorrencia daquele lado no sq
    setS(); resetCourt("us");
    w.scUp("t"); w.scUp("t"); // 0-2
    w.scDn("t"); // 0-1
    chk(G().ss[0].t===1 && (G().ss[0].sq||[]).join(",")==="t",'scDn: decrementa placar e remove do sq');

    // 8. fallback: jogo legado sem sq -> ladder completa pra bater com o placar
    var legacy={ss:[{u:2,t:1}]};
    var lcols=w._buildLadder(legacy,0);
    chk(lcols.length===3,'ladder fallback (sem sq): completa 3 colunas pra 2-1');

    // 9. REGRESSAO: jogo classico (sem courtMode) — scTap grava normal com atleta selecionado
    w.D.games.push({id:'g_cl',tid:'trs',torId:'tA',st:'live',ss:[{u:0,t:0}],act:[],lineup:[{aid:'a1',nu:1}]});
    w.S={aid:'g_cl',sp:'a1',sa:null,cs:1,us:[],tm:0,rn:false,ti:null};
    w.scTap("recepcao","A");
    var clg=w.gF('g_cl'); var cl=clg.act[clg.act.length-1];
    chk(cl&&cl.pid==='a1'&&cl.ak==='recepcao'&&cl.oc==='A','scTap funciona em jogo classico (com atleta selecionado)');

    // 10. REGRESSAO: placar do classico continua respondendo a scUp/scDn normalmente
    w.scUp("u"); chk(w.gF('g_cl').ss[0].u===1,'classico: scUp continua subindo o placar');
    w.scDn("u"); chk(w.gF('g_cl').ss[0].u===0,'classico: scDn continua descendo o placar');

    // 11. rotulo do passe (so o LABEL muda; o dado continua A/B/C)
    try{w.localStorage.setItem('rs_tablet_label','ABC');}catch(e){}
    chk(w.sctLblOf('A')==='A','rotulo ABC: A mostra "A"');
    try{w.localStorage.setItem('rs_tablet_label','VERB');}catch(e){}
    chk(w.sctLblOf('A')==='Perfeita'&&w.sctLblOf('B')==='Bom'&&w.sctLblOf('C')==='Ruim','rotulo VERB: A/B/C viram Perfeita/Bom/Ruim');
    chk(w.sctLblOf('Ace')==='Ace'&&w.sctLblOf('Ponto')==='Ponto','rotulo VERB nao afeta Ace/Ponto/Erro');
    try{w.localStorage.setItem('rs_tablet_label','ABC');}catch(e){}

    // 12. coluna esquerda quadra/lista (toggle, preferencia de dispositivo)
    try{w.localStorage.removeItem('rs_tablet_left');}catch(e){}
    chk(w.sctLeftMode()==='court','leftMode default = court');
    w.sctSetLeft('list'); chk(w.sctLeftMode()==='list','sctSetLeft(list) liga lista');
    w.sctSetLeft('court'); chk(w.sctLeftMode()==='court','sctSetLeft(court) volta quadra');

    // 13. libero: arma + entra no FUNDO + sai (mecanica do cs.libPair, reusa o modelo)
    setS(); resetCourt("us"); // pos=[a1..a6], a7 no banco
    w.sctLibArm("a7"); chk(w._sctLibArmed==="a7",'sctLibArm arma o libero');
    w.sctLibIn(4); // P5 = idx 4 (fundo) — entra no lugar de a5
    var cs5=G().court["1"];
    chk(cs5.pos[4]==="a7"&&cs5.libPair&&cs5.libPair.lib==="a7"&&cs5.libPair.out==="a5",'sctLibIn: libero entra no fundo (P5), libPair amarrado');
    chk(w._sctLibArmed===null,'sctLibIn limpa o armado');
    w.sctLibOut(); var cs6=G().court["1"];
    chk(cs6.pos[4]==="a5"&&!cs6.libPair,'sctLibOut: titular volta, libPair limpo');
    setS(); resetCourt("us"); w.sctLibArm("a7"); w.sctLibIn(2); // P3 = idx 2 (frente) -> rejeita
    var cs7=G().court["1"];
    chk(cs7.pos[2]==="a3"&&!cs7.libPair,'sctLibIn na FRENTE (P3): rejeitado (libero so no fundo)');

    // 14. teclado: atleta + fundamento (S/R/L/A/B/D) + qualidade (3/2/1/0) -> scTap
    try{w.localStorage.setItem('rs_scout_tablet','1');}catch(e){} // _sctKbActive exige tablet on
    function fakeKey(key){return {key:key,preventDefault:function(){},target:{tagName:'BODY'}};}
    setS(); resetCourt("us"); w.S.sp="a4";
    w._sctKeydown(fakeKey("a"));
    chk(w._sctKbFund==="ataque",'teclado: tecla A arma o fundamento ataque');
    var nb2=G().act.length; w._sctKeydown(fakeKey("3"));
    var la2=G().act, lact=la2[la2.length-1];
    chk(la2.length===nb2+1&&lact.pid==="a4"&&lact.ak==="ataque"&&lact.oc==="Ponto",'teclado: A depois 3 grava ataque Ponto do a4');
    chk(w._sctKbFund===null,'teclado: limpa o fundamento apos gravar');
    setS(); resetCourt("us"); w.S.sp=null; w._sctKeydown(fakeKey("a"));
    chk(w._sctKbFund===null,'teclado: fundamento sem atleta (e nao saque) nao arma');
    try{w.localStorage.setItem('rs_scout_tablet','0');}catch(e){}

    // 15. pedido de tempo: REGISTRA quantos cada lado pediu no set (nao bloqueia)
    setS(); resetCourt("us");
    w.sctTimeoutAdd("u"); w.sctTimeoutAdd("u"); w.sctTimeoutAdd("t");
    chk(G().ss[0].toU===2 && G().ss[0].toT===1,'timeout: registra 2 pedidos RS e 1 do adversario no set');
    var nbTo=G().act.length;
    chk(nbTo===0,'timeout NAO vira acao/estatistica (so contador)');
    w.closeSctTimeout();

    console.log('\n=== '+ok+' ok, '+ko+' falhas ===');
    console.log(ko===0?'OK MODO TABLET APROVADO':'FAIL MODO TABLET REPROVADO');
    process.exit(ko===0?0:1);
  } catch(e){
    console.log('ERRO GERAL: '+e.message);
    console.log(e.stack);
    process.exit(1);
  }
},700);
