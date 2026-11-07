/** Deploy the portfolio front page + THE ACTUAL AFTERTONE app under /demo/.
 * Keep the original public/ application untouched for the Node server.
 * Only static browser-safe assets are published, not server code or credentials.
 */
import {rmSync,mkdirSync,cpSync,copyFileSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const dist=resolve(root,'dist');
rmSync(dist,{recursive:true,force:true});mkdirSync(dist,{recursive:true});
// Restore the original product-and-engineering portfolio landing page.
copyFileSync(resolve(root,'site/index.html'),resolve(dist,'index.html'));
copyFileSync(resolve(root,'site/styles.css'),resolve(dist,'styles.css'));
copyFileSync(resolve(root,'site/splash.js'),resolve(dist,'splash.js'));
cpSync(resolve(root,'site/assets'),resolve(dist,'assets'),{recursive:true});
// Publish the *full* application as an embedded, separately addressable demo.
const demo=resolve(dist,'demo');mkdirSync(demo,{recursive:true});
cpSync(resolve(root,'app/public'),demo,{recursive:true});
cpSync(resolve(root,'app/src'),resolve(demo,'src'),{recursive:true});
for(const file of ['index.html','main.js','api-browser.js']){
  const path=resolve(demo,file);
  let content=readFileSync(path,'utf8');
  if(file==='index.html')content=content.replaceAll('href="/','href="./').replaceAll('src="/','src="./');
  else content=content.replaceAll("from '/src/", "from './src/");
  writeFileSync(path,content);
}
writeFileSync(resolve(demo,'.nojekyll'),'');
writeFileSync(resolve(dist,'.nojekyll'),'');
writeFileSync(resolve(dist,'CNAME'),'aftertone.masynnay.com\n');
console.log('Built portfolio landing + untouched full AFTERTONE embedded at dist/demo/');
