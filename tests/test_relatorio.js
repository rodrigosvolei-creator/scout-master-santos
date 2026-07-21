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
function levA(n,oc){const a=[];for(let i=0;i<n;i++)a.push({id:'lev'+oc+i,pid:'a5',ak:'levantamento',oc:oc,set:1});return a;}
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
  athletes:[{aid:'a1',nm:'Mikael Souza',po:'Oposto(a)',nu:10},{aid:'a8',nm:'Igor Nunes',po:'Líbero',nu:16},{aid:'a3',nm:'Caio Reis',po:'Central',nu:4},{aid:'a5',nm:'Wash Lima',po:'Levantador(a)',nu:5}],
  tournaments:[{id:'tA',n:'Liga'}],
  games:[{id:'g1',tid:'trs',torId:'tA',opp:'Cananéia',dt:'2026-06-28',st:'fin',
    ss:[{u:25,t:19,sq:[]},{u:25,t:22,sq:[]}],act:act,
    lineup:[{aid:'a1',nu:10,po:'Oposto(a)'},{aid:'a8',nu:16,po:'Líbero'},{aid:'a3',nu:4,po:'Central'}]},
   // jogo do levantador (desmembramento A/B/C/Erro) — 11 levantamentos: 5A 3B 1C 2Erro + 3 saques
   {id:'g2',tid:'trs',torId:'tA',opp:'Itapeva',dt:'2026-07-20',st:'fin',ss:[{u:25,t:22,sq:[]}],
    act:[].concat(levA(5,'A'),levA(3,'B'),levA(1,'C'),levA(2,'Erro'),
      [{id:'s1',pid:'a5',ak:'saque',oc:'Cont',set:1},{id:'s2',pid:'a5',ak:'saque',oc:'Ace',set:1},{id:'s3',pid:'a5',ak:'saque',oc:'Erro',set:1}]),
    lineup:[{aid:'a5',nu:5,po:'Levantador(a)'}]}],
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
  chk(htm.indexOf('Tabela geral')>=0 && htm.indexOf('Top Ataque')>=0 && htm.indexOf('Como os números são calculados')>=0,'time: tabela + tops + metodologia');
  chk(htm.indexOf('arte antiga')<0 && htm.indexOf('N passes = N acertos')<0,'time: sem texto de conversa/comparacao (produto profissional)');
  chk(htm.indexOf('exPlayerReport(')>=0,'time: nome do atleta clicavel -> exPlayerReport');
  chk(htm.indexOf('print-color-adjust:exact')>=0,'time: print-color-adjust:exact (salva com cor)');
  // tabela compacta com TODOS os fundamentos (colunas)
  chk(htm.indexOf('table class="tg"')>=0,'time: tabela geral compacta');
  chk(htm.indexOf('>Saque<')>=0 && htm.indexOf('>Defesa<')>=0 && htm.indexOf('>Levant.<')>=0,'time: colunas de saque/defesa/levant (antes faltavam)');
  chk(htm.indexOf('>Ações<')>=0,'time: coluna Ações (volume total — acertos+erros+neutros)');
  // a3 central: 3 acertos + 1 erro + 0 neutros = 4 acoes (bloqueio 2P+1E, ataque 1P)
  chk(P.a3.n===4,'a3: total de acoes = 4 (bate com pos3+err1, sem neutros aqui)');
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
  chk(m1 && m1[1]==='86','ind a1 atacante: rating = acertos/(acertos+erros) = 6/7 = 86% (deu '+(m1?m1[1]:'?')+')');
  chk(hi.indexOf('6 acertos · 1 erros')>=0,'ind a1: subtitulo em acertos (mesma base do rating)');

  // ---- HTML INDIVIDUAL (libero) ----
  var hl=w.reportPlayerHTML(g,'a8');
  var m8=hl.match(/rt-num">(\d+)<span class="rt-pc">/);
  chk(m8 && m8[1]==='86','ind a8 libero: rating = acertos/(acertos+erros) = 6/7 = 86% (nao 0%) (deu '+(m8?m8[1]:'?')+')');
  chk(hl.indexOf('acertos ·')>=0,'ind a8 libero: subtitulo em acertos (nao pts)');
  chk(hl.indexOf('qualidade do passe')>=0,'ind a8: card de recepcao aparece (recebe)');
  chk(hi.indexOf('qualidade do passe')<0,'ind a1: SEM card de recepcao (nao recebe)');
  chk(hl.indexOf('arte antiga')<0 && hl.indexOf('N passes = N acertos')<0 && hl.indexOf('confiáveis')<0,'ind: sem texto de conversa/marketing (produto profissional)');

  // ---- DESMEMBRAMENTO EXATO POR FUNDAMENTO (A/B/C/Erro) — pedido do Rodrigo ----
  var g2=w.gF('g2'), hv=w.reportPlayerHTML(g2,'a5');
  chk(hv.indexOf('A 5 · B 3 · C 1 · Erro 2')>=0,'ind levantador: tabela mostra o desmembramento exato "A 5 · B 3 · C 1 · Erro 2"');
  chk(hv.indexOf('Ace 1 · Erro 1 · Cont 1')>=0,'ind: saque desmembrado na ordem oficial (Ace/Erro/Cont)');
  chk(hv.indexOf('Levantamento — qualidade da bola')>=0,'ind levantador: card de qualidade do levantamento');
  chk(/qseg qA" style="flex:5">5 A/.test(hv) && /qseg qB" style="flex:3">3 B/.test(hv) && /qseg qC" style="flex:1">1 C/.test(hv) && /qseg qE" style="flex:2">2 E/.test(hv),'barra do levantamento: 5A 3B 1C 2E proporcionais');
  var lvSum=(function(){var m=hv.match(/A (\d+) · B (\d+) · C (\d+) · Erro (\d+)/);return m?(+m[1]+ +m[2]+ +m[3]+ +m[4]):0;})();
  chk(lvSum===11,'desmembramento FECHA com as acoes do fundamento (5+3+1+2=11)');
  chk(hv.indexOf('>45%<')>=0,'card levant.: perfeitos (A) = 5/11 = 45%');
  chk(hv.indexOf('>73%<')>=0,'card levant.: positivos (A+B) = 8/11 = 73%');
  chk(hv.indexOf('>18%<')>=0,'card levant.: erro = 2/11 = 18%');
  chk(/Levantamento( consistente)?:/.test(hv),'leitura da partida: linha do levantamento (>=5 acoes)');
  chk(hi.indexOf('Levantamento — qualidade da bola')<0,'ind a1 (atacante): SEM card de levantamento');
  chk(hv.indexOf('Indice = positivas')>=0 || hv.indexOf('Índice = positivas ÷ ações')>=0,'tabela explica: Indice = positivas / acoes');

  // ---- APROVEITAMENTO = acertos/(acertos+erros) PRA TODOS (Rodrigo: levantador/libero nao vivem de ponto)
  // a5 levantador: 5A+3B+1C+2Erro no levant. + saque (Cont+Ace+Erro) -> pos 7, err 3, pontos 1
  var p5=null;w.repAgg(g2).players.forEach(function(x){if(x.pid==='a5')p5=x;});
  chk(p5.pos===7 && p5.err===3 && p5.pontos===1,'a5 levantador: pos7 err3 pontos1');
  var m5=hv.match(/rt-num">(\d+)<span class="rt-pc">/);
  chk(m5 && m5[1]==='70','levantador: hero = acertos/(acertos+erros) = 7/10 = 70% — NAO 25% (pontos) (deu '+(m5?m5[1]:'?')+')');
  chk(hv.indexOf('7 acertos · 3 erros · 1 pts')>=0,'levantador: subtitulo bate com a conta do hero');
  // o hero TEM que bater com a coluna Aprov. do mesmo atleta na tabela do time
  var htm=w.reportTeamHTML(g2), aprovTab=(htm.match(/class="pc">(\d+)%</g)||[]).map(function(x){return x.replace(/\D/g,'');});
  chk(aprovTab.indexOf('70')>=0,'time: a coluna Aprov. do a5 tambem da 70% (hero = tabela) — deu ['+aprovTab.join(',')+']');
  // libero que teve acao ofensiva sem ponto NAO pode dar 0% (bug real: Mateus, jogo ITAPEVA)
  var lb=w.repAgg({},[{pid:'L',ak:'recepcao',oc:'A'},{pid:'L',ak:'recepcao',oc:'A'},{pid:'L',ak:'defesa',oc:'A'},{pid:'L',ak:'ataque',oc:'Cont'},{pid:'L',ak:'recepcao',oc:'Erro'}]).players[0];
  chk(lb.aprov===75 && lb.aprovPt===0,'libero com ataque sem ponto: acertos=75% (o antigo pontos/(pontos+err) dava 0%)');

  // ---- MARKUP FECHADO: o card da pizza nao fechava e engolia "Leitura da partida" + metodo (meia pagina vazia no PDF)
  function divBal(x){return (x.match(/<div/g)||[]).length-(x.match(/<\/div>/g)||[]).length;}
  chk(divBal(hv)===0,'individual: divs balanceadas (deu '+divBal(hv)+')');
  chk(divBal(hi)===0,'individual atacante: divs balanceadas (deu '+divBal(hi)+')');
  chk(divBal(w.reportTeamHTML(g))===0,'time: divs balanceadas');

  console.log('\n=== test_relatorio: '+ok+' OK, '+ko+' FAIL ===');
  process.exit(ko>0?1:0);
 }catch(e){console.log('FAIL exception:',e.message);console.log((e.stack||'').split('\n').slice(0,6).join('\n'));process.exit(1);}
},150);
