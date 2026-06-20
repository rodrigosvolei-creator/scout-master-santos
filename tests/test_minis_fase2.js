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
global.firebaseMock={initializeApp:()=>{},database:()=>({ref:makeRef}),auth:()=>({onAuthStateChanged:function(cb){setTimeout(()=>cb(null),0);},signInWithPopup:()=>Promise.resolve(),signOut:()=>Promise.resolve()})};

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

    console.log('\n=== '+ok+' ok, '+ko+' falhas ===');
    console.log(ko===0?'OK MINIS FASE 2 APROVADA':'FAIL MINIS FASE 2 REPROVADA');
    process.exit(ko===0?0:1);
  } catch(e){
    console.log('ERRO GERAL: '+e.message);
    console.log(e.stack);
    process.exit(1);
  }
},700);
