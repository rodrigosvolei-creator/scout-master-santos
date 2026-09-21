// Fases do jogo (side-out / break / contra-ataque): motor rallyModel/fasesStats e a secao do PDF.
// Jogo no formato NOVO (act e sq com timestamp) -> rallies exatos; formato ANTIGO (arrays) -> estimado.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');

const fakeDB = {};
const listeners = {};
function getAt(p){const a=p.split('/');let c=fakeDB;for(const k of a){if(c==null)return null;c=c[k];}return c===undefined?null:c;}
function setAt(p,v){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}c[a[a.length-1]]=JSON.parse(JSON.stringify(v));}
function makeRef(p){return{on:(e,cb)=>{listeners[p]=cb;},once:()=>Promise.resolve({val:()=>getAt(p)}),set:v=>{setAt(p,v);return Promise.resolve();},update:()=>Promise.resolve(),remove:()=>Promise.resolve()};}
global.firebaseMock={initializeApp:()=>{},database:()=>({ref:makeRef}),auth:()=>({onAuthStateChanged:cb=>setTimeout(()=>cb({uid:'tester',email:'rodrigosvolei@gmail.com',displayName:'Tester'}),0),signInWithPopup:()=>Promise.resolve(),signOut:()=>Promise.resolve()})};

// ---- roteiro do set 1 (eles sacam primeiro). t = instante em ms; ponto = entrada do sq com hora.
let t0 = 1789900000000; const act = {}, sq = {};
const A = (pid, ak, oc) => { t0 += 1000; const id = 'a' + t0 + '_x'; act[id] = { id, pid, ak, oc, set: 1, ts: 0, dev: 'dev_A' }; };
const P = side => { t0 += 1000; sq['p' + t0 + '_x'] = side; };
A('a1','recepcao','A'); A('a4','levantamento','A'); A('a2','ataque','Ponto'); P('u');            // R1 srv t: FBSO
A('a3','saque','Cont'); A('a5','defesa','A'); A('a4','levantamento','A'); A('a2','ataque','Ponto'); P('u'); // R2 srv u: CA break
A('a3','saque','Erro'); P('t');                                                                  // R3 srv u: perdido (saque)
A('a1','recepcao','B'); A('a4','levantamento','B'); A('a2','ataque','Cont'); A('a5','defesa','A'); A('a4','levantamento','A'); A('a6','ataque','Ponto'); P('u'); // R4 srv t: CA transicao
A('a3','saque','Ace'); P('u');                                                                   // R5 srv u: ace
A('a3','saque','Cont'); A('a6','bloqueio','Ponto'); P('u');                                      // R6 srv u: bloqueio
A('a3','saque','Cont'); P('t');                                                                  // R7 srv u: ponto deles so no "+"
A('a1','recepcao','Erro'); P('t');                                                               // R8 srv t: perdido (recepcao)
A('a1','recepcao','A'); A('a4','levantamento','A'); A('a2','ataque','Erro'); P('t');            // R9 srv t: perdido (ataque erro)
A(null,'erroadv','Ponto'); P('u');                                                               // R10 srv t: erro adversario
P('u');                                                                                          // R11 srv u: ponto nosso so no "+"
// set 2: 1o rally sem saque/recepcao marcados (so levantamento + ataque) -> sacador pela ALTERNANCIA:
// eles sacaram primeiro no set 1, entao NOS sacamos primeiro no set 2 -> esse ataque e contra-ataque no break
const sq2 = {}; const A2 = (pid, ak, oc) => { t0 += 1000; const id = 'a' + t0 + '_x'; act[id] = { id, pid, ak, oc, set: 2, ts: 0, dev: 'dev_A' }; };
A2('a4','levantamento','A'); A2('a2','ataque','Ponto'); t0 += 1000; sq2['p' + t0 + '_x'] = 'u';
// g3 (regra do Rodrigo): depois do NOSSO saque o 1o contato e defesa ou bloqueio — 'recepcao' marcada num rally nosso vira defesa
const act3 = {}, sq3 = {};
const A3 = (pid, ak, oc) => { t0 += 1000; const id = 'a' + t0 + '_x'; act3[id] = { id, pid, ak, oc, set: 1, ts: 0, dev: 'dev_A' }; };
const P3 = side => { t0 += 1000; sq3['p' + t0 + '_x'] = side; };
A3('a3','saque','Cont'); A3('a1','recepcao','B'); A3('a4','levantamento','A'); A3('a2','ataque','Ponto'); P3('u'); // R1 srv u: 'recepcao' e defesa; ataque = CA no break
A3('a3','saque','Cont'); A3('a1','recepcao','Erro'); P3('t');                                            // R2 srv u: perdido por defesa (nao recepcao)
A3('a1','recepcao','A'); A3('a4','levantamento','A'); A3('a2','ataque','Ponto'); P3('u');            // R3 srv t: recepcao de verdade + ataque de side-out
const legacyActs = Object.values(act).map(a => Object.assign({}, a)); // mesmo roteiro, formato antigo (array), sem pontos manuais no sq

const seed={'torneio-master-santos':{
  teams:[{id:'tm',n:'RS MASC 35+',c:'#2563eb',roster:['a1','a2','a3','a4','a5','a6'].map(aid=>({aid}))}],
  athletes:[{aid:'a1',nm:'Libero Um',po:'Líbero'},{aid:'a2',nm:'Ponta Dois',po:'Ponteiro(a)'},{aid:'a3',nm:'Sacador Tres',po:'Central'},{aid:'a4',nm:'Lev Quatro',po:'Levantador(a)'},{aid:'a5',nm:'Def Cinco',po:'Ponteiro(a)'},{aid:'a6',nm:'Oposto Seis',po:'Oposto(a)'}],
  tournaments:[{id:'tA',n:'Liga',c:'#2563eb'}],
  games:[
    {id:'g1',torId:'tA',tid:'tm',opp:'Adv Novo',dt:'2026-09-21',st:'done',lineup:[1,2,3,4,5,6].map(i=>({aid:'a'+i,nu:i})),act:act,ss:[{u:7,t:4,sq:sq},{u:1,t:0,sq:sq2}]},
    {id:'g2',torId:'tA',tid:'tm',opp:'Adv Legado',dt:'2026-09-01',st:'done',lineup:[1,2,3,4,5,6].map(i=>({aid:'a'+i,nu:i})),act:legacyActs,ss:[{u:6,t:3,sq:['u','u','t','u','u','u','t','t','u']}]},
    {id:'g3',torId:'tA',tid:'tm',opp:'Adv Recep',dt:'2026-09-22',st:'done',lineup:[1,2,3,4,5,6].map(i=>({aid:'a'+i,nu:i})),act:act3,ss:[{u:2,t:1,sq:sq3}]}
  ],invites:{}}};
Object.assign(fakeDB,JSON.parse(JSON.stringify(seed)));

const htmlMod=html.replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>/g,'')
  .replace('firebase.initializeApp(fc);','var firebase=window.firebaseMock; firebase.initializeApp(fc);');
const dom=new JSDOM(htmlMod,{url:'https://master.exemplo.com.br/?app=1',runScripts:'dangerously',pretendToBeVisual:true,
  beforeParse(window){window.firebaseMock=global.firebaseMock;window.alert=()=>{};window.navigator.vibrate=()=>{};window.print=()=>{};}});
const w=dom.window;
let ok=0,ko=0; function chk(c,m){if(c){ok++;console.log('OK   '+m);}else{ko++;console.log('FAIL '+m);}}

setTimeout(()=>{
  try{
    ['teams','games','tournaments','athletes','invites'].forEach(k=>{const p='torneio-master-santos/'+k;if(listeners[p])listeners[p]({val:()=>getAt(p)});});
    w.currentUser={uid:'tester',email:'rodrigosvolei@gmail.com'}; w.isCoord=true;

    console.log('\n--- 1. rallyModel: formato novo -> rallies exatos ---');
    const g1=w.gF('g1'); const rm=w.rallyModel(g1);
    chk(rm.exact===true&&rm.sets.length===2&&rm.sets[0].rallies.length===11, 'set 1 dividido em 11 rallies exatos pelo sq com hora');
    chk(rm.sets[1].rallies.length===1&&rm.sets[1].rallies[0].srv==='u'&&rm.sets[1].rallies[0].srvAlt===true, 'set 2 sem saque/recepcao no 1o rally: sacador pela alternancia com o set 1 (eles sacaram no 1 -> nos no 2)');
    const srv=rm.sets[0].rallies.map(r=>r.srv).join(''), win=rm.sets[0].rallies.map(r=>r.winner).join('');
    chk(srv==='tuutuuutttu', 'sacador de cada rally = vencedor do anterior (1o pelo 1o toque): '+srv);
    chk(win==='uutuuuttt'+'uu', 'vencedores pela sequencia de pontos: '+win);
    chk(rm.sets[0].rallies[10].acts.length===0&&rm.sets[0].rallies[6].acts.length===1, 'rally so com "+" (sem acao) e rally com saque + ponto deles no "+" reconhecidos');

    console.log('\n--- 2. fasesStats: SO / FBSO / BP / origem / perdas ---');
    const T=w.fasesStats(g1);
    chk(T.rSO===5&&T.wSO===3, 'recebendo: 5 rallies, 3 ganhos (SO% 60)');
    chk(T.fbTry===3&&T.fb===1, '1a bola: 3 tentativas, 1 ponto (FBSO% 33)');
    chk(T.rBP===7&&T.wBP===5, 'sacando: 7 rallies, 5 ganhos (BP% 71) — inclui o rally do set 2 resolvido pela alternancia');
    chk(T.pts.fbso===1&&T.pts.ca_t===1&&T.pts.ca_u===2&&T.pts.bloq===1&&T.pts.ace===1&&T.pts.erroadv===1&&T.pts.manual===1, 'origem dos 8 pontos: FBSO, CA transicao, 2 CA break, bloqueio, ace, erro adv, so no "+"');
    chk(T.lost.saque===1&&T.lost.adv_manual===1&&T.lost.recepcao===1&&T.lost.ataque_erro===1&&Object.keys(T.lost).length===4, 'perdas: saque, ponto deles no "+", recepcao, ataque erro');
    chk(T.ptsInf===8&&T.ptsReal===8&&T.exact===true&&T.estimado===false, 'cobertura 100%: 8 pontos inferidos = 8 do placar; nao estimado');
    chk(T.att.SO.n===3&&T.att.SO.p===1&&T.att.SO.e===1&&T.att.CA.n===3&&T.att.CA.p===3, 'ataque por fase: SO 1/3 (1 erro), CA 3/3');
    chk(T.att.CAu.n===2&&T.att.CAu.p===2&&T.att.CAt.n===1&&T.att.CAt.p===1&&T.att.CAu.n+T.att.CAt.n===T.att.CA.n, 'contra-ataque dividido: 2 no break (nos sacamos) + 1 em transicao (eles sacaram) = total');
    chk(T.dist.SO.pon===3&&T.dist.CA.pon===2&&T.dist.CA.opo===1, 'distribuicao: SO -> 3 ponteiro; CA -> 2 ponteiro + 1 oposto');
    chk(T.recep.A===2&&T.recep.B===1&&T.recep.Erro===1&&T.soByRecep['A:n']===2&&T.soByRecep['A:w']===1&&T.soByRecep['B:w']===1&&T.soByRecep['Erro:w']===undefined, 'recepcao A/B/Erro e SO% por qualidade (A 1/2, B 1/1, Erro 0/1)');
    chk(T.serve.n===5&&T.serve.ace===1&&T.serve.err===1&&T.serve.cont===3&&T.blk.p===1&&T.def.A===2, 'saque 5 (1 ace, 1 erro), bloqueio 1 ponto, defesa 2 A');
    chk(T.ath.a2.att.SO.n===3&&T.ath.a2.att.SO.p===1&&T.ath.a2.att.CA.n===2&&T.ath.a6.blkP===1&&T.ath.a3.srv===5&&T.ath.a3.ace===1&&T.ath.a1.recep.A===2&&T.ath.a1.errs===1&&T.ath.a4.lev===6, 'por atleta: ataques por fase, bloqueio, saques, recepcao, levantamentos');
    chk(!T.ath[null]&&!T.ath['null'], 'erro do adversario (pid null) nao vira "atleta"');

    console.log('\n--- 3. formato antigo -> estimado, mas calcula ---');
    const g2=w.gF('g2'); const rm2=w.rallyModel(g2); const T2=w.fasesStats(g2);
    chk(rm2.exact===false&&T2.estimado===true, 'jogo legado (sq sem hora): marcado como estimado');
    chk(rm2.sets[0].rallies.length===10, 'rallies reconstruidos pela ordem das acoes (saque/recepcao abre; acao que pontua fecha): '+rm2.sets[0].rallies.length);
    chk(T2.rSO===5&&T2.wSO===3&&T2.fb===1&&T2.fbTry===3, 'legado: SO 3/5 e FBSO 1/3 iguais ao exato (sem os pontos do "+")');
    chk(T2.rBP===5&&T2.wBP===3, 'legado: sacando 5 rallies, 3 ganhos (rally so com "+" nao existe no legado)');

    console.log('\n--- 4. secao do PDF ---');
    const h=w._pdfFasesHTML(g1);
    chk(h.indexOf('Fases do jogo')>=0&&h.indexOf('estimado')<0, 'secao "Fases do jogo" sem tarja "estimado" no jogo novo');
    chk(h.indexOf('no break (n')>=0&&h.indexOf('em transi')>=0&&w.reportTeamHTML(g1).indexOf('no break (n')>=0, 'tabela de ataque com as sub-linhas do contra-ataque (PDF Partida e Relatorio)');
    chk(h.indexOf('>60%<')>=0&&h.indexOf('>33%<')>=0&&h.indexOf('>71%<')>=0, 'KPIs SO 60% / FBSO 33% / BP 71%');
    chk(h.indexOf('De onde vieram os nossos 8 pontos')>=0&&h.indexOf('Como perdemos 4 pontos')>=0, 'barras de origem (8) e perdas (4)');
    chk(h.indexOf('Ataque de side-out (1º ataque após a recepção)')>=0&&h.indexOf('Contra-ataque em transi')>=0&&h.indexOf('lançado só no "+"')>=0, 'rotulos das origens');
    chk(h.indexOf('Para quem foi a bola, por fase')>=0&&h.indexOf('<td>Ponteiro</td>')>=0&&h.indexOf('<td>Oposto</td>')>=0, 'distribuicao por fase com rotulo masculino (time MASC)');
    chk(T.distPts.SO.pon===1&&T.distPts.CA.pon===2&&T.distPts.CA.opo===1&&!T.distPts.SO.opo, 'pontos por funcao e fase: SO ponteiro 1; CA ponteiro 2 + oposto 1');
    chk(h.indexOf('Ataque de side-out, por atleta:</b> Ponta #2 3 (100%) · 1 pt')>=0&&h.indexOf('Contra-ataque, por atleta:</b> Ponta #2 2 (67%) · 2 pt · Oposto #6 1 (33%) · 1 pt')>=0&&h.indexOf('<td class=c>1 (33.3%)</td>')>=0, 'por atleta e por fase com % da fase e pontos; kill por funcao na tabela (SO ponteiro 1/3 = 33%)');
    chk(h.indexOf('Recepção, saque, bloqueio e defesa')>=0&&h.indexOf('Side-out % quando a recep')>=0&&h.indexOf('Por atleta')>=0&&h.indexOf('Ponta')>=0&&h.indexOf('Leitura do jogo')>=0&&h.indexOf('Como este relat')>=0, 'leitura do jogo, recepcao/saque/bloqueio/defesa, metodo e tabela por atleta');
    chk(h.indexOf('<h2>Legenda</h2>')>=0&&h.indexOf('Rallies sacando (break %)')>=0&&h.indexOf('Ataque de side-out</td>')>=0&&h.indexOf('FBSO')<0&&h.indexOf('Kill %')>=0&&h.indexOf('>Estimado<')<0&&h.indexOf('class="band"')>=0&&h.indexOf('class="kpis"')>=0, 'faixa + KPIs + legenda na nomenclatura nova (rallies recebendo/sacando, ataque de side-out, contra-ataque, Kill, Eficiencia), sem "FBSO"; sem a entrada "Estimado" no jogo exato');
    const h2=w._pdfFasesHTML(g2);
    chk(h2.indexOf('<b>estimado (formato antigo)')>=0&&/cobertura \d+%<\/b>/.test(h2)&&h2.indexOf('>Estimado<')>=0, 'jogo legado: tarja "estimado (formato antigo) · cobertura N%" + entrada na legenda');
    w.exGamePDF('g1');
    const ov=w.document.getElementById('pdfOverlay-doc')||w.document.getElementById('pdfOverlay');
    chk(!!ov&&ov.innerHTML.indexOf('Fases do jogo')>=0&&ov.innerHTML.indexOf('Sequ')>=0, 'exGamePDF: PDF da partida traz a secao Fases do jogo (depois da sequencia de pontos)');
    chk(w._pdfFasesHTML({id:'x',act:[],ss:[]})===''&&w._pdfFasesHTML(null)==='', 'jogo sem acoes: secao vazia (nao quebra o PDF)');
    console.log('\n--- 5. Relatorio visual (exTeamReport) traz a mesma secao, no design dele ---');
    const rh=w.reportTeamHTML(g1);
    chk(rh.indexOf('Fases do jogo')>=0&&rh.indexOf('class="fz"')>=0&&rh.indexOf('Leitura do jogo')>=0, 'reportTeamHTML: secao "Fases do jogo" + leitura escrita');
    chk(rh.indexOf('Rallies recebendo (side-out %)')>=0&&rh.indexOf('Ataque de side-out')>=0&&rh.indexOf('1ª bola')<0&&rh.indexOf('>60%<')>=0&&rh.indexOf('>33%<')>=0&&rh.indexOf('>71%<')>=0, 'KPIs SO 60 / FBSO 33 / BP 71 (mesmo motor)');
    chk(rh.indexOf('fz-bar fz-pos')>=0&&rh.indexOf('fz-bar fz-neg')>=0&&rh.indexOf('fz-bar pos')<0, 'barras com classes proprias (sem colidir com .pos do relatorio)');
    chk(rh.indexOf('Fases por set')>=0&&rh.indexOf('Ataque por fase')>=0&&rh.indexOf('Para quem foi a bola, por fase')>=0&&rh.indexOf('Contra-ataque, por atleta:</b> Ponta #2 2 (67%) · 2 pt')>=0&&rh.indexOf('Por atleta — fases')>=0&&rh.indexOf('Como as fases são calculadas')>=0&&rh.indexOf('Legenda')>=0, 'todos os blocos: por set, ataque por fase, para quem foi a bola por fase (com atletas), por atleta, metodo, legenda');
    chk(rh.indexOf('rallies exatos')>=0&&w.reportTeamHTML(g2).indexOf('estimado')>=0, 'tag "rallies exatos" no jogo novo e "estimado" no legado');
    chk(w._repFasesCSS().indexOf('.fz-tb')>=0&&rh.indexOf('.fz-tb{')>=0, 'CSS da secao entra no _repCSS do relatorio');

    console.log('\n--- 6. recepcao marcada em rally do NOSSO saque = defesa (nomenclatura do Rodrigo) ---');
    const g3=w.gF('g3'); const rm3=w.rallyModel(g3); const T3=w.fasesStats(g3);
    chk(rm3.sets[0].rallies.length===3&&rm3.sets[0].rallies[0].srv==='u'&&rm3.sets[0].rallies[2].srv==='t', 'g3: 3 rallies, nos sacamos os 2 primeiros');
    chk(rm3.sets[0].rallies[0].recRelabel===1&&rm3.sets[0].rallies[1].recRelabel===1&&!rm3.sets[0].rallies[2].recRelabel&&T3.recRelabel===2, '2 recepcoes em rally nosso viraram defesa (contadas); a do rally deles ficou recepcao');
    chk(rm3.sets[0].rallies[0].acts[1].ak==='defesa'&&rm3.sets[0].rallies[0].acts[1]._recRelabel===true&&g3.act.filter(a=>a.ak==='recepcao').length===3, 'a copia no rally e defesa; gm.act original continua com as 3 recepcoes (nada gravado)');
    chk(T3.recep.A===1&&Object.keys(T3.recep).length===1&&T3.def.B===1&&T3.def.Erro===1, 'recepcao so conta a de verdade (A 1); defesa ganha B 1 e Erro 1');
    chk(T3.lost.defesa===1&&!T3.lost.recepcao&&rm3.sets[0].rallies[1].winBy&&rm3.sets[0].rallies[1].winBy.ak==='defesa', 'ponto perdido no rally nosso e "Defesa — erro", nao recepcao (winBy recalculado)');
    chk(T3.att.CAu.n===1&&T3.att.CAu.p===1&&T3.att.SO.n===1&&T3.att.SO.p===1&&T3.pts.ca_u===1&&T3.pts.fbso===1, 'ataque do rally nosso = contra-ataque no break; ataque apos a recepcao de verdade = ataque de side-out');
    chk(T3.ath.a1.def===2&&T3.ath.a1.recep.A===1&&T3.ath.a1.errs===1, 'por atleta: libero com 2 defesas (relabel) + 1 recepcao A + 1 erro');
    const h3=w._pdfFasesHTML(g3);
    chk(h3.indexOf('2 recepção(ões) marcada(s) em rally do nosso saque foram tratadas como defesa')>=0&&w.reportTeamHTML(g3).indexOf('tratadas como defesa')>=0, 'PDF e Relatorio avisam quantas recepcoes foram tratadas como defesa');

    console.log('\n=== test_fases: '+ok+' OK, '+ko+' FAIL ===');
    process.exit(ko?1:0);
  }catch(e){console.log('FAIL exception: '+e.message);console.log((e.stack||'').split('\n').slice(0,6).join('\n'));process.exit(1);}
},400);
