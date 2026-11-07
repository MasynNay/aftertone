/** Verify portfolio build keeps the real product and its import graph in place. */
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname,extname} from 'node:path';
import {readdirSync,statSync} from 'node:fs';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..');
const read=(name)=>readFileSync(resolve(root,'dist',name),'utf8');
const intro=read('index.html');
const splash=read('splash.js');
const app=read('demo/index.html');
const main=read('demo/main.js');
const api=read('demo/api-browser.js');
assert.match(intro,/id="portfolio-welcome"/, 'First-visit disclaimer must exist');
assert.match(intro,/src="\.\/demo\/"/, 'Landing page must embed actual app');
assert.match(intro,/href="\.\/styles\.css"/, 'The portfolio must reference its published stylesheet');
assert.ok(existsSync(resolve(root,'dist/styles.css')), 'Portfolio CSS must be bundled');
assert.match(intro,/id="launch-from-welcome"/, 'Full-screen welcome must offer direct entry to original app');
assert.match(intro,/href="\.\/demo\/"/, 'Direct fullscreen launch is required');
assert.match(intro,/not a commercial music service/, 'Third-party provider disclaimer is required');
assert.match(splash,/sessionStorage/, 'Splash dismissal must not change app localStorage');
assert.match(read('styles.css'),/\.portfolio-welcome\[open\][\s\S]*?width:100vw/, 'Welcome screen must fill the viewport');
assert.match(app,/id="main-nav"/, 'Live app must be the real original navigation');
assert.match(app,/id="player"/, 'Real player is required');
assert.match(main,/\.\/src\/taste\.mjs/, 'Source imports must be rewritten for /demo/');
assert.match(api,/\.\/src\/static-adapter\.mjs/, 'Browser adapter import must resolve');
assert.match(read('demo/views.js'),/\.\/src\/taste\.mjs/, 'Indirect view imports must be rewritten when publishing');
assert.match(read('demo/duels-view.js'),/\.\/src\/duels\.mjs/, 'Tournament imports must be rewritten when publishing');
assert.ok(existsSync(resolve(root,'dist/demo/src/taste.mjs')));
assert.ok(existsSync(resolve(root,'dist/CNAME')));
assert.equal(read('CNAME').trim(),'aftertone.masynnay.com');
assert.doesNotMatch(intro,/fictional tracks|original synthesized sounds/, 'Do not reintroduce fake demo');
console.log('Portfolio splash, real embedded app, browser adapter, and custom-domain static output verified');


// This is intentionally an actual asset graph check, not a string-presence
// smoke test. Missing ES modules can leave a perfectly styled but empty app.
const published=resolve(root,'dist');
function filesUnder(folder){
  return readdirSync(folder).flatMap(name=>{
    const file=resolve(folder,name);
    return statSync(file).isDirectory()?filesUnder(file):[file];
  });
}
const modules=filesUnder(resolve(published,'demo')).filter(f=>['.js','.mjs'].includes(extname(f)));
let importsChecked=0;
for(const source of modules){
  const code=readFileSync(source,'utf8');
  const imports=[...code.matchAll(/\b(?:from\s*|import\s*\(\s*)['"]([^'"]+)['"]/g)].map(x=>x[1]);
  for(const specifier of imports){
    if(!specifier.startsWith('.')&&!specifier.startsWith('/'))continue;
    const destination=specifier.startsWith('/')?resolve(published,'.'+specifier):resolve(dirname(source),specifier);
    assert.ok(destination.startsWith(published+'/'), `Module escaped public site: ${source} -> ${specifier}`);
    assert.ok(existsSync(destination), `Missing published import: ${source} -> ${specifier}`);
    importsChecked++;
  }
}
for(const page of [resolve(published,'index.html'),resolve(published,'demo/index.html')]){
  const document=readFileSync(page,'utf8');
  for(const match of document.matchAll(/<(?:script|link|iframe|img)\b[^>]*?\b(?:href|src)=["]([^"]+)["]/g)){
    const url=match[1];
    if(!url.startsWith('./')&&!url.startsWith('../'))continue;
    let file=resolve(dirname(page),url);
    if(existsSync(file)&&statSync(file).isDirectory())file=resolve(file,'index.html');
    assert.ok(existsSync(file), `Missing HTML asset: ${page} -> ${url}`);
  }
}
console.log(`Published ESM import graph valid: ${modules.length} modules, ${importsChecked} local imports`);