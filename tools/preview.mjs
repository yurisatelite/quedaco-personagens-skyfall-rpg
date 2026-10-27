// Harness local, sem conexão com o Foundry e sem escrita de Actors.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const types={'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.ttf':'font/ttf','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png'};
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const target=resolve(root,`.${decodeURIComponent(url.pathname==='/'?'/tools/preview.html':url.pathname)}`);
  if(!target.startsWith(root+sep)){res.writeHead(403).end();return;}
  try{const body=await readFile(target);res.writeHead(200,{'Content-Type':types[extname(target)]??'application/octet-stream','Cache-Control':'no-store'});res.end(body);}catch{res.writeHead(404).end();}
});
server.listen(4319,'127.0.0.1',()=>console.log('Prévia local: http://127.0.0.1:4319 (nenhum Actor será criado)'));
