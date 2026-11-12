import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {test} from 'node:test';
import assert from 'node:assert/strict';

const root=resolve(import.meta.dirname,'..');
const page=readFileSync(resolve(root,'site/index.html'),'utf8');
const css=readFileSync(resolve(root,'site/styles.css'),'utf8');

test('Portfolio design uses authentic bundled app images',()=>{
  for(const file of ['app-discover.webp','app-collection.webp','app-music-duels.webp']){
    assert.match(page,new RegExp('src="\\./assets/'+file.replace('.','\\.')+'"'));
    assert.ok(existsSync(resolve(root,'site/assets',file)),file+' must exist for the static Pages build');
  }
});
test('Light music-led landing keeps product and accessibility links',()=>{
  assert.match(page, /id="explore-experience" href="\.\/demo\/"/);
  assert.match(page, /class="nav-launch" href="\.\/demo\/"/);
  assert.match(page, /class="project-note wrap"/);
  assert.match(page, /class="skip" href="#main"/);
  assert.match(css, /color-scheme:light/);
  assert.match(css, /@media\(max-width:620px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});
