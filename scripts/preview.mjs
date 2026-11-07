/** Local preview server; never included in the deployed static build. */
import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve(import.meta.dirname,'..','dist');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
const port=4174;
http.createServer(async(req,res)=>{
  let pathname;
  try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end('Bad request');return;}
  const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  // Reject traversal or directories before performing filesystem IO.
  if(!file.startsWith(root+sep)){res.writeHead(403).end('Forbidden');return;}
  try{const info=await stat(file);if(!info.isFile())throw Error('not file');const bytes=await readFile(file);
    res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(bytes);
  }catch{res.writeHead(404).end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`AFTERTONE portfolio preview: http://127.0.0.1:${port}`));
