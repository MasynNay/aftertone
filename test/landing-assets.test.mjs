import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {test} from 'node:test';
import assert from 'node:assert/strict';

const root=resolve(import.meta.dirname,'..');
const page=readFileSync(resolve(root,'site/index.html'),'utf8');
const css=readFileSync(resolve(root,'site/styles.css'),'utf8');

test('portfolio keeps the authentic logo and app screenshots available',()=>{
  assert.match(page, /src="\.\/assets\/mark\.svg"/);
  assert.ok(existsSync(resolve(root,'site/assets/mark.svg')));
  for(const name of ['app-discover.webp','app-collection.webp','app-music-duels.webp']){
    assert.ok(existsSync(resolve(root,'site/assets',name)),name+' remains available');
  }
});
test('launch paths are visible and maintainable',()=>{
  assert.match(page, /id="explore-experience" href="\.\/demo\/"/);
  assert.match(page, /class="nav-launch" href="\.\/demo\/"/);
  assert.match(page, /class="project-note wrap"/);
  assert.match(page, /class="skip" href="#main"/);
  assert.match(css, /color-scheme: light/);
  assert.match(css, /@media \(max-width: 560px\)/);
  assert.match(css, /@media \(max-width: 360px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});