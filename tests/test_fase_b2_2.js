// Fase B2.2 — admin actions no fluxo unificado + UI manual da tarja.
// Asserta:
//   1. canManageTorneio() = true em torneioMode+admin unlock OU (!torneioMode && isAdmin/isCoord)
//   2. Botoes gd-edit/gd-del aparecem pra admin/coord no fluxo unificado (sem senha)
//   3. Sem papel admin no fluxo unificado: NAO mostra botoes
//   4. Botao Novo Jogo aparece no rTorDetail gameday se admin/coord
//   5. openTorneioNovoJogo via admin (fluxo unificado) abre o form direto (sem gate de senha)
//   6. Modal do editor contem o bloco de radios da tarja (Nenhuma/SEM DADOS/CANCELADO)
//   7. Salvar com tarja=cancelled persiste g.status_tag e mostra CANCELADO no card
//   8. Editar jogo existente pre-seleciona o radio correto
//   9. salvarTorneioJogo no fluxo unificado usa selTor como torId
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
    teams:[{id:'trs',n:'RS Adulto Masc',c:'#2563eb',roster:[{aid:'a1'}]}],
    athletes:[{aid:'a1',nm:'Atleta 1',po:'Ponta'}],
    tournaments:[{id:'t_usa_open',n:'2026 Adult Open Championship',c:'#1d7a3a',color:'#1d7a3a'}],
    games:[
      {id:'g1',torId:'t_usa_open',tid:'trs',opp:'Time A',dt:'2026-07-10',tm:'10:00',st:'pending',lineup:[{aid:'a1',nu:1}]}
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

    chk(typeof w.canManageTorneio==='function','canManageTorneio() helper existe');

    // 1. Sem papel admin no fluxo unificado: nao destrava
    w.torneioMode=false; w.isAdmin=false; w.isCoord=false;
    chk(w.canManageTorneio()===false,'canManageTorneio: fluxo unificado sem papel admin = false');

    // 2. Com papel admin no fluxo unificado: destrava
    w.isCoord=true;
    chk(w.canManageTorneio()===true,'canManageTorneio: fluxo unificado com isCoord = true');
    w.isCoord=false; w.isAdmin=true;
    chk(w.canManageTorneio()===true,'canManageTorneio: fluxo unificado com isAdmin = true');

    // 3. Modo isolado legado: precisa de torneioAdminUnlocked
    w.isAdmin=false; w.torneioMode=true; w.torneioAdminUnlocked=false;
    chk(w.canManageTorneio()===false,'canManageTorneio: isolado sem unlock = false');
    w.torneioAdminUnlocked=true;
    chk(w.canManageTorneio()===true,'canManageTorneio: isolado com unlock = true');

    // 4. Resetar pro fluxo unificado e renderizar a aba Torneios com isCoord=true
    w.torneioMode=false; w.torneioAdminUnlocked=false; w.isAdmin=false; w.isCoord=true;
    w.showLanding=false; w.signupMode=false;
    w.tab='torneios'; w.selectTor('t_usa_open');
    const m1 = w.document.getElementById('mainApp').innerHTML;
    chk(m1.indexOf('gd-edit')>=0,'rTorDetail gameday + isCoord: gd-edit aparece (Editar jogo)');
    chk(m1.indexOf('gd-del')>=0,'rTorDetail gameday + isCoord: gd-del aparece (Excluir jogo)');
    chk(m1.indexOf('➕ Novo Jogo')>=0 || m1.indexOf('Novo Jogo')>=0,'rTorDetail gameday + isCoord: botao Novo Jogo presente');

    // 5. Sem papel: botoes desaparecem
    w.isCoord=false; w.render();
    const m2 = w.document.getElementById('mainApp').innerHTML;
    chk(m2.indexOf('gd-edit')<0,'sem papel: gd-edit NAO aparece');
    chk(m2.indexOf('gd-del')<0,'sem papel: gd-del NAO aparece');

    // 6. Voltar pra admin e abrir o modal direto (sem gate de senha no unificado)
    w.isCoord=true; w.selTor='t_usa_open'; w.render();
    // limpar modal anterior se houver
    var prev = w.document.getElementById('tnjModal'); if(prev) prev.remove();
    w.openTorneioNovoJogo();
    var modal = w.document.getElementById('tnjModal');
    chk(modal!=null,'openTorneioNovoJogo (admin no unificado): modal aberto direto');
    if(modal){
      const html = modal.innerHTML;
      chk(html.indexOf('NOVO JOGO')>=0,'modal: titulo NOVO JOGO');
      chk(html.indexOf('tnj-admin-pwd')<0,'modal: NAO eh o gate de senha (sem campo tnj-admin-pwd)');
      // Bloco de tarja
      chk(html.indexOf('name="tnj-tarja"')>=0,'modal: contem radios da tarja (name="tnj-tarja")');
      const radios = modal.querySelectorAll('input[name="tnj-tarja"]');
      chk(radios.length===3,'modal: 3 opcoes de tarja (Nenhuma/SEM DADOS/CANCELADO): '+radios.length);
      // "Nenhuma" eh o default
      chk(radios[0].value==='' && radios[0].checked===true,'modal: opcao "Nenhuma" eh o default em modo criar');
    }

    // 7. Preencher campos + escolher CANCELADO + salvar
    w.document.getElementById('tnj-opp').value='Time X';
    w.document.getElementById('tnj-dt').value='2026-08-01';
    w.document.getElementById('tnj-tm').value='15:00';
    // Selecionar o radio CANCELADO
    var radios = w.document.getElementsByName('tnj-tarja');
    for(var i=0;i<radios.length;i++){ if(radios[i].value==='cancelled') radios[i].checked=true; else radios[i].checked=false; }
    const gamesAntes = w.D.games.length;
    w.salvarTorneioJogo();
    chk(w.D.games.length===gamesAntes+1,'salvarTorneioJogo (admin no unificado): jogo novo inserido');
    var novo = w.D.games[w.D.games.length-1];
    chk(novo.torId==='t_usa_open','novo jogo: torId="t_usa_open" (via selTor)');
    chk(novo.opp==='Time X','novo jogo: adversario preservado');
    chk(novo.status_tag==='cancelled','novo jogo: status_tag="cancelled" persistido');
    chk(w.document.getElementById('tnjModal')==null,'modal fecha apos salvar');

    // 8. Renderizar e ver a tarja CANCELADO no card novo
    w.render();
    const m3 = w.document.getElementById('mainApp').innerHTML;
    chk(m3.indexOf('CANCELADO')>=0,'apos salvar: tarja CANCELADO aparece no card do jogo novo');
    chk(m3.indexOf('data-tarja="cancelled"')>=0,'apos salvar: GAME DAY card tem data-tarja="cancelled"');

    // 9. Editar o jogo recem-criado: radio CANCELADO deve vir pre-selecionado
    var prev2 = w.document.getElementById('tnjModal'); if(prev2) prev2.remove();
    w.openTorneioEditarJogo(novo.id);
    var modal2 = w.document.getElementById('tnjModal');
    chk(modal2!=null,'openTorneioEditarJogo (admin no unificado): modal aberto');
    if(modal2){
      const radios2 = modal2.querySelectorAll('input[name="tnj-tarja"]');
      var preChecked = '';
      for(var j=0;j<radios2.length;j++){ if(radios2[j].checked) { preChecked = radios2[j].value; break; } }
      chk(preChecked==='cancelled','modal editar: radio CANCELADO vem pre-selecionado');

      // Mudar pra "Nenhuma" e salvar — deve REMOVER status_tag
      for(var k=0;k<radios2.length;k++){ if(radios2[k].value==='') radios2[k].checked=true; else radios2[k].checked=false; }
      w.salvarTorneioJogo();
      var atualizado = w.gF(novo.id);
      chk(!atualizado.status_tag,'salvarTorneioJogo (editar): tarja removida (status_tag undefined)');
    }

    // 10. Sem permissao: openTorneioNovoJogo dispara o gate de senha (legacy)
    w.isCoord=false; w.isAdmin=false; w.torneioMode=true; w.torneioAdminUnlocked=false;
    var prev3 = w.document.getElementById('tnjModal'); if(prev3) prev3.remove();
    w.openTorneioNovoJogo();
    var modal3 = w.document.getElementById('tnjModal');
    chk(modal3!=null,'sem papel + isolado: modal abre');
    if(modal3){
      chk(modal3.innerHTML.indexOf('tnj-admin-pwd')>=0,'sem papel + isolado: abre o gate de senha (campo tnj-admin-pwd)');
    }

    // 11. CSS dos radios
    const css = htmlMod.match(/<style>([\s\S]*?)<\/style>/)[1];
    chk(css.indexOf('.tnj-tarja-row')>=0,'CSS: .tnj-tarja-row existe');
    chk(css.indexOf('.tnj-tarja-cancelled')>=0,'CSS: .tnj-tarja-cancelled (vermelho)');

    console.log('\n=== '+ok+' ok, '+ko+' falhas ===');
    console.log(ko===0?'OK FASE B2.2 APROVADA':'FAIL FASE B2.2 REPROVADA');
    process.exit(ko===0?0:1);
  } catch(e){
    console.log('ERRO GERAL: '+e.message);
    console.log(e.stack);
    process.exit(1);
  }
},700);
