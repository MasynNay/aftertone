/** Copy only the static, safe-to-publish assets into dist/. */
import {rmSync,mkdirSync,copyFileSync,cpSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');const dist=resolve(root,'dist');
rmSync(dist,{recursive:true,force:true});mkdirSync(dist,{recursive:true});
copyFileSync(resolve(root,'index.html'),resolve(dist,'index.html'));
cpSync(resolve(root,'assets'),resolve(dist,'assets'),{recursive:true});
mkdirSync(resolve(dist,'src'));
copyFileSync(resolve(root,'src/demo-engine.mjs'),resolve(dist,'src/demo-engine.mjs'));
writeFileSync(resolve(dist,'.nojekyll'),'');
console.log('Built static site at dist/ (no local app, APIs, credentials, or media files)');
