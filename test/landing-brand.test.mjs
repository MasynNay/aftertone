import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {test} from 'node:test';
import assert from 'node:assert/strict';

const root=resolve(import.meta.dirname,'..');
const site=readFileSync(resolve(root,'site/index.html'),'utf8');
const css=readFileSync(resolve(root,'site/styles.css'),'utf8');
const logo=readFileSync(resolve(root,'site/assets/mark.svg'),'utf8');
const app=readFileSync(resolve(root,'app/public/main.js'),'utf8');

test('AFTERTONE product reflects the original icon and a distinctive radio receiver',()=>{
  assert.match(logo,/fill="#d6fb77"/);
  assert.match(logo,/stroke="#0d1a1e"/);
  assert.match(css,/--lime:#d6fb77/);
  assert.match(css,/--ink:#0d1a1e/);
  assert.match(site,/class="receiver"/);
  assert.match(site,/class="station-rail"/);
  assert.match(site,/class="tuner"/);
  assert.doesNotMatch(site,/portfolio/i);
  assert.doesNotMatch(site,/behind the build/i);
});

test('this is a free open source app, not an engineering case study',()=>{
  assert.match(site,/FREE TO USE/);
  assert.match(site,/NO SIGN-UP REQUIRED/);
  assert.match(site,/OPEN SOURCE/);
  assert.match(site,/MIT License/);
  assert.match(site,/github\.com\/MasynNay\/aftertone/);
  assert.match(site,/id="explore-experience" href="\.\/demo\/"/);
});

test('all three discovery modes open the correct app paths',()=>{
  const paths=['familiar','balanced','explore'];
  assert.equal((site.match(/class="station" href="\.\/demo\/\?path=/g)||[]).length,3);
  for(const path of paths) assert.match(site,new RegExp('href="\\./demo/\\?path='+path+'"'));
  assert.match(app,/URLSearchParams\(window\.location\.search\)\.get\('path'\)/);
  assert.match(app,/\['familiar', 'balanced', 'explore'\]\.includes\(landingPath\)/);
});

test('Music Duels uses its own deep link and does not show discovery onboarding',()=>{
  assert.match(site,/href="\.\/demo\/\?view=duels"/);
  assert.match(app,/landingView === 'duels'/);
  assert.match(app,/!shown && view === 'discover'/);
});

test('mobile layouts and keyboard access are preserved',()=>{
  assert.match(site,/class="skip" href="#main"/);
  assert.match(css,/@media\(max-width:480px\)/);
  assert.match(css,/@media\(max-width:360px\)/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});