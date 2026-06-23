// Fase A2 - aba Torneios repaginada no tema escuro + tela inicial.
// Asserta: default tab = "torneios"; rTor emite classes rs-tor-*;
// rTorDetail wrapper rs-tor-detail; selectTor/voltar funciona; CSS presente.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');

const fakeDB = {};
const listeners = {};
function getAt(p){const a=p.split('/');let c=fakeDB;for(const k of a){if(c==null)return null;c=c[k];}return c===undefined?null:c;}
function setAt(p,v){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}c[a[a.length-1]]=JSON.parse(JSON.stringify(v));}
function makeRef(p){return{_path:p,on:function(e,cb){listeners[p]=cb;},once:function(){return Promise.resolve({val:()=>getAt(p)});},set:function(v){setAt(p,v);return Promise.resolve();},update:function(){return Promise.resolve();}};}
global.firebaseMock={initializeApp:()=>{},database:()=>({ref:makeRef}),auth:()=>({onAuthStateChanged:function(cb){setTimeout(()=>cb({uid:'tester',email:'rodrigosvolei@gmail.com',displayName:'Tester'}),0);},signInWithPopup:()=>Promise.resolve(),signOut:()=>Promise.resolve()})};

// Tres torneios em status diferentes pra cobrir os 3 grupos
const seed = {
  'torneio-master-santos': {
    teams:[{id:'trs',n:'RS-VOLEIBOL MASCULINO',c:'#2563eb',roster:[{aid:'a1'}]}],
    athletes:[{aid:'a1',nm:'Atleta 1',po:'Ponta'}],
    tournaments:[
      {id:'t_live',n:'Liga em Andamento',c:'#1d7a3a',color:'#1d7a3a',st:'live',cat:'Adulto',season:'2026'},
      {id:'t_pend',n:'Copa Programada',c:'#2563eb',color:'#2563eb',st:'pending',cat:'Sub-21',season:'2026',title:'Pré-Olímpico'},
      {id:'t_done',n:'Torneio Encerrado',c:'#64748b',color:'#64748b',st:'done',cat:'Master',season:'2025'}
    ],
    games:[
      {id:'g1',torId:'t_live',tid:'trs',opp:'X',dt:'2026-06-01',tm:'10:00',st:'pending'},
      {id:'g2',torId:'t_live',tid:'trs',opp:'Y',dt:'2026-05-15',tm:'10:00',st:'done',result:{type:'win',sets:'3x1'}}
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
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  beforeParse(window){
    window.firebaseMock = global.firebaseMock;
    window.AudioContext = function(){return{createOscillator:()=>({connect:()=>{},frequency:{},start:()=>{},stop:()=>{}}),createGain:()=>({connect:()=>{},gain:{}}),destination:{},currentTime:0};};
    window.navigator.vibrate = ()=>{};
  }
});
const w = dom.window;

let ok=0, ko=0;
function chk(c,m){if(c){ok++;console.log('OK   '+m);}else{ko++;console.log('FAIL '+m);}}

setTimeout(()=>{
  try {
    // 1. Default tab apos boot deve ser "torneios"
    chk(w.tab==='torneios','default tab e "torneios" (era "scout") — tela inicial pos-login');

    // 2. Entregar dados aos listeners
    ['teams','games','tournaments','athletes','invites'].forEach(k=>{
      const path='torneio-master-santos/'+k;
      if(listeners[path]) listeners[path]({val:()=>getAt(path)});
    });

    // 3. Sair do landing e renderizar shell em "torneios"
    w.showLanding=false; w.torneioMode=false; w.signupMode=false;
    w.tab='torneios'; w.selTor=null; w.render();

    const main = w.document.getElementById('mainApp').innerHTML;

    // 4. rTor emite o wrapper rs-tor-page
    chk(main.indexOf('rs-tor-page')>=0,'rTor() emite wrapper .rs-tor-page');

    // 5. CSS contem as regras Fase A2
    const css = htmlMod.match(/<style>([\s\S]*?)<\/style>/)[1];
    chk(css.indexOf('.rs-tor-card{')>=0,'CSS contem .rs-tor-card (cards escuros)');
    chk(css.indexOf('.rs-tor-group-title')>=0,'CSS contem .rs-tor-group-title');
    chk(css.indexOf('.rs-tor-newbtn')>=0,'CSS contem .rs-tor-newbtn (CTA dourado)');
    chk(css.indexOf('body.rs-shell .rs-tor-detail .cd{')>=0,'CSS overrides escopados em .rs-tor-detail .cd');

    // 6. Os tres grupos (live/programados/concluidos) devem aparecer como rs-tor-group
    const groupCount = (main.match(/rs-tor-group-title/g)||[]).length;
    chk(groupCount===3,'rTor mostra 3 grupos (live/programados/concluidos): '+groupCount);

    // 7. Cada torneio vira um card com topo colorido (cor do torneio no gradiente)
    const cardMatches = main.match(/rs-tor-card-top" style="background/g)||[];
    chk(cardMatches.length===3,'rTor renderiza 3 cards de torneio com topo colorido: '+cardMatches.length);

    // 8. NAO deve ter mais o estilo antigo "color:var(--navy)" nos grupos do rTor
    //    (ainda pode existir em outras areas — checagem mira so o bloco dos cards)
    chk(main.indexOf('color:var(--navy);margin:18px 0 10px')<0,'group-title antigo (color:var(--navy)) removido do rTor');

    // 9. Categoria do torneio aparece no card (rs-tor-card-cat2)
    chk(main.indexOf('rs-tor-card-cat2')>=0,'categoria no card (rs-tor-card-cat2)');

    // 10. Selecionar um torneio deve mudar selTor e renderizar o detalhe
    w.selectTor('t_live'); // funcao chama render() internamente
    chk(w.selTor==='t_live','selectTor("t_live") muda selTor');
    const main2 = w.document.getElementById('mainApp').innerHTML;
    chk(main2.indexOf('rs-tor-detail')>=0,'rTorDetail emite wrapper .rs-tor-detail');
    chk(main2.indexOf('Liga em Andamento')>=0,'rTorDetail mostra o nome do torneio selecionado');

    // 11. Voltar (selectTor(null)) deve voltar pra listagem
    w.selectTor(null);
    chk(w.selTor===null,'selectTor(null) zera selTor');
    const main3 = w.document.getElementById('mainApp').innerHTML;
    chk(main3.indexOf('rs-tor-page')>=0 && main3.indexOf('rs-tor-detail')<0,'apos voltar, volta pra rs-tor-page (listagem)');

    // 12. Mudar pra outra tab nao deve quebrar (regressao basica)
    w.setTab('agenda');
    chk(w.tab==='agenda','setTab("agenda") muda tab corretamente');
    w.setTab('torneios');
    chk(w.tab==='torneios','setTab("torneios") volta');

    // 13. Empty state (sem torneios) deve usar rs-tor-empty
    w.D.tournaments=[];
    w.render();
    const main4 = w.document.getElementById('mainApp').innerHTML;
    chk(main4.indexOf('rs-tor-empty')>=0,'empty state usa .rs-tor-empty');

    console.log('\n=== '+ok+' ok, '+ko+' falhas ===');
    console.log(ko===0?'OK FASE A2 APROVADA':'FAIL FASE A2 REPROVADA');
    process.exit(ko===0?0:1);
  } catch(e){
    console.log('ERRO GERAL: '+e.message);
    console.log(e.stack);
    process.exit(1);
  }
},700);
