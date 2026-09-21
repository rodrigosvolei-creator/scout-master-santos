// Posicao (funcao) PADRONIZADA: 5 codigos fixos, rotulo no genero do time/atleta (Ponteira x
// Ponteiro x Ponteiro(a)), grafia antiga do banco normalizada na leitura e na gravacao, e NENHUM
// campo de texto livre (tudo por select). Cobre: posGroup/posLabel/posShow, teamGender, perfil
// (pFind), modais (banco de atletas, editar atleta, escalacao + avulso), menu da quadra.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');

const fakeDB = {};
const listeners = {};
function getAt(p){const a=p.split('/');let c=fakeDB;for(const k of a){if(c==null)return null;c=c[k];}return c===undefined?null:c;}
function setAt(p,v){const a=p.split('/');let c=fakeDB;for(let i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}c[a[a.length-1]]=JSON.parse(JSON.stringify(v));}
function makeRef(p){return{on:(e,cb)=>{listeners[p]=cb;},once:()=>Promise.resolve({val:()=>getAt(p)}),set:v=>{setAt(p,v);return Promise.resolve();},update:()=>Promise.resolve(),remove:()=>Promise.resolve()};}
global.firebaseMock={initializeApp:()=>{},database:()=>({ref:makeRef}),auth:()=>({onAuthStateChanged:cb=>setTimeout(()=>cb({uid:'tester',email:'rodrigosvolei@gmail.com',displayName:'Tester'}),0),signInWithPopup:()=>Promise.resolve(),signOut:()=>Promise.resolve()})};

// grafias REAIS encontradas no banco de producao (18/09/2026) + genero
const seed={'torneio-master-santos':{
  teams:[
    {id:'tf',n:'RS FEMININO C',c:'#db2777',roster:[{aid:'f1'},{aid:'f2'},{aid:'f3'},{aid:'f4'},{aid:'f5'},{aid:'f6'}]},
    {id:'tm',n:'RS-VOLEIBOL ADULTO MASCULINO',c:'#2563eb',roster:[{aid:'m1'},{aid:'m2'},{aid:'m3'}]},
    {id:'tx',n:'RS COLOMBIA',c:'#64748b',roster:[{aid:'x1'}]}
  ],
  athletes:[
    {aid:'f1',nm:'Ana',po:'Ponteiro(a)'},{aid:'f2',nm:'Bia',po:'Ponteira/Oposta'},{aid:'f3',nm:'Carol',po:'Levantadora'},
    {aid:'f4',nm:'Dani',po:'Central'},{aid:'f5',nm:'Eva',po:'Líbero'},{aid:'f6',nm:'Fabi',po:''},
    {aid:'m1',nm:'Joao',po:'Ponteiro'},{aid:'m2',nm:'Kadu',po:'Oposto(a)',gender:'M'},{aid:'m3',nm:'Leo',po:'Oposta/Ponteira'},
    {aid:'x1',nm:'Zed',po:'Goleiro'}
  ],
  tournaments:[{id:'tA',n:'Liga',c:'#2563eb'}],
  games:[{id:'gf',torId:'tA',tid:'tf',opp:'Adv F',dt:'2026-09-21',st:'live',ss:[{u:0,t:0}],courtMode:true,lineup:[{aid:'f1',nu:1},{aid:'f2',nu:2},{aid:'f3',nu:3},{aid:'f4',nu:4},{aid:'f5',nu:5},{aid:'f6',nu:6}]},
         {id:'gm',torId:'tA',tid:'tm',opp:'Adv M',dt:'2026-09-21',st:'pending',lineup:[{aid:'m1',nu:7},{aid:'m2',nu:8},{aid:'m3',nu:9}]}],
  invites:{}}};
Object.assign(fakeDB,JSON.parse(JSON.stringify(seed)));

const htmlMod=html.replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>/g,'')
  .replace('firebase.initializeApp(fc);','var firebase=window.firebaseMock; firebase.initializeApp(fc);');
const dom=new JSDOM(htmlMod,{url:'https://master.exemplo.com.br/?app=1',runScripts:'dangerously',pretendToBeVisual:true,
  beforeParse(window){window.firebaseMock=global.firebaseMock;window.alert=()=>{};window.navigator.vibrate=()=>{};}});
const w=dom.window;
let ok=0,ko=0; function chk(c,m){if(c){ok++;console.log('OK   '+m);}else{ko++;console.log('FAIL '+m);}}
const opts=sel=>Array.from(sel.querySelectorAll('option')).map(o=>o.textContent);
const selected=sel=>{const o=sel.querySelector('option[selected]')||sel.options[sel.selectedIndex];return o?o.textContent:null;};

setTimeout(()=>{
  try{
    ['teams','games','tournaments','athletes','invites'].forEach(k=>{const p='torneio-master-santos/'+k;if(listeners[p])listeners[p]({val:()=>getAt(p)});});
    w.currentUser={uid:'tester',email:'rodrigosvolei@gmail.com'}; w.isCoord=true; w.isAdmin=true;

    console.log('\n--- 1. leitura de qualquer grafia -> codigo ---');
    const G=w.posGroup;
    chk(G('Ponteiro(a)')==='pon'&&G('Ponteiro')==='pon'&&G('Ponteira')==='pon'&&G('Ponta')==='pon', 'ponteiro em 4 grafias -> pon');
    chk(G('Oposto(a)')==='opo'&&G('Oposta')==='opo'&&G('Oposto')==='opo', 'oposto em 3 grafias -> opo');
    chk(G('Levantador(a)')==='lev'&&G('Levantadora')==='lev'&&G('Levantador')==='lev', 'levantador em 3 grafias -> lev');
    chk(G('Central')==='cen'&&G('Líbero')==='lib'&&G('Libero')==='lib'&&G('lib')==='lib', 'central / libero (com e sem acento)');
    chk(G('Ponteira/Oposta')==='pon'&&G('Oposta/Ponteira')==='opo', 'funcao dupla: vale a primeira citada');
    chk(G('')===''&&G(null)===''&&G('Goleiro')==='', 'vazio e texto que nao e posicao -> sem codigo');

    console.log('\n--- 2. rotulo por genero ---');
    chk(w.posLabel('pon','F')==='Ponteira'&&w.posLabel('pon','M')==='Ponteiro'&&w.posLabel('pon','')==='Ponteiro(a)', 'pon: Ponteira / Ponteiro / Ponteiro(a)');
    chk(w.posLabel('lev','F')==='Levantadora'&&w.posLabel('opo','F')==='Oposta'&&w.posLabel('cen','F')==='Central'&&w.posLabel('lib','F')==='Líbero', 'feminino: Levantadora, Oposta, Central, Líbero');
    chk(w.posShow('Ponteira/Oposta','F')==='Ponteira'&&w.posShow('Ponteiro(a)','M')==='Ponteiro'&&w.posShow('Goleiro','F')==='Goleiro'&&w.posShow('','F')==='', 'posShow normaliza grafia antiga; desconhecida fica como esta');

    console.log('\n--- 3. genero do time ---');
    chk(w.teamGender(w.tF('tf'))==='F'&&w.teamGender(w.tF('tm'))==='M', 'pelo nome: FEMININO -> F, MASCULINO -> M');
    chk(w.teamGender(w.tF('tx'))==='', 'sem pista no nome nem no roster -> neutro');
    var tx=w.tF('tx'); tx.gen='F'; chk(w.teamGender(tx)==='F', 't.gen explicito manda'); tx.gen='';
    w.aFind('x1').gender='M'; chk(w.teamGender(tx)==='M', 'maioria do roster decide quando o nome nao diz'); delete w.aFind('x1').gender;
    chk(w.athGender(w.aFind('m2'),w.tF('tf'))==='M', 'genero do ATLETA prevalece sobre o do time');

    console.log('\n--- 4. perfil (pFind) ja sai padronizado no genero ---');
    chk(w.pFind('f2','gf').po==='Ponteira'&&w.pFind('f3','gf').po==='Levantadora'&&w.pFind('f1','gf').po==='Ponteira', 'time feminino: Ponteira / Levantadora (grafias antigas convertidas)');
    chk(w.pFind('m1','gm').po==='Ponteiro'&&w.pFind('m3','gm').po==='Oposto', 'time masculino: Ponteiro / Oposto');
    chk(w.pFind('f6','gf').po==='', 'sem posicao continua vazio (nao inventa)');
    chk(w._isLibero(w.pFind('f5','gf')), '_isLibero continua reconhecendo Líbero');

    console.log('\n--- 5. modais: so SELECT, opcoes no genero, sem texto livre ---');
    w.editAthleteFromBank('f2');
    var ab=w.document.getElementById('ab-po');
    chk(ab&&ab.tagName==='SELECT'&&opts(ab).join(',')==='Levantadora,Oposta,Ponteira,Central,Líbero', 'banco de atletas (atleta de time feminino): 5 opcoes femininas, sem "(a)"');
    chk(selected(ab)==='Ponteira', '"Ponteira/Oposta" pre-seleciona Ponteira');
    ab.value='Oposta'; w.document.getElementById('ab-nm').value='Bia'; w.saveAthBank('f2');
    chk(w.aFind('f2').po==='Oposta', 'salvar do banco grava o rotulo canonico ("Oposta")');
    w.editP('tm','m1');
    var ep=w.document.getElementById('ep-po');
    chk(ep&&ep.tagName==='SELECT'&&opts(ep).join(',')==='Levantador,Oposto,Ponteiro,Central,Líbero'&&selected(ep)==='Ponteiro', 'editar atleta (time masculino): opcoes masculinas, "Ponteiro" pre-selecionado');
    ep.value='Central'; w.saveEdit('tm','m1');
    chk(w.aFind('m1').po==='Central', 'saveEdit grava canonico');
    w.togAP('tf');
    var mp=w.document.getElementById('modal-ppo');
    chk(mp&&mp.tagName==='SELECT'&&opts(mp).indexOf('Ponteira')>=0&&opts(mp).indexOf('Ponteiro(a)')<0, 'novo atleta no time feminino: select feminino');
    w.closeAddAthModal();
    chk(w.document.querySelectorAll('input[id$="-po"]').length===0, 'nenhum <input> de posicao sobrou nos modais abertos');

    console.log('\n--- 6. escalacao: select por linha normalizado + avulso por select ---');
    w.openLineup('gf');
    var luNew=w.document.getElementById('lu-new-po');
    chk(luNew&&luNew.tagName==='SELECT'&&opts(luNew)[0].indexOf('posição')>=0&&opts(luNew).indexOf('Ponteira')>=0, 'campo "Posição" do avulso virou SELECT (com opcao vazia) no genero do time');
    var rowSel=w.document.querySelector('.lu-row[data-aid="f3"] .lu-po');
    chk(rowSel&&opts(rowSel).indexOf('Levantadora')>=0&&selected(rowSel)==='Levantadora'&&opts(rowSel).indexOf('Levantador(a)')<0, 'linha da escalacao: "Levantadora" antiga cai na opcao padrao, sem opcao solta');
    w.document.getElementById('lu-new-nu').value='99'; w.document.getElementById('lu-new-nm').value='Visitante'; luNew.value='Oposta';
    w.addAdhocAthlete('gf'); w.saveLineup('gf');
    var ad=w.gF('gf').lineup.filter(l=>l.nu===99)[0];
    chk(ad&&ad.po==='Oposta', 'avulsa: posicao escolhida no select gravada canonica no genero do time');

    console.log('\n--- 7. quadra: menu de trocar posicao no genero + gravacao canonica ---');
    w.openGameDayCard('gf'); w.S.aid='gf';
    w.courtEditPos('f1');
    var menu=w.document.getElementById('rsPosMenu');
    var btns=menu?Array.from(menu.querySelectorAll('button.bt')).map(b=>b.textContent.replace(' ✓','')):[];
    chk(btns.join(',')==='Levantadora,Oposta,Ponteira,Central,Líbero', 'menu da quadra: 5 funcoes femininas');
    chk(menu&&menu.innerHTML.indexOf('Ponteira ✓')>=0, 'funcao atual ("Ponteiro(a)" antiga) marcada como Ponteira');
    w.courtSetPos('f1','Líbero');
    chk(w.aFind('f1').po==='Líbero'&&w.gF('gf').lineup.filter(l=>l.aid==='f1')[0].po==='Líbero'&&w._isLibero(w.pFind('f1','gf')), 'courtSetPos: cadastro + jogo canonico, libero reconhecido');

    console.log('\n=== test_posicoes: '+ok+' OK, '+ko+' FAIL ===');
    process.exit(ko?1:0);
  }catch(e){console.log('FAIL exception: '+e.message);console.log((e.stack||'').split('\n').slice(0,6).join('\n'));process.exit(1);}
},400);
