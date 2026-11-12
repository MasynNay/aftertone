import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {test} from 'node:test';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..');
const homepage=readFileSync(resolve(root,'site/index.html'),'utf8');
const build=readFileSync(resolve(root,'scripts/build-static.mjs'),'utf8');

test('product homepage is standalone, accessible, and free of forced popups',()=>{
  assert.doesNotMatch(homepage,/<dialog\b|<iframe\b|<script\b|id="portfolio-welcome"|splash\.js/i);
  assert.match(homepage,/id="main"/);
  assert.match(homepage,/id="open-source"/);
  assert.match(homepage,/id="modes"/);
  assert.match(homepage,/id="duels"/);
});

test('launch buttons and station presets open the real app',()=>{
  assert.match(homepage,/id="explore-experience" href="\.\/demo\/"/);
  assert.ok((homepage.match(/href="\.\/demo\/"/g)||[]).length>=3);
  for(const path of ['familiar','balanced','explore']) assert.match(homepage,new RegExp('href="\\./demo/\\?path='+path+'"'));
  assert.match(homepage,/href="\.\/demo\/\?view=duels"/);
  assert.doesNotMatch(homepage,/id="explore-experience"[^>]*target="_blank"/);
});

test('third party music disclosure is visible and rights are not misrepresented',()=>{
  assert.match(homepage,/<section class="project-note"[\s\S]*not affiliated with or endorsed by Deezer[\s\S]*<\/section>/);
  assert.match(homepage,/The app's MIT License does not grant rights to third-party recordings or artwork/);
});

test('build publishes real app modules and never forces a fake landing experience',()=>{
  assert.match(build,/cpSync\(resolve\(root,'app\/public'\),demo/);
  assert.match(build,/cpSync\(resolve\(root,'app\/src'\),resolve\(demo,'src'\)/);
  assert.doesNotMatch(build,/site\/splash\.js/);
  assert.ok(!existsSync(resolve(root,'site/splash.js')));
});