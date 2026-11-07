/**
 * Deploy the ACTUAL AFTERTONE v0.10 UI and discovery engine to GitHub Pages.
 * The browser adapter exchanges the original same-origin API routes for public
 * Deezer JSONP metadata and short-lived CDN audio. No API tokens are bundled.
 * Original Node server and test modules stay in the repository for local mode.
 */
import {rmSync,mkdirSync,cpSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const dist=resolve(root,'dist');
rmSync(dist,{recursive:true,force:true});mkdirSync(dist,{recursive:true});
cpSync(resolve(root,'public'),dist,{recursive:true});
cpSync(resolve(root,'src'),resolve(dist,'src'),{recursive:true});
// Relative paths work on both a custom domain root and the standard
// https://<user>.github.io/<repo>/ project path.
for(const file of ['index.html','main.js','api-browser.js']){
  const path=resolve(dist,file);
  let content=readFileSync(path,'utf8');
  if(file==='index.html')content=content.replaceAll('href="/','href="./').replaceAll('src="/','src="./');
  else content=content.replaceAll("from '/src/", "from './src/");
  writeFileSync(path,content);
}
writeFileSync(resolve(dist,'.nojekyll'),'');
writeFileSync(resolve(dist,'CNAME'),'aftertone.masynnay.com\n');
console.log('Built original AFTERTONE v0.10.1 interface and browser Deezer adapter at dist/');
