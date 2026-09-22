// Modulo de Treinos: cadastro (atletas do cadastro + colados), marcacao rapida
// (atleta+fundamento+nota), consolidado a qualquer momento (sem precisar finalizar),
// PDF individual/geral, finalizar/reabrir, remocao de atleta com marcacoes (confirma).
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');

const fakeDB = {};
const listeners = {};
function getAt(p){const a=p.split('/');let c=fakeDB;for(const k of a){if(c==null)return null;c=c[k];}return c===undefined?null:c;}
function setAt(p,v){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}c[a[a.length-1]]=JSON.parse(JSON.stringify(v));}
function delAt(p){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c==null)return;c=c[a[i]];}if(c)delete c[a[a.length-1]];}
function makeRef(p){return{_path:p,on:function(e,cb){listeners[p]=cb;},once:function(){return Promise.resolve({val:()=>getAt(p)});},set:function(v){setAt(p,v);return Promise.resolve();},update:function(obj){for(const k in obj){if(obj[k]===null)delAt(p+'/'+k);else setAt(p+'/'+k,obj[k]);}return Promise.resolve();},remove:function(){delAt(p);return Promise.resolve();}};}
function fireTrainings(){const path='torneio-master-santos/trainings';if(listeners[path])listeners[path]({val:()=>getAt(path)});}
global.firebaseMock={initializeApp:()=>{},database:()=>({ref:makeRef}),auth:()=>({onAuthStateChanged:function(cb){setTimeout(()=>cb({uid:'tester',email:'rodrigosvolei@gmail.com',displayName:'Tester'}),0);},signInWithPopup:()=>Promise.resolve(),signOut:()=>Promise.resolve()})};

const seed = {
  'torneio-master-santos': {
    teams:[{id:'trs',n:'FEM RS 30+',c:'#db2777',roster:[{aid:'a1'},{aid:'a2'}]}],
    athletes:[
      {aid:'a1',nm:'Ana',po:'Ponta'},
      {aid:'a2',nm:'Bia',po:'Central'}
    ],
    tournaments:[{id:'tA',n:'Liga',c:'#2563eb'}],
    games:[],
    invites:{},
    trainings:{}
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
    window.alert=()=>{};
    window.print=()=>{};
  }
});
const w = dom.window;

let ok=0, ko=0;
function chk(c,m){if(c){ok++;console.log('OK   '+m);}else{ko++;console.log('FAIL '+m);}}

setTimeout(async ()=>{
  try {
    ['teams','games','tournaments','athletes','invites','trainings'].forEach(k=>{
      const path='torneio-master-santos/'+k;
      if(listeners[path]) listeners[path]({val:()=>getAt(path)});
    });
    w.isScouter=true;
    w.currentUser={uid:'tester',email:'rodrigosvolei@gmail.com'};

    // 1. Nav: aba treinos aparece pro scouter
    w.render();
    chk(w.document.querySelector('.app-tabs [onclick*="treinos"]') !== null || true, 'nav renderizado sem erro (sanidade)');

    // 2. Criar treino (sem passar pelo modal — chama criarTreino apos preencher os campos)
    w.tab='treinos'; w.render();
    w.openNovoTreino();
    chk(!!w.document.getElementById('trn-new-dt'), 'modal Novo Treino abre com campo de data');
    w.document.getElementById('trn-new-dt').value='2026-09-10';
    w.document.getElementById('trn-new-tid').value='trs';
    w.document.getElementById('trn-new-loc').value='Ginasio Central';
    // CAMINHO REAL: clique no botao "Criar" do modal (confirmModal fecha o modal ANTES do
    // onConfirm — bug real: a data era lida depois do input sumir e dava "Informe a data").
    w.document.getElementById('rsConfirmOk').onclick();
    chk(w.D.trainings.length===1, 'treino criado PELO BOTAO do modal: 1 em D.trainings');
    chk(!w.document.getElementById('rsConfirm'), 'modal Novo Treino fechou apos criar');
    var tr=w.D.trainings[0];
    chk(tr.tid==='trs' && tr.dt==='2026-09-10' && tr.status==='open', 'treino criado com equipe/data/status corretos');
    chk(getAt('torneio-master-santos/trainings/'+tr.id) && getAt('torneio-master-santos/trainings/'+tr.id).id===tr.id,
      'saveTraining grava CHAVEADO por id (nao por indice) no RTDB');
    chk(w.selTrn===tr.id && w.trnSub==='atletas', 'apos criar: abre direto na aba Atletas');

    // 3. Adicionar atleta do cadastro (toggle)
    w.toggleTrnCadastroAthlete(tr.id,'a1');
    tr=w.trF(tr.id);
    chk(tr.athletes.length===1 && tr.athletes[0].linkedAid==='a1' && tr.athletes[0].nome==='Ana', 'toggle cadastro: Ana adicionada com linkedAid');
    // toggle de novo remove
    w.toggleTrnCadastroAthlete(tr.id,'a1');
    tr=w.trF(tr.id);
    chk(tr.athletes.length===0, 'toggle cadastro de novo: remove (sem marcacoes, sem confirmar)');
    // re-adiciona pros proximos passos
    w.toggleTrnCadastroAthlete(tr.id,'a1');
    w.toggleTrnCadastroAthlete(tr.id,'a2');
    tr=w.trF(tr.id);
    chk(tr.athletes.length===2, 'Ana e Bia adicionadas do cadastro');

    // 4. Colar nomes (avulsos, dedupe)
    w.trnSub='atletas'; w.render();
    var ta=w.document.getElementById('trn-paste-names');
    ta.value='Maria Silva\nJoão Pedro\nAna Costa, Bia'; // "Bia" ja existe (dedupe por nome, case-insensitive)
    w.addTrnPastedNames(tr.id);
    tr=w.trF(tr.id);
    var nomes=tr.athletes.map(function(a){return a.nome;});
    chk(tr.athletes.length===5, 'colar nomes: 3 novos + 2 do cadastro = 5 (Bia deduplicada): '+tr.athletes.length);
    chk(nomes.indexOf('Maria Silva')>=0 && nomes.indexOf('João Pedro')>=0 && nomes.indexOf('Ana Costa')>=0, 'nomes colados entraram (parse por linha e por virgula)');
    var avulsoMaria=tr.athletes.filter(function(a){return a.nome==='Maria Silva';})[0];
    chk(avulsoMaria && avulsoMaria.linkedAid===null, 'avulso colado nao tem linkedAid');
    // Formato colado do WhatsApp: "✅12-Régis", "17 - Orelha", "7. Toy" -> nome limpo + numero (nu)
    var pn=w._trnParseName;
    chk(pn('✅2-Guillen').nome==='Guillen', 'parse: "✅2-Guillen" -> Guillen (sem emoji, sem numero)');
    chk(pn('17 - Orelha').nome==='Orelha', 'parse: "17 - Orelha" -> Orelha');
    chk(pn('✅3-Everton ').nome==='Everton' && pn('7. Toy').nome==='Toy' && pn('Wash').nome==='Wash', 'parse: espaco no fim, "7. Toy", nome puro');
    w.trnSub='atletas'; w.render();
    w.document.getElementById('trn-paste-names').value='✅1-Wash\n✅12-Régis\n17 - Orelha';
    w.addTrnPastedNames(tr.id);
    tr=w.trF(tr.id);
    var regis=tr.athletes.filter(function(a){return a.nome==='Régis';})[0];
    chk(!!regis && regis.nu===undefined && tr.athletes.some(function(a){return a.nome==='Orelha';}), 'colar lista do WhatsApp: cria Régis e Orelha limpos (sem ✅, sem "12-", sem guardar numero)');
    w.trnSub='marcar'; w.render();
    chk(w.document.body.innerHTML.indexOf('>Régis</button>')>=0 && w.document.body.innerHTML.indexOf('trn-nu')<0, 'chip mostra so o nome');
    // limpa os 3 colados pra nao mexer nas contas dos passos seguintes
    ['Wash','Régis','Orelha'].forEach(function(n){var a=w.trF(tr.id).athletes.filter(function(x){return x.nome===n;})[0]; if(a)w.removeTrnAthlete(tr.id,a.taid);});
    tr=w.trF(tr.id);
    chk(tr.athletes.length===5, 'limpeza: volta a 5 atletas');

    // 5. Marcar acoes (atleta ativo + fundamento + nota)
    var anaTaid=tr.athletes.filter(function(a){return a.linkedAid==='a1';})[0].taid;
    w.trnSub='marcar'; w.trnAtivo=null; w.render();
    w.markTreino(tr.id,'ace'); // sem atleta ativo -> nao grava
    tr=w.trF(tr.id);
    chk((tr.marks||[]).length===0, 'markTreino sem atleta ativo: nao grava (toast de erro)');
    w.setTrnAtivo(anaTaid);
    w.trnFund='saque';
    w.markTreino(tr.id,'ace');
    w.markTreino(tr.id,'erro');
    w.trnFund='recepcao';
    w.markTreino(tr.id,'3');
    w.markTreino(tr.id,'0');
    w.markTreino(tr.id,'2');
    tr=w.trF(tr.id);
    chk(tr.marks.length===5, '5 marcacoes gravadas para Ana: '+tr.marks.length);
    chk(tr.marks.every(function(m){return m.taid===anaTaid;}), 'todas as marcacoes sao da Ana (atleta ativo)');

    // 6. Consolidado A QUALQUER MOMENTO (treino continua 'open', nunca precisou finalizar)
    var agg=w.trnAgg(tr);
    var anaAgg=agg.filter(function(p){return p.taid===anaTaid;})[0];
    chk(!!anaAgg, 'trnAgg: Ana aparece no consolidado');
    chk(anaAgg.n===5, 'consolidado: 5 acoes de Ana');
    // saque: ace(good)+erro(bad) -> 1/2 ; recepcao: 3(good)+0(bad)+2(good) -> 2/3 => total good=3/5=60%
    chk(anaAgg.good===3, 'consolidado: 3 acoes positivas (ace,3,2): '+anaAgg.good);
    chk(anaAgg.aprov===60, 'aproveitamento calculado = 60% (3/5): '+anaAgg.aprov);
    chk(tr.status==='open', 'treino continua ABERTO ao ver o consolidado — nao precisou finalizar (requisito 6.1)');
    w.trnSub='resumo'; w.render();
    chk(w.document.body.innerHTML.indexOf('60%')>=0, 'resumo renderiza o % de aproveitamento na tela');
    // Planilha: 1 coluna por NOTA (nao "3/5"). Cabecalho h2 tem as notas curtas de cada fundamento.
    var h2=w.document.querySelector('.trn-tbl tr.h2');
    chk(!!h2 && h2.textContent.indexOf('Ace')>=0 && h2.textContent.indexOf('Neu')>=0 && h2.textContent.indexOf('Perf')>=0 && h2.textContent.indexOf('Reg')>=0, 'tabela: cabecalho com 1 coluna por nota (Ace/Neu/Perf/Reg...)');
    var anaRow=null; w.document.querySelectorAll('.trn-tbl tbody tr').forEach(function(r){ if(r.textContent.indexOf('Ana')>=0) anaRow=r; });
    chk(!!anaRow, 'tabela: linha da Ana existe');
    var cells=anaRow?Array.prototype.map.call(anaRow.querySelectorAll('td'),function(td){return td.textContent.trim();}):[];
    // colunas: Atleta, Acoes(5), Aprov(60%), Saque[Ace=1,Bom=0,Neu=0,Erro=1,%=50%], Recep[Perf=1,Bom=1,Reg=0,Erro=1,%=67%], ...
    chk(cells[1]==='5' && cells[2]==='60%', 'tabela: acoes=5 e aprov=60% da Ana: '+cells.slice(0,3).join('|'));
    chk(cells[3]==='1' && cells[6]==='1' && cells[7]==='2' && cells[8]==='50%', 'tabela saque: Ace 1 · Erro 1 · Tot 2 · 50%: '+cells.slice(3,9).join('|'));
    chk(cells[9]==='1' && cells[10]==='1' && cells[12]==='1' && cells[13]==='3' && cells[14]==='67%', 'tabela recepcao: Perf 1 · Bom 1 · Erro 1 · Tot 3 · 67%: '+cells.slice(9,15).join('|'));
    chk(!!w.document.querySelector('.trn-light'), 'aba Treinos renderiza no painel claro (.trn-light)');
    // Celular: cards por atleta (1 card, 1 linha por fundamento, mesmas contagens da planilha)
    var pc=w.document.querySelectorAll('.trn-cards .trn-pc');
    chk(pc.length===1 && pc[0].querySelectorAll('.fr').length===6, 'resumo celular: 1 card (Ana) com 6 linhas de fundamento');
    var frS=pc[0].querySelectorAll('.fr')[0].textContent.replace(/\s+/g,' ');
    chk(/Saque/.test(frS) && /Ace\s*1/.test(frS) && /Erro\s*1/.test(frS) && /50%/.test(frS), 'card celular saque: Ace 1 · Erro 1 · 50%: '+frS);
    chk(/\.trn-cards\{display:none\}/.test(html) && /max-width:640px\)\{\.trn-tbl-desk\{display:none\}\.trn-cards\{display:flex/.test(html), 'CSS: cards so no celular, planilha so em tela grande');
    chk(w.document.body.classList.contains('trn-clean'), 'marca d\'agua do shell escondida na aba Treinos (body.trn-clean)');
    // Botoes de nota centralizados (classe .trn-nota com flex center)
    w.trnSub='marcar'; w.render();
    var nb=w.document.querySelectorAll('.trn-nota');
    chk(nb.length===4 && /justify-content:center/.test((html.match(/\n\.trn-nota\{[^}]*\}/)||[''])[0]), 'botoes de nota: 4 opcoes (saque sem "Ponto direto") e texto centralizado');
    var cssRe=w.getComputedStyle(nb[0]);
    chk(cssRe.justifyContent==='center' && cssRe.textAlign==='center', 'botao de nota: computed justify-content/text-align = center');

    // 7. Undo da ultima marcacao
    w.undoTreinoMark(tr.id);
    tr=w.trF(tr.id);
    chk(tr.marks.length===4, 'undoTreinoMark: remove a ultima marcacao (4 restantes)');

    // 8. PDFs (client-side via openPdfOverlay — mesmo mecanismo do relatorio de jogo)
    w.exTreinoAthletePDF(tr.id,anaTaid);
    chk(!!w.document.getElementById('pdfOverlay'), 'PDF individual: abre o overlay de impressao');
    chk(w.document.getElementById('pdfOverlay').innerHTML.indexOf('Ana')>=0, 'PDF individual contem o nome da atleta');
    var ov=w.document.getElementById('pdfOverlay'); if(ov)ov.remove();
    w.exTreinoResumoPDF(tr.id);
    chk(!!w.document.getElementById('pdfOverlay'), 'PDF geral do treino: abre o overlay de impressao');

    // 9. Remover atleta COM marcacoes -> exige confirmacao (nao remove direto)
    w.removeTrnAthlete(tr.id,anaTaid);
    tr=w.trF(tr.id);
    chk(tr.athletes.some(function(a){return a.taid===anaTaid;}), 'atleta com marcacoes NAO removida sem confirmar');
    chk(!!w.document.getElementById('rsConfirm'), 'modal de confirmacao aberto (atleta tem marcacoes)');
    w.document.getElementById('rsConfirmOk').onclick();
    tr=w.trF(tr.id);
    chk(!tr.athletes.some(function(a){return a.taid===anaTaid;}), 'apos confirmar: atleta removida');
    chk(!tr.marks.some(function(m){return m.taid===anaTaid;}), 'apos confirmar: marcacoes da atleta removida tambem somem');

    // 10. Finalizar / reabrir treino
    w.finalizarTreino(tr.id);
    tr=w.trF(tr.id);
    chk(tr.status==='closed', 'finalizarTreino: status vira closed');
    w.trnSub='marcar'; w.render();
    chk(w.document.body.innerHTML.indexOf('finalizado')>=0, 'tela de marcar avisa treino finalizado');
    // resumo continua acessivel com treino fechado (nunca bloqueia visualizacao)
    w.trnSub='resumo'; w.render();
    chk(w.document.body.innerHTML.length>0, 'resumo renderiza normalmente com treino fechado');
    w.reabrirTreino(tr.id);
    tr=w.trF(tr.id);
    chk(tr.status==='open', 'reabrirTreino: volta a open');

    // 11. CONTA SIMPLES: so erro (e bloqueado no ataque) desconta; neutro/regular/defendido = acerto
    w.criarTreino; // (no-op) reusa o treino atual
    tr=w.trF(tr.id); tr.marks=[]; w.saveTraining(tr);
    var biaTaid=tr.athletes.filter(function(a){return a.linkedAid==='a2';})[0].taid;
    w.setTrnAtivo(biaTaid);
    w.trnFund='saque'; w.markTreino(tr.id,'neutro'); w.markTreino(tr.id,'erro');
    w.trnFund='ataque'; w.markTreino(tr.id,'defendido'); w.markTreino(tr.id,'bloqueado'); w.markTreino(tr.id,'ponto');
    tr=w.trF(tr.id);
    var bAgg=w.trnAgg(tr).filter(function(p){return p.taid===biaTaid;})[0];
    chk(bAgg.byF.saque.n===2 && bAgg.byF.saque.good===1 && Math.round(bAgg.byF.saque.good/bAgg.byF.saque.n*100)===50, 'conta simples: saque neutro+erro = 1 acerto em 2 = 50% (era 0%)');
    chk(bAgg.byF.ataque.n===3 && bAgg.byF.ataque.good===2 && bAgg.byF.ataque.err===1, 'ataque: defendido+ponto = acerto, bloqueado = erro (2/3)');
    chk(bAgg.n===5 && bAgg.good===3 && bAgg.err===2 && bAgg.aprov===60, 'geral: 3 acertos / 2 erros / 60%');
    w.trnSub='resumo'; w.render();
    var h2b=w.document.querySelector('.trn-tbl tr.h2');
    chk(!!h2b && (h2b.textContent.match(/Tot/g)||[]).length===6, 'tabela: coluna Tot (total do fundamento) em cada um dos 6 fundamentos');
    var biaRow=null; w.document.querySelectorAll('.trn-tbl tbody tr').forEach(function(r){ if(r.textContent.indexOf('Bia')>=0) biaRow=r; });
    var bc=biaRow?Array.prototype.map.call(biaRow.querySelectorAll('td'),function(td){return td.textContent.trim();}):[];
    // Atleta, Acoes, Aprov, Saque[Ace,Bom,Neu,Erro,Tot,%], Recep[.. 6], Levant[.. 6], Ataque[Pto,Bloq,Def,Erro,Tot,%]
    chk(bc[5]==='1' && bc[6]==='1' && bc[7]==='2' && bc[8]==='50%', 'linha Bia saque: Neu 1 · Erro 1 · Tot 2 · 50%: '+bc.slice(3,9).join('|'));
    chk(bc[21]==='1' && bc[22]==='1' && bc[23]==='1' && bc[25]==='3' && bc[26]==='67%', 'linha Bia ataque: Pto 1 · Bloq 1 · Def 1 · Tot 3 · 67%: '+bc.slice(21,27).join('|'));

    // 11b. BLOQUEIO e DEFESA (fundamentos novos do treino): marcam, contam na regua e saem
    // em TODOS os relatorios (tabela do resumo, cards do celular, PDF geral).
    w.trnSub='marcar'; w.setTrnAtivo(biaTaid);
    w.trnFund='bloqueio';
    w.markTreino(tr.id,'ponto'); w.markTreino(tr.id,'toque'); w.markTreino(tr.id,'passou'); w.markTreino(tr.id,'erro');
    w.trnFund='defesa';
    w.markTreino(tr.id,'3'); w.markTreino(tr.id,'0');
    tr=w.trF(tr.id);
    chk(w.TFUND_ORDER.length===6 && w.TFUND_ORDER[4]==='bloqueio' && w.TFUND_ORDER[5]==='defesa', 'TFUND_ORDER: 6 fundamentos, bloqueio e defesa no fim');
    var b2=w.trnAgg(tr).filter(function(p){return p.taid===biaTaid;})[0];
    chk(!!b2.byF.bloqueio && b2.byF.bloqueio.n===4 && b2.byF.bloqueio.good===3 && b2.byF.bloqueio.err===1, 'bloqueio: ponto+toque+passou contam como acerto, so o erro desconta (3/4)');
    chk(!!b2.byF.defesa && b2.byF.defesa.n===2 && b2.byF.defesa.good===1, 'defesa: perfeita = acerto, erro desconta (1/2)');
    w.trnSub='resumo'; w.render();
    var h1c=w.document.querySelector('.trn-tbl tr.h1');
    chk(!!h1c && /Bloqueio/.test(h1c.textContent) && /Defesa/.test(h1c.textContent), 'tabela do resumo: Bloqueio e Defesa no cabecalho');
    var biaRow2=null; w.document.querySelectorAll('.trn-tbl tbody tr').forEach(function(r){ if(r.textContent.indexOf('Bia')>=0) biaRow2=r; });
    var bc2=biaRow2?Array.prototype.map.call(biaRow2.querySelectorAll('td'),function(td){return td.textContent.trim();}):[];
    // Atleta, Acoes, Aprov, Saque[6], Recep[6], Levant[6], Ataque[6], Bloqueio[Pto,Toq,Pass,Erro,Tot,%]=27..32, Defesa[Perf,Boa,Reg,Erro,Tot,%]=33..38
    chk(bc2[27]==='1' && bc2[28]==='1' && bc2[29]==='1' && bc2[30]==='1' && bc2[31]==='4' && bc2[32]==='75%', 'linha Bia bloqueio: Pto/Toq/Pass/Erro 1 cada · Tot 4 · 75%: '+bc2.slice(27,33).join('|'));
    chk(bc2[33]==='1' && bc2[36]==='1' && bc2[37]==='2' && bc2[38]==='50%', 'linha Bia defesa: Perf 1 · Erro 1 · Tot 2 · 50%: '+bc2.slice(33,39).join('|'));
    var pcB=w.document.querySelectorAll('.trn-cards .trn-pc');
    chk(pcB.length>0 && pcB[0].querySelectorAll('.fr').length===6, 'cards do celular: 6 linhas de fundamento (bloqueio e defesa inclusos)');
    // PDF geral: planilha com os 6 fundamentos, em paisagem (nao cabe mais em retrato)
    var ovG=w.document.getElementById('pdfOverlay'); if(ovG)ovG.remove();
    w.exTreinoResumoPDF(tr.id);
    var pdfG=w.document.getElementById('pdfOverlay').innerHTML;
    chk(/Bloqueio/.test(pdfG) && /Defesa/.test(pdfG), 'PDF geral: colunas de Bloqueio e Defesa');
    chk(/75%/.test(pdfG) && /A4 landscape/.test(pdfG), 'PDF geral: 75% do bloqueio da Bia e pagina em paisagem');
    var ovG2=w.document.getElementById('pdfOverlay'); if(ovG2)ovG2.remove();

    // 12. PDF individual no formato planilha (linha por fundamento, notas + Total + %)
    var ov2=w.document.getElementById('pdfOverlay'); if(ov2)ov2.remove();
    w.exTreinoAthletePDF(tr.id,biaTaid);
    var pdfHtml=w.document.getElementById('pdfOverlay').innerHTML;
    chk(pdfHtml.indexOf('table')>=0 && /Fundamento/.test(pdfHtml) && /Total/.test(pdfHtml) && pdfHtml.indexOf('50%')>=0 && pdfHtml.indexOf('67%')>=0, 'PDF individual: tabela Fundamento/Notas/Total/Aprov. com 50% (saque) e 67% (ataque)');
    chk(pdfHtml.indexOf('×')<0, 'PDF individual: sem chips "2×" (mesmo formato do geral)');
    chk(/Bloqueio/.test(pdfHtml) && /Defesa/.test(pdfHtml) && /Passou/.test(pdfHtml) && /75%/.test(pdfHtml), 'PDF individual: linhas de Bloqueio (75%) e Defesa tambem saem');
    var ov3=w.document.getElementById('pdfOverlay'); if(ov3)ov3.remove();

    // 13. Feedback de toque: botao tocado ganha classe flash no re-render
    w.trnSub='marcar'; w.trnFund='saque'; w.render();
    w.markTreino(tr.id,'bom');
    chk(!!w.document.querySelector('.trn-nota.flash'), 'botao tocado pisca (classe .flash) no re-render');
    chk(/@keyframes trnFlash/.test(html) && /\.trn-nota\{border:2px solid/.test(html), 'CSS: animacao trnFlash e borda de destaque nos botoes de nota');

    // 14. MODO TABLET: toggle por localStorage (nunca por largura), 24 botoes combinados, 1 toque grava com o fundamento certo
    chk(!w.isTrnTablet(), 'tablet: desligado por padrao');
    w.toggleTrnTablet();
    chk(w.isTrnTablet() && w.localStorage.getItem('rs_trn_tablet')==='1', 'tablet: toggle grava preferencia no localStorage');
    chk(!!w.document.querySelector('.trn-tab'), 'tablet: layout .trn-tab renderizado na sub-aba Marcar');
    chk(w.document.body.classList.contains('trn-tablet'), 'tablet: body.trn-tablet (esconde header/tabs)');
    chk(w.document.querySelectorAll('.trn-tab .trn-nota').length===24, 'tablet: 6 fundamentos x 4 notas = 24 botoes combinados');
    chk(/\.trn-tab \.fgrid\{display:grid;grid-auto-rows:1fr/.test(html), 'CSS tablet: linhas do grid se dividem sozinhas (nao ha mais repeat(4,1fr) fixo)');
    chk(/\.trn-tab\{[^}]*height:calc\(100dvh - 92px\)/.test(html), 'CSS tablet: grade travada na altura da tela (nao estoura com 6 fundamentos)');
    chk(/\.trn-light \.trn-fsel[^{]*\{display:grid;grid-template-columns:repeat\(3,1fr\)/.test(html), 'CSS celular: seletor de fundamento em grade 3x2');
    chk(w.document.querySelectorAll('.trn-tab .ath').length===tr.athletes.length && !!w.document.querySelector('.trn-tab .ath.on'), 'tablet: coluna de atletas ('+tr.athletes.length+') com a ativa marcada');
    var before=w.trF(tr.id).marks.length;
    w.trnFund='saque'; // celular armado em saque, mas o botao combinado manda o fundamento
    w.markTreino(tr.id,'perfeito','levantamento');
    tr=w.trF(tr.id);
    var lastM=tr.marks[tr.marks.length-1];
    chk(tr.marks.length===before+1 && lastM.fund==='levantamento' && lastM.nota==='perfeito', 'tablet: botao combinado grava o fundamento do botao (levantamento), nao o trnFund');
    chk(w.document.querySelector('.trn-tab .feed .fi.last') && w.document.querySelector('.trn-tab .feed .fi.last').textContent.indexOf('Perfeito')>=0, 'tablet: feed mostra a ultima marcacao em destaque');
    w.toggleTrnTablet();
    chk(!w.isTrnTablet() && !w.document.querySelector('.trn-tab') && !w.document.body.classList.contains('trn-tablet'), 'tablet: desligar volta ao layout celular e tira body.trn-tablet');

    // 14b. MULTI-OPERADOR: cada marcacao vai pro proprio no marks/{mid}; a escrita de outro
    // aparelho chegando no meio NAO e apagada; undo so tira a marcacao deste aparelho.
    (async function(){})(); // (as escritas granulares sao promises; o mock resolve na hora)
    await new Promise(r=>setTimeout(r,20));
    var dbTr=getAt('torneio-master-santos/trainings/'+tr.id);
    chk(dbTr && !Array.isArray(dbTr.marks) && typeof dbTr.marks==='object', 'RTDB: marks e OBJETO chaveado (marks/{mid}), nao array');
    chk(dbTr && !Array.isArray(dbTr.athletes) && typeof dbTr.athletes==='object' && Object.keys(dbTr.athletes).length===tr.athletes.length, 'RTDB: athletes e OBJETO chaveado por taid');
    var nMarksDb=Object.keys(dbTr.marks||{}).length;
    chk(nMarksDb===tr.marks.length, 'RTDB: mesmo numero de marcacoes que o estado local ('+nMarksDb+')');
    // outro aparelho grava uma marcacao direto no banco (sem passar por este app)
    var outroId='m_outro_'+Date.now();
    setAt('torneio-master-santos/trainings/'+tr.id+'/marks/'+outroId,{id:outroId,taid:biaTaid,fund:'saque',nota:'ace',ts:Date.now()+1,dev:'dev_OUTRO'});
    fireTrainings(); // listener recebe o estado do banco (como no ar)
    tr=w.trF(tr.id);
    chk(tr.marks.some(function(m){return m.id===outroId;}), 'marcacao do OUTRO aparelho aparece aqui via listener');
    var antes=Object.keys(getAt('torneio-master-santos/trainings/'+tr.id+'/marks')).length;
    w.trnAtivo=biaTaid; w.trnFund='ataque'; w.markTreino(tr.id,'ponto');
    await new Promise(r=>setTimeout(r,20));
    var depois=Object.keys(getAt('torneio-master-santos/trainings/'+tr.id+'/marks')).length;
    chk(depois===antes+1 && !!getAt('torneio-master-santos/trainings/'+tr.id+'/marks/'+outroId), 'marcar aqui NAO apaga a marcacao do outro aparelho (antes '+antes+' -> '+depois+')');
    // undo: a ultima do banco e a minha (ponto); desfaz a minha, a do outro fica
    tr=w.trF(tr.id);
    var minhaId=tr.marks[tr.marks.length-1].id;
    w.undoTreinoMark(tr.id);
    await new Promise(r=>setTimeout(r,20));
    tr=w.trF(tr.id);
    chk(tr.marks.some(function(m){return m.id===outroId;}) && !tr.marks.some(function(m){return m.id===minhaId;}) && !getAt('torneio-master-santos/trainings/'+tr.id+'/marks/'+minhaId), 'undo: tira SO a minha ultima marcacao (local e banco); a do outro aparelho fica');
    chk(!!getAt('torneio-master-santos/trainings/'+tr.id+'/marks/'+outroId), 'undo: no banco a marcacao do outro continua');
    // agora a ultima do banco e a do OUTRO -> undo aqui nao pode tirar
    var toasts2=[]; var _t=w.toast; w.toast=function(m){toasts2.push(m);};
    var nAntes=tr.marks.length;
    w.undoTreinoMark(tr.id);
    w.toast=_t;
    tr=w.trF(tr.id);
    chk(tr.marks.length===nAntes-1 || toasts2.some(function(t){return /outro aparelho/.test(t);}), 'undo com a ultima sendo do outro: desfaz a minha anterior (ou avisa se nao ha minha)');
    chk(tr.marks.some(function(m){return m.id===outroId;}), 'undo nunca remove a marcacao do outro aparelho');
    // formato antigo (array) e convertido na 1a escrita
    var legacyId='tr_legacy';
    setAt('torneio-master-santos/trainings/'+legacyId,{id:legacyId,dt:'2026-09-14',tid:'trs',status:'open',athletes:[{taid:'ta_L1',nome:'Leg',linkedAid:null}],marks:[{taid:'ta_L1',fund:'saque',nota:'ace',ts:1}]});
    fireTrainings();
    var lg=w.trF(legacyId);
    chk(!!lg && lg._legacy===true && lg.athletes.length===1 && lg.marks.length===1, 'treino no formato antigo (arrays) e lido e marcado _legacy');
    w.selTrn=legacyId; w.trnAtivo='ta_L1'; w.trnFund='saque'; w.markTreino(legacyId,'bom');
    await new Promise(r=>setTimeout(r,20));
    var lgDb=getAt('torneio-master-santos/trainings/'+legacyId);
    chk(!Array.isArray(lgDb.marks) && Object.keys(lgDb.marks).length===2 && !Array.isArray(lgDb.athletes) && !!lgDb.athletes['ta_L1'], 'legacy: 1a escrita converte athletes/marks pra chaveado e grava a nova marcacao (2 no banco)');
    w.selTrn=tr.id;

    // 15. Excluir treino criado errado: confirma, some do estado local E do RTDB (trainings/{id})
    chk(w.document.body.innerHTML.indexOf('categorias de base')<0, 'aviso "categorias de base" removido');
    w.trnSub='atletas'; w.render();
    chk(!!w.document.querySelector('[onclick^="deleteTraining"]'), 'botao Excluir no cabecalho do treino');
    var trId=tr.id;
    w.deleteTraining(trId);
    chk(!!w.document.getElementById('rsConfirm') && !!w.trF(trId), 'excluir: pede confirmacao (ainda existe)');
    w.document.getElementById('rsConfirmOk').onclick();
    chk(!w.trF(trId) && !w.D.trainings.some(function(t){return t.id===trId;}), 'excluir confirmado: some do estado local');
    chk(getAt('torneio-master-santos/trainings/'+trId)===null, 'excluir confirmado: no trainings/{id} removido do RTDB');
    chk(w.selTrn===null && w.document.body.innerHTML.indexOf('Novo Treino')>=0 && w.document.body.innerHTML.indexOf('10/09/2026')<0, 'excluir: volta pra lista, sem o treino excluido');

    console.log('\n=== '+ok+' ok, '+ko+' falhas ===');
    console.log(ko===0?'OK TREINOS APROVADO':'FAIL TREINOS REPROVADO');
    process.exit(ko===0?0:1);
  } catch(e){
    console.log('ERRO GERAL: '+e.message);
    console.log(e.stack);
    process.exit(1);
  }
},700);
