// Servidor estatico LOCAL para teste (temporario — NAO commitar).
// Serve o index.html modificado em http://localhost:8765/.
// ATENCAO: o app conecta no Firebase REAL (scola-volei). Para testar a CARA
// (galeria-first, abas escondidas) basta logar e navegar — evite criar/gravar
// dados, pois iria pro banco de producao.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = parseInt(process.env.PORT, 10) || 8765;
const CT = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.gif':'image/gif',
  '.svg':'image/svg+xml', '.json':'application/json', '.ico':'image/x-icon',
  '.woff':'font/woff', '.woff2':'font/woff2', '.webp':'image/webp',
  '.webmanifest':'application/manifest+json'
};

const server = http.createServer(function(req, res){
  var p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/' || p === '') p = '/index.html';
  var fp = path.join(ROOT, p);
  if (fp.indexOf(ROOT) !== 0) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(fp, function(err, data){
    if (err) { res.writeHead(404, {'Content-Type':'text/plain'}); res.end('404 ' + p); return; }
    res.writeHead(200, {'Content-Type': CT[path.extname(fp).toLowerCase()] || 'application/octet-stream'});
    res.end(data);
  });
});

server.on('error', function(e){
  console.error('ERRO ao subir servidor:', e.code === 'EADDRINUSE' ? ('porta '+PORT+' ja em uso') : e.message);
  process.exit(1);
});

server.listen(PORT, '127.0.0.1', function(){
  console.log('LOCAL TESTE no ar: http://localhost:' + PORT + '/');
});
