// Galeria-first: a navbar pos-login fica so com Torneios (galeria de cards) +
// Config p/ coord. As abas antigas (Scout/Agenda/Stats) saem da navegacao; o
// scout segue acessivel pelo fluxo Torneios -> jogo -> scout (roteamento e
// funcoes rSct/rAge/rSts preservados). Voltar do scout fecha o ciclo em Torneios.
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
  teams:[{id:'trs',n:'RS MASC',color:'#2563eb',roster:[{aid:'a1'}]}],
  athletes:[{aid:'a1',nm:'Atleta 1',po:'Ponta'}],
  tournaments:[{id:'t_live',n:'Liga',color:'#1d7a3a',st:'live',cat:'Adulto',season:'2026'}],
  games:[{id:'g1',torId:'t_live',tid:'trs',opp:'X',dt:'2026-06-01',tm:'10:00',st:'pending'}],
  invites:{}
}};
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
    window.alert=()=>{};
  }
});
const w = dom.window;
let ok=0, ko=0;
function chk(c,m){if(c){ok++;console.log('OK   '+m);}else{ko++;console.log('FAIL '+m);}}
function labels(){return Array.prototype.map.call(w.document.querySelectorAll('.app-tabs .tabl'),function(e){return e.textContent.trim();});}

setTimeout(function(){
  try{
    ['teams','games','tournaments','athletes','invites'].forEach(function(k){
      var path='torneio-master-santos/'+k; if(listeners[path]) listeners[path]({val:function(){return getAt(path);}});
    });

    chk(w.tab==='torneios','default tab = torneios (entra na galeria pos-login)');

    // Papel default
    w.render();
    var L1=labels();
    console.log('   navbar (papel default):', JSON.stringify(L1));
    chk(L1.indexOf('Scout')<0 && L1.indexOf('Agenda')<0 && L1.indexOf('Stats')<0,'sem Scout/Agenda/Stats na navbar (default)');
    chk(L1.indexOf('Torneios')>=0,'Torneios presente (default)');

    // Como coordenador
    w.isCoord=true; w.isAdmin=true; w.render();
    var L2=labels();
    console.log('   navbar (coord/admin):  ', JSON.stringify(L2));
    chk(L2.indexOf('Scout')<0 && L2.indexOf('Agenda')<0 && L2.indexOf('Stats')<0,'sem Scout/Agenda/Stats na navbar (coord)');
    chk(L2.indexOf('Torneios')>=0,'Torneios presente (coord)');
    chk(L2.indexOf('Config')>=0,'Config presente p/ coord (gestao preservada)');

    // Fluxo programatico Torneios->jogo->scout ainda roteia (roteamento preservado)
    w.setTab('scout');
    chk(w.tab==='scout','setTab(scout) ainda roteia (fluxo Torneios->jogo->scout intacto)');

    // Voltar do scout fecha o ciclo em torneios (nao na lista Scout)
    w.selTor='t_live'; if(w.S) w.S.aid=null;
    w.scoutBack();
    chk(w.tab==='torneios','scoutBack() volta pra Torneios (ciclo fechado, selTor preservado)');

    console.log('\n=== '+ok+' ok, '+ko+' falhas ===');
    console.log(ko===0?'OK GALERIA-FIRST APROVADA':'FAIL GALERIA-FIRST REPROVADA');
    process.exit(ko===0?0:1);
  }catch(e){ console.log('ERRO GERAL: '+e.message); console.log(e.stack); process.exit(1); }
},700);
