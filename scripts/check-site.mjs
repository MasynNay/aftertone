/** Verify portfolio build keeps the real product and its import graph in place. */
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname,extname} from 'node:path';
import {readdirSync,statSync} from 'node:fs';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..');
const read=(name)=>readFileSync(resolve(root,'dist',name),'utf8');
const intro=read('index.html');
const app=read('demo/index.html');
const main=read('demo/main.js');
const api=read('demo/api-browser.js');
assert.match(intro, /href="\.\/styles\.css"/, 'Homepage must use the published stylesheet');
assert.ok(existsSync(resolve(root,'dist/styles.css')), 'Homepage stylesheet must be published');
assert.match(intro, /id="explore-experience"[^>]*href="\.\/demo\/"/, 'The main Explore the Experience button must open /demo/');
assert.match(intro, /class="nav-launch" href="\.\/demo\/"/, 'Header launch must open /demo/');
assert.match(intro, /class="launch-section"/, 'Homepage needs a final call-to-action section');
assert.match(intro, /id="modes"/, 'Homepage must explain discovery modes');
assert.match(intro, /id="engineering"/, 'Homepage must include engineering content');
assert.match(intro, /not affiliated with or endorsed by Deezer/, 'Inline third-party media notice is required');
assert.doesNotMatch(intro, /<dialog\b|<iframe\b|id="portfolio-welcome"|splash\.js/, 'Homepage must not block visitors with a modal or embed the application');
assert.doesNotMatch(intro, /<script\b/, 'The portfolio homepage should need no JavaScript');
assert.ok(!existsSync(resolve(root,'dist/splash.js')), 'Obsolete splash script must not be deployed');
assert.match(app, /id="main-nav"/, 'The launched app must be the original AFTERTONE UI');
assert.match(app, /id="player"/, 'The real AFTERTONE player must be present');
assert.match(main, /\.\/src\/taste\.mjs/, 'Original app source imports must resolve inside /demo/');
assert.match(api, /\.\/src\/static-adapter\.mjs/, 'Real Deezer browser adapter must be bundled');
assert.match(read('demo/views.js'), /\.\/src\/taste\.mjs/, 'Indirect app imports must resolve inside /demo/');
assert.match(read('demo/duels-view.js'), /\.\/src\/duels\.mjs/, 'Music Duels imports must resolve inside /demo/');
assert.ok(existsSync(resolve(root,'dist/demo/src/taste.mjs')));
assert.ok(existsSync(resolve(root,'dist/CNAME')));
assert.equal(read('CNAME').trim(),'aftertone.masynnay.com');
assert.doesNotMatch(intro, /fictional tracks|original synthesized sounds/, 'Do not substitute the original application');
console.log('Portfolio-to-app navigation, no popup or iframe, inline media notice, and real app assets verified');


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