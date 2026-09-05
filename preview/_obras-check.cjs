/* Confere a tela "em construcao" servida como o PUBLICO ve (sem a chave),
   e a entrada com a chave. Usa o cores.html real com Firebase mockado. */
const fs=require('fs');const {JSDOM}=require('jsdom');
const html=fs.readFileSync('cores.html','utf8');
const core=fs.readFileSync('cores-core.js','utf8');
const mod=html.replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>/g,'')
  .replace('<script src="cores-core.js"></script>','<script>'+core+'</script>')
  .replace('firebase.initializeApp(fc);','var firebase=window.fbm; firebase.initializeApp(fc);');
const db={'torneio-cores':{config:{nome:'Mini Minis - Cores'},teams:{},games:{}}};
const ref=p=>({on:(e,cb)=>cb({val:()=>{let c=db;for(const k of p.split('/').filter(Boolean)){if(c==null)return null;c=c[k];}return c===undefined?null:c;}}),
  off(){},once(){return Promise.resolve({val:()=>null});},set(){return Promise.resolve();},remove(){return Promise.resolve();},push(){return Promise.resolve({key:'x'});}});
const fbm={initializeApp(){},database:()=>({ref})};
function abrir(qs){
  const d=new JSDOM(mod,{url:'http://localhost/cores.html'+qs,runScripts:'dangerously',pretendToBeVisual:true,
    beforeParse(w){w.fbm=fbm;w.confirm=()=>true;w.alert=()=>{};}});
  return d.window;
}
const wait=ms=>new Promise(r=>setTimeout(r,ms||60));
(async()=>{
  let ok=0,fail=0;
  const t=(n,c)=>{ if(c){ok++;console.log('  ✓ '+n);} else {fail++;console.log('  ✗ '+n);} };
  const pub=abrir('?'); await wait();
  const txtPub=(pub.document.querySelector('#app')||pub.document.body).textContent.replace(/\s+/g,' ');
  console.log('\n== como o PUBLICO ve ==');
  t('mostra "EM CONSTRUÇÃO"', txtPub.includes('EM CONSTRUÇÃO'));
  t('mostra o nome do torneio', txtPub.includes('Mini Minis'));
  t('leva de volta ao site', !!pub.document.querySelector('a[href*="rsvoleibol.com.br"]'));
  t('NAO mostra o app (sem abas)', !pub.document.querySelector('.hd-nav'));
  t('NAO mostra jogos', !pub.document.querySelector('.gcard'));
  t('NAO da para abrir a mesa por URL', (()=>{const m=abrir('?v=mesa&g=j1');return !m.document.querySelector('.mesa-top');})());
  t('NAO da para abrir o admin por URL', (()=>{const a=abrir('?v=admin');return !a.document.querySelector('#nt-n');})());
  t('NAO da para abrir o telao por URL', (()=>{const w=abrir('?v=telao');return !w.document.querySelector('.tl-main');})());

  console.log('\n== com a chave ==');
  const dev=abrir('?dev=rs2026'); await wait();
  t('entra no app', !!dev.document.querySelector('.hd-nav'));
  t('marca o aparelho como liberado', dev.localStorage.getItem('cores_dev')==='1');
  t('mostra o selo EM OBRAS no topo', !!dev.document.querySelector('.hd-obras'));
  console.log('\n'+(fail?'✗ '+fail+' FALHA(S) · ':'✓ TUDO VERDE · ')+ok+' checagens');
  process.exit(fail?1:0);
})();
