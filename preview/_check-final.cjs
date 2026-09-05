/* Confere as duas duvidas do Rodrigo, no caminho real:
   1) sair do "EM OBRAS" pede confirmacao e da para voltar com a chave
   2) criar e excluir um jogo funciona, e leva junto as acoes marcadas nele  */
const fs=require('fs');const {JSDOM}=require('jsdom');
const html=fs.readFileSync('cores.html','utf8');
const core=fs.readFileSync('cores-core.js','utf8');
const mod=html.replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>/g,'')
 .replace(/<script src="cores-core\.js[^"]*"><\/script>/,'<script>'+core+'</script>')
 .replace('firebase.initializeApp(fc);','var firebase=window.fbm; firebase.initializeApp(fc);');
const db={'torneio-cores':{config:{nome:'T',setPoints:21,vantagem:2,emQuadra:4},
 teams:{t1:{id:'t1',n:'AZUL',cor:'#00f',ordem:0,players:[{id:'a1',nm:'ANA'},{id:'a2',nm:'BIA'},{id:'a3',nm:'CAU'},{id:'a4',nm:'DU'}]},
        t2:{id:'t2',n:'PRETO',cor:'#111',ordem:1,players:[{id:'b1',nm:'EDU'},{id:'b2',nm:'FE'},{id:'b3',nm:'GUI'},{id:'b4',nm:'HEL'}]}},
 games:{}}};
const LS=[];
function P(p){return String(p).split('/').filter(Boolean);}
function get(p){let c=db;for(const k of P(p)){if(c==null)return null;c=c[k];}return c===undefined?null:c;}
function set(p,v){const a=P(p);let c=db;for(let i=0;i<a.length-1;i++){if(c[a[i]]==null||typeof c[a[i]]!=='object')c[a[i]]={};c=c[a[i]];}
 if(v===null)delete c[a[a.length-1]];else c[a[a.length-1]]=JSON.parse(JSON.stringify(v));fire();}
function fire(){LS.slice().forEach(l=>{try{l.cb({val:()=>get(l.path)});}catch(e){}});}
let seq=0;
const ref=p=>({on(e,cb){LS.push({path:p,cb});cb({val:()=>get(p)});},off(){},once(){return Promise.resolve({val:()=>get(p)});},
 set(v){set(p,v);return Promise.resolve();},remove(){set(p,null);return Promise.resolve();},
 push(v){seq++;const k='-K'+String(seq).padStart(5,'0');set(p+'/'+k,v);return Promise.resolve({key:k});}});
const fbm={initializeApp(){},database:()=>({ref})};
let confirmou=null;
function abrir(qs,respostaConfirm){
  const d=new JSDOM(mod,{url:'http://localhost/cores.html'+qs,runScripts:'dangerously',pretendToBeVisual:true,
    beforeParse(w){w.fbm=fbm;w.alert=()=>{};w.confirm=(m)=>{confirmou=m;return respostaConfirm!==false;};}});
  return d.window;
}
const wait=ms=>new Promise(r=>setTimeout(r,ms||60));
let ok=0,fail=0;
const t=(n,c,x)=>{if(c){ok++;console.log('  ✓ '+n);}else{fail++;console.log('  ✗ '+n+(x?'\n      '+x:''));}};
(async()=>{
  /* A parte 1 so faz sentido com a pagina fechada. Hoje ela esta ABERTA
     (EM_OBRAS=false) — entao esta secao confere o cenario oposto: ninguem
     precisa de chave e nao ha selo nenhum. */
  const FECHADA=/var EM_OBRAS=true/.test(html);
  console.log('\n== 1) trava de publico (pagina '+(FECHADA?'FECHADA':'ABERTA')+') ==');
  if(FECHADA){
    const w1=abrir('?dev=rs2026',false); await wait(120);
    t('entrou com a chave', !!w1.document.querySelector('.hd-nav'));
    const selo=w1.document.querySelector('.hd-obras');
    t('o selo EM OBRAS esta no topo', !!selo);
    confirmou=null; selo.click(); await wait(80);
    t('clicar PEDE confirmacao', confirmou!==null, 'sairia sem avisar');
    t('o aviso explica como voltar', /dev=rs2026/.test(confirmou||''), confirmou||'');
    t('recusando, CONTINUA no app', w1.localStorage.getItem('cores_dev')==='1' && !!w1.document.querySelector('.hd-nav'));
    const w2=abrir('?dev=rs2026',true); await wait(120);
    w2.document.querySelector('.hd-obras').click(); await wait(80);
    t('confirmando, o aparelho volta a ser publico', w2.localStorage.getItem('cores_dev')===null);
    const w3=abrir('?dev=rs2026',true); await wait(120);
    t('e da para entrar de novo com a chave', !!w3.document.querySelector('.hd-nav') && w3.localStorage.getItem('cores_dev')==='1');
  }else{
    const w1=abrir('?',true); await wait(120);
    t('o publico entra sem chave', !!w1.document.querySelector('.hd-nav'));
    t('nao ha selo EM OBRAS no topo', !w1.document.querySelector('.hd-obras'));
    const w2=abrir('?v=admin',true); await wait(160);
    t('o Admin abre sem chave', !!w2.document.getElementById('ng-a'));
  }


  console.log('\n== 2) criar e excluir um jogo ==');
  const A=abrir('?v=admin&dev=rs2026',true); await wait(160);
  A.document.getElementById('ng-a').value='t1';
  A.document.getElementById('ng-b').value='t2';
  A.document.getElementById('ng-dt').value='2026-09-05';
  [...A.document.querySelectorAll('button')].find(b=>b.textContent.includes('Criar jogo')).click(); await wait(120);
  const criados=Object.keys(get('torneio-cores/games')||{});
  t('jogo criado', criados.length===1, JSON.stringify(criados));
  const gid=criados[0];
  set('torneio-cores/events/'+gid+'/-K9', {t:'act',tid:'t1',jid:'a1',ak:'ataque',oc:'Ponto',rally:0});
  t('tem acao marcada nele', Object.keys(get('torneio-cores/events/'+gid)||{}).length===1);
  const A2=abrir('?v=admin&dev=rs2026',true); await wait(160);
  const btn=[...A2.document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Excluir' && b.getAttribute('onclick').includes(gid));
  t('o botao Excluir aparece no Admin', !!btn);
  confirmou=null; btn.click(); await wait(150);
  t('pede confirmacao antes', /Excluir o jogo/.test(confirmou||''), confirmou||'');
  t('o jogo sumiu', !get('torneio-cores/games/'+gid));
  t('as acoes dele sumiram junto (nao vira lixo no banco)', !get('torneio-cores/events/'+gid));
  t('as equipes continuam intactas', Object.keys(get('torneio-cores/teams')||{}).length===2);
  console.log('\n'+(fail?'✗ '+fail+' FALHA(S) · ':'✓ TUDO VERDE · ')+ok+' checagens');
  process.exit(fail?1:0);
})();
