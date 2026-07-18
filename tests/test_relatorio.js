// Relatorio VISUAL (time + individual) do dado real, com a REGUA do RS-SCOUT.
// Confere: regua por fundamento, "soma do time = soma dos atletas" (fecha),
// rating ofensivo (pontos) x libero (acertos), e que os HTMLs saem completos.
const fs=require('fs'); const {JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const fakeDB={}; const listeners={};
function getAt(p){const a=p.split('/');let c=fakeDB;for(const k of a){if(c==null)return null;c=c[k];}return c===undefined?null:c;}
function setAt(p,v){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}c[a[a.length-1]]=JSON.parse(JSON.stringify(v));}
function makeRef(p){return{_path:p,on:function(e,cb){listeners[p]=cb;},once:function(){return Promise.resolve({val:()=>getAt(p)});},set:function(v){setAt(p,v);return Promise.resolve();},update:function(){return Promise.resolve();}};}
global.firebaseMock={initializeApp:()=>{},database:()=>({ref:makeRef}),auth:()=>({onAuthStateChanged:function(cb){setTimeout(()=>cb({uid:'m',email:'rodrigosvolei@gmail.com',displayName:'M'}),0);},signInWithPopup:()=>Promise.resolve(),signOut:()=>Promise.resolve()})};

function pushN(arr,n,pid,ak,oc,set){for(let i=0;i<n;i++)arr.push({id:pid+ak+oc+set+i,pid:pid,ak:ak,oc:oc,set:set});}
const act=[];
// a1 atacante: ataque 5 Ponto +1 Erro; bloqueio 1 Ponto  -> pos6 err1 pontos6
pushN(act,5,'a1','ataque','Ponto',1);pushN(act,1,'a1','ataque','Erro',1);pushN(act,1,'a1','bloqueio','Ponto',2);
// a8 libero: recepcao 4A 2B 1Erro; defesa 2A            -> pos6 err1 pontos0 (offN=0)
pushN(act,4,'a8','recepcao','A',1);pushN(act,2,'a8','recepcao','B',1);pushN(act,1,'a8','recepcao','Erro',2);pushN(act,2,'a8','defesa','A',2);
// a3 central: bloqueio 2 Ponto +1 Erro; ataque 1 Ponto   -> pos3 err1 pontos3
pushN(act,2,'a3','bloqueio','Ponto',1);pushN(act,1,'a3','bloqueio','Erro',1);pushN(act,1,'a3','ataque','Ponto',2);
// erro do adversario (ponto do time, nao por atleta)
pushN(act,2,null,'erroadv','Ponto',1);

const seed={'torneio-master-santos':{
  teams:[{id:'trs',n:'RS Sorocaba',c:'#0e254c',roster:[{aid:'a1'},{aid:'a8'},{aid:'a3'}]}],
  athletes:[{aid:'a1',nm:'Mikael Souza',po:'Oposto(a)',nu:10},{aid:'a8',nm:'Igor Nunes',po:'Líbero',nu:16},{aid:'a3',nm:'Caio Reis',po:'Central',nu:4}],
  tournaments:[{id:'tA',n:'Liga'}],
  games:[{id:'g1',tid:'trs',torId:'tA',opp:'Cananéia',dt:'2026-06-28',st:'fin',
    ss:[{u:25,t:19,sq:[]},{u:25,t:22,sq:[]}],act:act,
    lineup:[{aid:'a1',nu:10,po:'Oposto(a)'},{aid:'a8',nu:16,po:'Líbero'},{aid:'a3',nu:4,po:'Central'}]}],
  invites:{}}};
Object.assign(fakeDB,JSON.parse(JSON.stringify(seed)));

const htmlMod=html.replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>/g,'').replace('firebase.initializeApp(fc);','var firebase=window.firebaseMock; firebase.initializeApp(fc);');
const dom=new JSDOM(htmlMod,{url:'https://master.exemplo.com.br/',runScripts:'dangerously',pretendToBeVisual:true,
  beforeParse(window){window.firebaseMock=global.firebaseMock;
    window.AudioContext=function(){return{createOscillator:()=>({connect:()=>{},frequency:{},start:()=>{},stop:()=>{}}),createGain:()=>({connect:()=>{},gain:{}}),destination:{},currentTime:0};};
    window.navigator.vibrate=()=>{};window.alert=()=>{};}});
const w=dom.window;
let ok=0,ko=0; function chk(c,m){if(c){ok++;console.log('OK   '+m);}else{ko++;console.log('FAIL '+m);}}

setTimeout(()=>{
 try{
  ['teams','games','tournaments','athletes','invites'].forEach(k=>{var p='torneio-master-santos/'+k;if(listeners[p])listeners[p]({val:()=>getAt(p)});});
  w.currentUser={uid:'m',email:'rodrigosvolei@gmail.com'};
  var g=w.gF('g1');

  chk(typeof w.repAgg==='function','repAgg existe');
  chk(typeof w.reportTeamHTML==='function','reportTeamHTML existe');
  chk(typeof w.reportPlayerHTML==='function','reportPlayerHTML existe');
  chk(typeof w.exTeamReport==='function' && typeof w.exPlayerReport==='function','exTeamReport/exPlayerReport existem');

  var agg=w.repAgg(g);
  var P={};agg.players.forEach(p=>P[p.pid]=p);
  // REGUA por atleta
  chk(P.a1.pos===6 && P.a1.err===1 && P.a1.pontos===6,'a1 atacante: pos6 err1 pontos6 (regua ataque=Ponto)');
  chk(P.a8.pos===6 && P.a8.err===1 && P.a8.pontos===0,'a8 libero: pos6 (4A+2def A? nao) — so A conta');
  chk(w._passA(P.a8)===4,'a8: passe positivo = so recepcao A (4), B nao conta');
  chk(P.a3.pos===3 && P.a3.err===1,'a3 central: pos3 err1');
  // REGUA DO SAQUE: positivo = NAO errar (colocar em jogo ja vale); o Ace e extra, so conta em pontos
  var sq=w.repAgg({},[{pid:'x',ak:'saque',oc:'Cont'},{pid:'x',ak:'saque',oc:'Cont'},{pid:'x',ak:'saque',oc:'Ace'},{pid:'x',ak:'saque',oc:'Erro'}]).players[0];
  chk(sq.pos===3 && sq.err===1,'saque: positivo = nao-erro (2 Cont + 1 Ace = 3 pos), erro 1');
  chk(Math.round(sq.byF.saque.pos/sq.byF.saque.n*100)===75,'saque indice = nao-erro/total = 3/4 = 75% (nao pune quem nao faz ace)');
  chk(sq.pontos===1,'saque: so o Ace conta como PONTO de placar (Cont/em jogo nao)');
  // FECHA: soma dos atletas = total do time
  var sp=0,se=0;agg.players.forEach(p=>{sp+=p.pos;se+=p.err;});
  chk(sp===agg.team.pos && se===agg.team.err,'FECHA: soma atletas (pos'+sp+' err'+se+') = time (pos'+agg.team.pos+' err'+agg.team.err+')');
  chk(agg.team.pos===15 && agg.team.err===3,'time: pos15 err3');
  chk(agg.team.aprov===Math.round(15/18*100),'time aproveitamento = acertos/(acertos+erros) = '+agg.team.aprov+'%');
  chk(agg.team.nScored===3 && agg.team.nPlayers===3,'pontuaram 3/3');
  // erroadv NAO entra por atleta
  chk(!agg.players.some(p=>p.pid==null),'erroadv nao cria atleta nulo');

  // ---- HTML TIME ----
  var htm=w.reportTeamHTML(g);
  chk(htm.indexOf('class="hero"')>=0 && htm.indexOf('2</span><span class="x">')>=0,'time: hero com placar 2 sets');
  chk(htm.indexOf('Tabela geral')>=0 && htm.indexOf('Top Ataque')>=0 && htm.indexOf('A régua do RS-SCOUT')>=0,'time: tabela + tops + regua');
  chk(htm.indexOf('exPlayerReport(')>=0,'time: nome do atleta clicavel -> exPlayerReport');
  chk(htm.indexOf('print-color-adjust:exact')>=0,'time: print-color-adjust:exact (salva com cor)');
  // tabela compacta com TODOS os fundamentos (colunas)
  chk(htm.indexOf('table class="tg"')>=0,'time: tabela geral compacta');
  chk(htm.indexOf('>Saque<')>=0 && htm.indexOf('>Defesa<')>=0 && htm.indexOf('>Levant.<')>=0,'time: colunas de saque/defesa/levant (antes faltavam)');
  // ranking por aproveitamento (%): Mikael/Igor 86% antes de Caio 75%
  var pg=htm.indexOf('table class="tg"');
  chk(htm.indexOf('Mikael',pg)<htm.indexOf('Caio',pg) && htm.indexOf('Igor',pg)<htm.indexOf('Caio',pg),'time: ranking por % (86% antes de 75%)');
  // hero: numeros redundantes removidos (ficam so nos KPIs) + parciais no placar
  chk(htm.indexOf('hero-strip')<0,'time: hero sem a faixa redundante de numeros');
  chk(htm.indexOf('class="parc"')>=0,'time: parciais no placar');
  // PDF com 1 pagina por atleta (page-break) — pra mandar pros atletas
  chk(typeof w.exAllPlayerReports==='function','exAllPlayerReports existe');
  w.exAllPlayerReports('g1');
  var ov=w.document.getElementById('pdfOverlay');
  var nBreaks=ov?(ov.innerHTML.match(/page-break-before/g)||[]).length:-1;
  chk(nBreaks===2,'exAllPlayerReports: 3 atletas = 2 quebras de pagina (1 por atleta) (deu '+nBreaks+')');
  if(w.closePdfOverlay)w.closePdfOverlay();

  // ---- HTML INDIVIDUAL (atacante) ----
  var hi=w.reportPlayerHTML(g,'a1');
  chk(hi.indexOf('MIKAEL')>=0 || hi.indexOf('Mikael')>=0,'ind a1: nome no hero');
  var m1=hi.match(/rt-num">(\d+)<span class="rt-pc">/);
  chk(m1 && m1[1]==='86','ind a1 atacante: rating = pontos/(pontos+erros) = 6/7 = 86% (deu '+(m1?m1[1]:'?')+')');
  chk(hi.indexOf('saldo +5')>=0,'ind a1: subtitulo saldo pts (6-1=+5)');

  // ---- HTML INDIVIDUAL (libero) ----
  var hl=w.reportPlayerHTML(g,'a8');
  var m8=hl.match(/rt-num">(\d+)<span class="rt-pc">/);
  chk(m8 && m8[1]==='86','ind a8 libero: rating = acertos/(acertos+erros) = 6/7 = 86% (nao 0%) (deu '+(m8?m8[1]:'?')+')');
  chk(hl.indexOf('acertos ·')>=0,'ind a8 libero: subtitulo em acertos (nao pts)');
  chk(hl.indexOf('qualidade do passe')>=0,'ind a8: card de recepcao aparece (recebe)');
  chk(hi.indexOf('qualidade do passe')<0,'ind a1: SEM card de recepcao (nao recebe)');

  console.log('\n=== test_relatorio: '+ok+' OK, '+ko+' FAIL ===');
  process.exit(ko>0?1:0);
 }catch(e){console.log('FAIL exception:',e.message);console.log((e.stack||'').split('\n').slice(0,6).join('\n'));process.exit(1);}
},150);
