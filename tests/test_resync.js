// REPRO + fix do bug real de producao: 2o aparelho abre o jogo, fica em BACKGROUND (Safari iOS
// suspende a aba e para o listener do RTDB); outro aparelho escala+marca; ao voltar, a tela
// mostrava DADOS VELHOS (0x0 / "Posicionar o time"). _resyncGames() (visibilitychange/focus/online)
// re-le os jogos e re-renderiza. Court no formato REAL do Firebase (array [null,{...}]).
const fs=require('fs'); const {JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const fakeDB={}; const listeners={};
function getAt(p){const a=p.split('/');let c=fakeDB;for(const k of a){if(c==null)return null;c=c[k];}return c===undefined?null:c;}
function setAt(p,v){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}c[a[a.length-1]]=JSON.parse(JSON.stringify(v));}
function makeRef(p){return{_path:p,on:function(e,cb){(listeners[p]=listeners[p]||[]).push(cb);cb({val:()=>getAt(p)});},once:function(){return Promise.resolve({val:()=>getAt(p)});},set:function(v){setAt(p,v);return Promise.resolve();},update:function(){return Promise.resolve();}};}
const mock={initializeApp:()=>{},database:()=>({ref:makeRef}),auth:()=>({onAuthStateChanged:function(cb){setTimeout(()=>cb({uid:'m',email:'rodrigosvolei@gmail.com',displayName:'M'}),0);},signInWithPopup:()=>Promise.resolve(),signOut:()=>Promise.resolve()})};

const seed={'torneio-master-santos':{
  teams:[{id:'trs',n:'RS FEM E',c:'#db2777',roster:[1,2,3,4,5,6].map(i=>({aid:'a'+i}))}],
  athletes:[1,2,3,4,5,6].map(i=>({aid:'a'+i,nm:'Atleta '+i,po:'Ponta',nu:i})),
  tournaments:[{id:'tRS',n:'Indiano',layout:'gameday'}],
  games:[{id:'g1',torId:'tRS',tid:'trs',opp:'tes',st:'live',ss:[{u:0,t:0}],act:[],courtMode:true,
          lineup:[1,2,3,4,5,6].map(i=>({aid:'a'+i,nu:i}))}],
  invites:{}}};
Object.assign(fakeDB,JSON.parse(JSON.stringify(seed)));

const htmlMod=html.replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>/g,'').replace('firebase.initializeApp(fc);','var firebase=window.__mock; firebase.initializeApp(fc);');
function makeLS(){var m={rs_scout_tablet:'1'};return{getItem:k=>k in m?m[k]:null,setItem:(k,v)=>{m[k]=String(v);},removeItem:k=>{delete m[k];},clear:()=>{m={};}};}
const dom=new JSDOM(htmlMod,{url:'https://scout.rsvoleibol.com.br/',runScripts:'dangerously',pretendToBeVisual:true,
  beforeParse(window){window.__mock=mock;var ls=makeLS();try{Object.defineProperty(window,'localStorage',{value:ls,configurable:true});}catch(e){}
    window.AudioContext=function(){return{createOscillator:()=>({connect:()=>{},frequency:{},start:()=>{},stop:()=>{}}),createGain:()=>({connect:()=>{},gain:{}}),destination:{},currentTime:0};};
    window.navigator.vibrate=()=>{};window.alert=()=>{};}});
const w=dom.window;
let ok=0,ko=0; function chk(c,m){if(c){ok++;console.log('OK   '+m);}else{ko++;console.log('FAIL '+m);}}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

(async function(){
 try{
  await sleep(120);
  ['teams','games','tournaments','athletes','invites'].forEach(k=>{var p='torneio-master-santos/'+k;(listeners[p]||[]).forEach(cb=>cb({val:()=>getAt(p)}));});
  w.currentUser={uid:'m',email:'rodrigosvolei@gmail.com'};

  // Celular abre o jogo (0x0, sem escalar) -> tela de posicionar (correto nesse instante)
  w.openGameDayCard('g1'); w.tab='scout'; w.render();
  var h0=w.document.getElementById('mainApp').innerHTML;
  chk(h0.indexOf('Posicionar o time')>=0, 'inicio: jogo 0x0 sem escalar -> mostra "Posicionar o time"');

  // OUTRO aparelho escala + marca. Substitui o array de jogos no Firebase por um NOVO
  // (a D.games do celular continua apontando pro array ANTIGO -> fica STALE, como no app real
  // quando a aba esta suspensa e o listener .on nao re-dispara).
  var g1novo=JSON.parse(JSON.stringify(getAt('torneio-master-santos/games/0')));
  g1novo.court=[null,{pos:['a1','a2','a3','a4','a5','a6'],serving:'us'}]; // formato REAL do Firebase (array)
  g1novo.ss=[{u:5,t:3,sq:['u','u','t','u','t','u','u','t']}];
  g1novo.act=[{id:'x1',pid:'a1',ak:'ataque',oc:'Ponto',set:1}];
  fakeDB['torneio-master-santos'].games=[g1novo];

  // Aba ainda em background: a tela do celular continua VELHA (nao sabe do update) -> o BUG
  w.render();
  var h1=w.document.getElementById('mainApp').innerHTML;
  chk(h1.indexOf('Posicionar o time')>=0, 'background (sem re-sync): tela AINDA mostra "Posicionar o time" (dados velhos = o bug)');

  // Volta ao foco -> _resyncGames re-le os jogos do Firebase e re-renderiza
  chk(typeof w._resyncGames==='function', '_resyncGames existe (handler de visibilitychange/focus/online)');
  w._resyncGames();
  await sleep(60);
  var h2=w.document.getElementById('mainApp').innerHTML;
  chk(h2.indexOf('Posicionar o time')<0, 'apos voltar ao foco: NAO mostra mais "Posicionar o time" (re-sincronizou)');
  chk(h2.indexOf('sct-body')>=0, 'apos re-sync: mostra o scout de verdade (3 colunas)');
  var g=w.gF('g1');
  chk(g && g.ss && g.ss[0] && g.ss[0].u===5 && g.ss[0].t===3, 'apos re-sync: placar 5-3 sincronizado');
  chk(g && g.court && (g.court[1]||g.court['1']), 'apos re-sync: court escalado presente');

  console.log('\n=== test_resync: '+ok+' OK, '+ko+' FAIL ===');
  process.exit(ko>0?1:0);
 }catch(e){console.log('FAIL exception:',e.message);console.log((e.stack||'').split('\n').slice(0,6).join('\n'));process.exit(1);}
})();
