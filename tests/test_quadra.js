// Q0 — Fundacao da quadra: rotacao pura + regra side-out.
// Asserta: rotateCourt (horario), rotateCourtBack (inverso, ida+volta=identidade),
// courtApplyPoint nos 4 casos, sequencia realista de pontos, e no-op fora do courtMode.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');

const fakeDB = {};
const listeners = {};
function getAt(p){const a=p.split('/');let c=fakeDB;for(const k of a){if(c==null)return null;c=c[k];}return c===undefined?null:c;}
function setAt(p,v){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}c[a[a.length-1]]=JSON.parse(JSON.stringify(v));}
function makeRef(p){return{_path:p,on:function(e,cb){listeners[p]=cb;},once:function(){return Promise.resolve({val:()=>getAt(p)});},set:function(v){setAt(p,v);return Promise.resolve();},update:function(){return Promise.resolve();}};}
global.firebaseMock={initializeApp:()=>{},database:()=>({ref:makeRef}),auth:()=>({onAuthStateChanged:function(cb){setTimeout(()=>cb({uid:'tester',email:'rodrigosvolei@gmail.com',displayName:'Tester'}),0);},signInWithPopup:()=>Promise.resolve(),signOut:()=>Promise.resolve()})};

const seed = {
  'torneio-master-santos': {
    teams:[{id:'trs',n:'FEM RS',c:'#db2777',roster:[{aid:'a1'}]}],
    athletes:[{aid:'a1',nm:'Ana'}],
    tournaments:[{id:'tA',n:'Liga'}],
    games:[
      {id:'g_court',torId:'tA',tid:'trs',opp:'X',dt:'2026-07-10',tm:'10:00',st:'live',
        courtMode:true, court:{ "1":{pos:["p1","p2","p3","p4","p5","p6"], serving:"us"} },
        ss:[{u:0,t:0}], act:[], lineup:[{aid:'a1',nu:1}]}
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
function eq(a,b){return JSON.stringify(a)===JSON.stringify(b);}

setTimeout(()=>{
  try {
    ['teams','games','tournaments','athletes','invites'].forEach(k=>{
      const path='torneio-master-santos/'+k;
      if(listeners[path]) listeners[path]({val:()=>getAt(path)});
    });

    // 1. Funcoes existem
    chk(typeof w.rotateCourt==='function','rotateCourt existe');
    chk(typeof w.rotateCourtBack==='function','rotateCourtBack existe');
    chk(typeof w.courtApplyPoint==='function','courtApplyPoint existe');
    chk(typeof w.courtRegisterPoint==='function','courtRegisterPoint existe');

    // 2. Rotacao horaria: P2->P1 (sacador), P1->P6, etc.
    var base=["p1","p2","p3","p4","p5","p6"];
    var rot=w.rotateCourt(base);
    chk(eq(rot,["p2","p3","p4","p5","p6","p1"]),'rotateCourt: giro horario correto (p2 vira sacador)');
    chk(rot[0]==="p2",'rotateCourt: quem estava na P2 agora saca (P1)');
    chk(rot[5]==="p1",'rotateCourt: quem sacava (P1) foi pra P6');

    // 3. Inverso: ida + volta = identidade
    chk(eq(w.rotateCourtBack(w.rotateCourt(base)),base),'rotateCourtBack desfaz rotateCourt (identidade)');
    chk(eq(w.rotateCourt(w.rotateCourtBack(base)),base),'rotateCourt desfaz rotateCourtBack (identidade)');

    // 4. 6 rotacoes seguidas = volta ao inicio
    var x=base.slice(); for(var i=0;i<6;i++)x=w.rotateCourt(x);
    chk(eq(x,base),'6 rotacoes completas voltam a formacao inicial');

    // 5. courtApplyPoint — os 4 casos
    var csUs={pos:base.slice(),serving:"us"};
    var csThem={pos:base.slice(),serving:"them"};
    // a) sacando nos + ponto nosso -> NAO roda
    var r1=w.courtApplyPoint(csUs,"us");
    chk(eq(r1.pos,base)&&r1.serving==="us",'sacando nos + ponto nosso => NAO roda, continua nosso saque');
    // b) eles sacando + ponto nosso -> RODA + serving us
    var r2=w.courtApplyPoint(csThem,"us");
    chk(eq(r2.pos,["p2","p3","p4","p5","p6","p1"])&&r2.serving==="us",'eles sacando + ponto nosso => RODA (side-out) e viramos sacadores');
    // c) sacando nos + ponto deles -> nao roda, perdemos saque
    var r3=w.courtApplyPoint(csUs,"them");
    chk(eq(r3.pos,base)&&r3.serving==="them",'sacando nos + ponto deles => nao rodamos, perdemos o saque');
    // d) eles sacando + ponto deles -> nada muda
    var r4=w.courtApplyPoint(csThem,"them");
    chk(eq(r4.pos,base)&&r4.serving==="them",'eles sacando + ponto deles => nada muda');

    // 6. Imutabilidade: nao muta o input
    chk(eq(csUs.pos,base)&&csUs.serving==="us",'courtApplyPoint nao muta o estado original (imutavel)');

    // 7. Sequencia realista: comecamos sacando (us). Perdemos, recuperamos, mantemos.
    var cs={pos:base.slice(),serving:"us"};
    cs=w.courtApplyPoint(cs,"us");   // ponto nosso, sacando -> nao roda
    chk(eq(cs.pos,base),'seq: 1o ponto nosso sacando -> sem rotacao');
    cs=w.courtApplyPoint(cs,"them"); // ponto deles -> perdemos saque
    chk(cs.serving==="them"&&eq(cs.pos,base),'seq: ponto deles -> perdemos saque, sem rotacao nossa');
    cs=w.courtApplyPoint(cs,"us");   // recuperamos -> RODA
    chk(cs.serving==="us"&&eq(cs.pos,["p2","p3","p4","p5","p6","p1"]),'seq: recuperamos o saque -> rotaciona 1x');
    cs=w.courtApplyPoint(cs,"us");   // mantemos -> nao roda
    chk(eq(cs.pos,["p2","p3","p4","p5","p6","p1"]),'seq: mantendo o saque -> sem nova rotacao');

    // 8. courtRegisterPoint atua no jogo (modo quadra) e retorna snapshot
    w.S={aid:'g_court',sp:null,sa:null,cs:1,us:[],tm:0,rn:false,ti:null};
    var gm=w.gF('g_court');
    gm.court["1"]={pos:base.slice(),serving:"them"}; // eles sacando
    var snap=w.courtRegisterPoint("u"); // ponto nosso -> deve rodar
    chk(!!snap && snap.serving==="them",'courtRegisterPoint retorna snapshot anterior (serving them)');
    chk(gm.court["1"].serving==="us" && eq(gm.court["1"].pos,["p2","p3","p4","p5","p6","p1"]),'courtRegisterPoint aplica rotacao no jogo (side-out)');

    // 9. No-op fora do modo quadra
    var gm2cfg={id:'g_nocourt',tid:'trs',torId:'tA',ss:[{u:0,t:0}],act:[],lineup:[]};
    w.D.games.push(gm2cfg);
    w.S={aid:'g_nocourt',sp:null,sa:null,cs:1,us:[],tm:0,rn:false,ti:null};
    var snap2=w.courtRegisterPoint("u");
    chk(snap2===null,'courtRegisterPoint e NO-OP em jogo sem courtMode (retorna null)');

    // 10. courtCur
    w.S={aid:'g_court',sp:null,sa:null,cs:1,us:[],tm:0,rn:false,ti:null};
    chk(!!w.courtCur(w.gF('g_court')),'courtCur retorna o estado do set atual no modo quadra');
    chk(w.courtCur(w.gF('g_nocourt'))===null,'courtCur retorna null fora do modo quadra');

    console.log('\n=== '+ok+' ok, '+ko+' falhas ===');
    console.log(ko===0?'OK QUADRA Q0 APROVADA':'FAIL QUADRA Q0 REPROVADA');
    process.exit(ko===0?0:1);
  } catch(e){
    console.log('ERRO GERAL: '+e.message);
    console.log(e.stack);
    process.exit(1);
  }
},700);
