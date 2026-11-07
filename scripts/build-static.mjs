/** Deploy the portfolio front page + THE ACTUAL AFTERTONE app under /demo/.
 * Keep the original public/ application untouched for the Node server.
 * Only static browser-safe assets are published, not server code or credentials.
 */
import {rmSync,mkdirSync,cpSync,copyFileSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const dist=resolve(root,'dist');
rmSync(dist,{recursive:true,force:true});mkdirSync(dist,{recursive:true});
// Publish a standalone portfolio homepage; no modal, iframe, or client script.
copyFileSync(resolve(root,'site/index.html'),resolve(dist,'index.html'));
copyFileSync(resolve(root,'site/styles.css'),resolve(dist,'styles.css'));
cpSync(resolve(root,'site/assets'),resolve(dist,'assets'),{recursive:true});
// Publish the *full* AFTERTONE application under /demo/ with no changes to application logic.
const demo=resolve(dist,'demo');mkdirSync(demo,{recursive:true});
cpSync(resolve(root,'app/public'),demo,{recursive:true});
cpSync(resolve(root,'app/src'),resolve(demo,'src'),{recursive:true});
// The original Node server serves /src/ from the root and public/ modules
// import ../src/. After moving public/ to dist/demo/, rewrite *every* public
// module to reference ./src/; missing a single import blanks the entire UI.
for (const file of ['index.html', ...['main.js','api-browser.js','views.js','duels-view.js','view-utils.js']]) {
  const path=resolve(demo,file);
  let content=readFileSync(path,'utf8');
  if (file==='index.html') content=content.replaceAll('href="/','href="./').replaceAll('src="/','src="./');
  else content=content.replaceAll("'/src/", "'./src/").replaceAll('"/src/', '"./src/')
                     .replaceAll("'../src/", "'./src/").replaceAll('"../src/', '"./src/');
  writeFileSync(path,content);
}
writeFileSync(resolve(demo,'.nojekyll'),'');
writeFileSync(resolve(dist,'.nojekyll'),'');
writeFileSync(resolve(dist,'CNAME'),'aftertone.masynnay.com\n');
console.log('Built standalone portfolio homepage and real AFTERTONE app at dist/demo/');