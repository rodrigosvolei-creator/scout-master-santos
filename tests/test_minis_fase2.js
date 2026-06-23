// Fase 2 — Scout das 2 equipes (minis). Seletor de lado (A/B), placar credita
// o lado certo (Ponto = equipe marcada; Erro = adversaria), acao etiquetada com
// a.side. REGRESSAO: jogo normal (sem tidB) segue 1 lado, sem seletor.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');

const fakeDB = {};
const listeners = {};
function getAt(p){const a=p.split('/');let c=fakeDB;for(const k of a){if(c==null)return null;c=c[k];}return c===undefined?null:c;}
function setAt(p,v){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}c[a[a.length-1]]=JSON.parse(JSON.stringify(v));}
function makeRef(p){return{_path:p,on:function(e,cb){listeners[p]=cb;},once:function(){return Promise.resolve({val:()=>getAt(p)});},set:function(v){setAt(p,v);return Promise.resolve();},update:function(){return Promise.resolve();}};}
global.firebaseMock={initializeApp:()=>{},database:()=>({ref:makeRef}),auth:()=>({onAuthStateChanged:function(cb){setTimeout(()=>cb({uid:'tester',email:'rodrigosvolei@gmail.com',displayName:'Tester'}),0);},signInWithPopup:()=>Promise.resolve(),signOut:()=>Promise.resolve()})};

const seed = { 'torneio-master-santos': {
  teams:[{id:'trs',n:'RS FEM',c:'#db2777',roster:[{aid:'r1'},{aid:'r2'}]}],
  athletes:[{aid:'r1',nm:'Rosa',po:'P'},{aid:'r2',nm:'Lia',po:'C'}],
  tournaments:[{id:'tRS',n:'Liga'}],
  games:[{id:'g_normal',torId:'tRS',tid:'trs',opp:'Outro',st:'live',ss:[{u:0,t:0}],act:[],lineup:[{aid:'r1',nu:7},{aid:'r2',nu:5}]}],
  invites:{} } };
Object.assign(fakeDB, JSON.parse(JSON.stringify(seed)));

const htmlMod = html
  .replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>/g,'')
  .replace('firebase.initializeApp(fc);','var firebase=window.firebaseMock; firebase.initializeApp(fc);');

const dom = new JSDOM(htmlMod, {
  url: 'https://master.associacaoscoladevoleibol.com.br/?torneio=minis',
  runScripts: 'dangerously', pretendToBeVisual: true,
  beforeParse(window){
    window.firebaseMock = global.firebaseMock;
    window.AudioContext = function(){return{createOscillator:()=>({connect:()=>{},frequency:{},start:()=>{},stop:()=>{}}),createGain:()=>({connect:()=>{},gain:{}}),destination:{},currentTime:0};};
    window.navigator.vibrate = ()=>{};
    window.alert=()=>{};
  }
});
const w = dom.window;
let ok=0, ko=0;
function chk(c,m){if(c){ok++;console.log('OK   '+m);}else{ko++;console.log('FAIL '+m);}}

setTimeout(()=>{
  try {
    ['teams','games','tournaments','athletes','invites'].forEach(k=>{
      const path='torneio-master-santos/'+k;
      if(listeners[path]) listeners[path]({val:()=>getAt(path)});
    });
    w.isScouter=true;
    w.ensureStandaloneTeams(w.TOURNEY_ACCESS.minis);

    // cria jogo Colombia x Portugal (single 21)
    w.openMinisNovoJogo('');
    w.document.getElementById('mn-a').value='t_minis_col';
    w.document.getElementById('mn-b').value='t_minis_por';
    w.document.getElementById('mn-dt').value='2026-06-20';
    w.document.getElementById('mn-fmt').value='single';
    w.document.getElementById('mn-pts').value='21';
    w.salvarMinisJogo('');
    var g=w.D.games.filter(function(x){return x.tid==='t_minis_col'&&x.tidB==='t_minis_por';})[0];
    chk(!!g,'jogo minis 2 lados criado');
    var aA=g.lineup[0].aid, aB=g.lineupB[0].aid; // 1a atleta de cada lado
    w.openG(g.id); w.startG();
    chk(w.gF(g.id).st==='live','jogo ao vivo');

    // 1. setScoutSide
    chk(typeof w.setScoutSide==='function','setScoutSide existe');
    w.setScoutSide('B'); chk(w.S.side==='B' && w.S.sp===null,'setScoutSide(B): lado B + limpa selecao');
    w.setScoutSide('A'); chk(w.S.side==='A','setScoutSide(A): volta pro lado A');

    // 2. Lado A: ataque-Ponto -> placar da CASA (ss.u)
    w.S.sp=aA; w.S.sa='ataque'; w.rcO('Ponto');
    var ss=w.gF(g.id).ss[0];
    chk(ss.u===1 && ss.t===0,'lado A ataque-Ponto: +1 casa (u=1,t=0)');
    var lastA=w.gF(g.id).act[w.gF(g.id).act.length-1];
    chk(lastA.side==='A','acao etiquetada side=A');

    // 3. Lado B: ataque-Ponto -> placar de PORTUGAL (ss.t) [invertido]
    w.setScoutSide('B'); w.S.sp=aB; w.S.sa='ataque'; w.rcO('Ponto');
    ss=w.gF(g.id).ss[0];
    chk(ss.u===1 && ss.t===1,'lado B ataque-Ponto: +1 Portugal (u=1,t=1)');
    var lastB=w.gF(g.id).act[w.gF(g.id).act.length-1];
    chk(lastB.side==='B','acao etiquetada side=B');

    // 4. Lado B: saque-Erro -> ponto pro ADVERSARIO (casa A)
    w.setScoutSide('B'); w.S.sp=aB; w.S.sa='saque'; w.rcO('Erro');
    ss=w.gF(g.id).ss[0];
    chk(ss.u===2 && ss.t===1,'lado B saque-Erro: ponto vai pra casa (u=2,t=1)');

    // 5. Lado A: saque-Erro -> ponto pro adversario (Portugal B)
    w.setScoutSide('A'); w.S.sp=aA; w.S.sa='saque'; w.rcO('Erro');
    ss=w.gF(g.id).ss[0];
    chk(ss.u===2 && ss.t===2,'lado A saque-Erro: ponto vai pro Portugal (u=2,t=2)');

    // 6. undo reverte o ultimo ponto (do lado certo)
    w.undo();
    ss=w.gF(g.id).ss[0];
    chk(ss.u===2 && ss.t===1,'undo: reverte o ultimo ponto (t volta a 1)');

    // 7. rSct: seletor das 2 equipes + troca de atletas por lado
    w.setScoutSide('A');
    var hA=w.rSct();
    chk(hA.indexOf("setScoutSide('A')")>=0 && hA.indexOf("setScoutSide('B')")>=0,'rSct: botoes das 2 equipes');
    chk(hA.indexOf('RAICA')>=0,'rSct lado A: mostra atleta da Colombia (RAICA)');
    w.setScoutSide('B');
    var hB=w.rSct();
    chk(hB.indexOf('DUDA')>=0,'rSct lado B: mostra atleta de Portugal (DUDA)');

    // 8. REGRESSAO: jogo normal (sem tidB) — scout 1 lado intacto
    w.openG('g_normal');
    w.S.sp='r1'; w.S.sa='ataque'; w.rcO('Ponto');
    var gn=w.gF('g_normal');
    chk(gn.ss[0].u===1,'jogo normal: ataque-Ponto +1 nosso (1 lado intacto)');
    var lastN=gn.act[gn.act.length-1];
    chk(lastN.side===undefined,'jogo normal: acao NAO recebe side (sem tidB)');
    var hn=w.rSct();
    chk(hn.indexOf("setScoutSide(")<0,'jogo normal: SEM seletor de equipe');

    // 9. Isolamento: seleçao de scout no torneioMode NAO vaza jogo do app principal
    var fut=new Date(); fut.setDate(fut.getDate()+2); var fds=fut.toISOString().slice(0,10);
    w.D.games.push({id:'g_rs_fut',torId:'tRS',tid:'trs',opp:'TimeRSxyz',st:'pending',dt:fds,tm:'10:00',ss:[{u:0,t:0}],act:[],lineup:[]});
    w.torneioMode=true; w.torneioId='t_minis_open'; w.scoutPeriod=30;
    var sel=w.renderScoutSelection();
    chk(sel.indexOf('TimeRSxyz')<0,'torneioMode: seleçao de scout NAO mostra jogo do app principal (RS)');

    // 10. PDF da partida 2 lados: uma tabela por equipe (Colombia + Portugal)
    var _pdf=''; var _orig=w.openPdfOverlay; w.openPdfOverlay=function(html){_pdf=html||'';};
    w.exGamePDF(g.id);
    w.openPdfOverlay=_orig;
    chk(_pdf.indexOf('RS COLOMBIA')>=0 && _pdf.indexOf('RS PORTUGAL')>=0,'PDF: secoes das 2 equipes (Colombia + Portugal)');
    chk(_pdf.indexOf('RAICA')>=0 && _pdf.indexOf('DUDA')>=0,'PDF: atletas de cada equipe aparecem (RAICA / DUDA)');
    chk(_pdf.indexOf('>null<')<0 && _pdf.indexOf('#null')<0,'PDF: nao mostra "null" no numero (minis sem numero)');

    // 11. WhatsApp (exG) 2 lados: uma secao por equipe
    var _wa=''; var _oo=w.open; w.open=function(url){_wa=decodeURIComponent(url||'');};
    w.exG(g.id);
    w.open=_oo;
    chk(_wa.indexOf('RS COLOMBIA')>=0 && _wa.indexOf('RS PORTUGAL')>=0,'WhatsApp: secoes das 2 equipes');
    chk(_wa.indexOf('RAICA')>=0 && _wa.indexOf('DUDA')>=0,'WhatsApp: atletas de cada equipe (RAICA / DUDA)');
    chk(_wa.indexOf('#null')<0,'WhatsApp: sem "#null" no numero');

    // 12. PDF detalhamento por set separado por equipe (jogo bo3)
    w.D.games.push({id:'g_set',torId:'t_minis_open',tid:'t_minis_col',tidB:'t_minis_por',opp:'RS PORTUGAL',oppLogoData:'data:image/x;base64,Zg==',st:'live',format:'bo3',maxSets:3,setPoints:21,tiePoints:15,
      lineup:[{aid:'t_minis_col_a0',nu:null},{aid:'t_minis_col_a1',nu:null}],
      lineupB:[{aid:'t_minis_por_a0',nu:null},{aid:'t_minis_por_a1',nu:null}],
      ss:[{u:21,t:10},{u:15,t:21}],
      act:[{id:'x1',pid:'t_minis_col_a0',ak:'ataque',oc:'Ponto',set:1,side:'A'},
           {id:'x2',pid:'t_minis_por_a0',ak:'ataque',oc:'Ponto',set:1,side:'B'},
           {id:'x3',pid:'t_minis_col_a1',ak:'saque',oc:'Erro',set:2,side:'A'},
           {id:'x4',pid:'t_minis_por_a1',ak:'ataque',oc:'Ponto',set:2,side:'B'}]});
    var _pdf2=''; var _o2=w.openPdfOverlay; w.openPdfOverlay=function(html){_pdf2=html||'';};
    w.exGamePDF('g_set');
    w.openPdfOverlay=_o2;
    chk(_pdf2.indexOf('Detalhamento por set')>=0,'PDF: secao detalhamento por set (bo3)');
    chk(/SET 1[^<]*RS COLOMBIA/.test(_pdf2) && /SET 1[^<]*RS PORTUGAL/.test(_pdf2),'PDF: SET 1 separado por equipe (Colombia + Portugal)');
    chk(/SET 2[^<]*RS PORTUGAL/.test(_pdf2),'PDF: SET 2 com a equipe certa (Portugal)');

    // 13. pdfTeamLogo usa o escudo da equipe da casa (brandLogoData), nao o generico
    chk(w.pdfTeamLogo(w.gF(g.id))===w.tF('t_minis_col').brandLogoData,'PDF: logo da casa = escudo da equipe (brandLogoData), nao o generico');

    // 14. Telao: segue o jogo AO VIVO do torneio (read-only, troca sozinho)
    w.telaoMode=true; w.telaoToken='minis'; w.telaoTorId='t_minis_open';
    w.gF(g.id).st='live'; w.gF(g.id).ss=[{u:15,t:9}];
    var tela=w.renderTelao();
    chk(tela.indexOf('AO VIVO')>=0,'telao: badge AO VIVO');
    chk(tela.indexOf('RS COLOMBIA')>=0 && tela.indexOf('RS PORTUGAL')>=0,'telao: as 2 equipes do jogo ao vivo');
    chk(tela.indexOf('>15<')>=0 && tela.indexOf('>9<')>=0,'telao: placar do set atual (15 x 9)');
    chk(tela.indexOf('TORNEIO MINIS RS')>=0,'telao: titulo do torneio');
    // sem jogo ao vivo -> aguardando proximo
    w.D.games.forEach(function(x){ if(x.torId==='t_minis_open' && x.st==='live') x.st='done'; });
    chk(w.renderTelao().indexOf('Aguardando')>=0,'telao: sem ao vivo -> aguardando proximo jogo');
    w.telaoMode=false;

    // 15. Reatribuir acoes (corrigir atleta errado): move tudo de X pra Y; placar nao muda
    var gg=w.gF(g.id);
    var ssBefore=JSON.stringify(gg.ss);
    var fromA=aA, toA=gg.lineup[1].aid; // RAICA -> MARCOS (mesma equipe Colombia)
    var nBefore=gg.act.filter(function(x){return x.pid===fromA;}).length;
    var moved=w.reassignActions(g.id, fromA, toA);
    chk(nBefore>0 && moved===nBefore,'reassign: moveu todas as acoes do atleta errado ('+moved+')');
    chk(gg.act.filter(function(x){return x.pid===fromA;}).length===0,'reassign: atleta errado fica sem acoes');
    chk(gg.act.filter(function(x){return x.pid===toA;}).length>=moved,'reassign: atleta certo recebe as acoes');
    chk(JSON.stringify(gg.ss)===ssBefore,'reassign: placar NAO muda (e por equipe)');

    // 16. Reatribuir pra atleta de OUTRA equipe (emprestado) — mantem o lado
    var aPor=gg.lineupB[0].aid; // DUDA (Portugal, lado B) tem acoes
    var actPor=gg.act.filter(function(x){return x.pid===aPor;});
    var sideBefore=actPor.length?actPor[0].side:null;
    var holAid='t_minis_hol_a0'; // atleta de outra equipe (Holanda)
    var nm2=w.reassignActions(g.id, aPor, holAid);
    chk(nm2>0,'reassign cross-team: moveu acoes do emprestado pra atleta de outra equipe');
    var mAct=gg.act.filter(function(x){return x.pid===holAid;})[0];
    chk(mAct && mAct.side===sideBefore,'reassign cross-team: MANTEM o lado (so a pessoa muda)');

    // 17. Criar atleta novo numa equipe e reatribuir pra ele
    var newId=w.createMinisAthlete('t_minis_col','NOVATO');
    chk(!!newId && !!w.aFind(newId) && w.aFind(newId).nm==='NOVATO','createMinisAthlete: cria atleta na equipe');
    chk(w.tF('t_minis_col').roster.some(function(r){return r.aid===newId;}),'createMinisAthlete: entra no roster da equipe');

    // 18. Reatribuir POR SET (cenario real: set1 14->12, set5 14->5)
    w.D.games.push({id:'g_set2',torId:'t_minis_open',tid:'t_minis_col',tidB:'t_minis_por',opp:'RS PORTUGAL',st:'done',format:'bo5',maxSets:5,
      lineup:[{aid:'t_minis_col_a0',nu:14},{aid:'t_minis_col_a1',nu:12},{aid:'t_minis_col_a2',nu:5}],
      lineupB:[{aid:'t_minis_por_a0',nu:1}],
      ss:[{u:0,t:0},{u:0,t:0},{u:0,t:0},{u:0,t:0},{u:0,t:0}],
      act:[{id:'s1a',pid:'t_minis_col_a0',ak:'ataque',oc:'Ponto',set:1,side:'A'},
           {id:'s1b',pid:'t_minis_col_a0',ak:'ataque',oc:'Ponto',set:1,side:'A'},
           {id:'s5a',pid:'t_minis_col_a0',ak:'ataque',oc:'Ponto',set:5,side:'A'}]});
    var gset=w.gF('g_set2');
    chk(w.reassignActions('g_set2','t_minis_col_a0','t_minis_col_a1',99)===0,'por set: set inexistente nao move nada');
    var mv1=w.reassignActions('g_set2','t_minis_col_a0','t_minis_col_a1',1); // set1: 14->12
    chk(mv1===2,'por set: set 1 moveu as 2 acoes (14->12)');
    chk(gset.act.filter(function(x){return x.pid==='t_minis_col_a1'&&x.set===1;}).length===2,'set 1 agora no #12');
    chk(gset.act.filter(function(x){return x.pid==='t_minis_col_a0'&&x.set===5;}).length===1,'set 5 do #14 intacto');
    var mv5=w.reassignActions('g_set2','t_minis_col_a0','t_minis_col_a2',5); // set5: 14->5
    chk(mv5===1,'por set: set 5 moveu 1 acao (14->5)');
    chk(gset.act.filter(function(x){return x.pid==='t_minis_col_a0';}).length===0,'#14 sem acoes apos os 2 sets corrigidos');

    console.log('\n=== '+ok+' ok, '+ko+' falhas ===');
    console.log(ko===0?'OK MINIS FASE 2 APROVADA':'FAIL MINIS FASE 2 REPROVADA');
    process.exit(ko===0?0:1);
  } catch(e){
    console.log('ERRO GERAL: '+e.message);
    console.log(e.stack);
    process.exit(1);
  }
},700);
