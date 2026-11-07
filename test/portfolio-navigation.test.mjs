import {readFileSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {test} from 'node:test';
import assert from 'node:assert/strict';

const root=resolve(import.meta.dirname,'..');
const homepage=readFileSync(resolve(root,'site/index.html'),'utf8');
const build=readFileSync(resolve(root,'scripts/build-static.mjs'),'utf8');

test('AFTERTONE portfolio is a standalone homepage with no forced disclaimer',()=>{
  assert.doesNotMatch(homepage,/<dialog\b|<iframe\b|<script\b|id="portfolio-welcome"|splash\.js/i);
  assert.match(homepage,/id="main"/);
  assert.match(homepage,/id="engineering"/);
  assert.match(homepage,/id="modes"/);
});

test('Explore the Experience launches the actual app route in this tab',()=>{
  assert.match(homepage,/id="explore-experience" href="\.\/demo\/"/);
  const links=[...homepage.matchAll(/href="\.\/demo\/"/g)];
  assert.ok(links.length>=4,`Expected repeated direct app links, got ${links.length}`);
  assert.doesNotMatch(homepage,/id="explore-experience"[^>]*target="_blank"/);
});

test('Third party media notice is visible in the page, not gated by a dialog',()=>{
  assert.match(homepage,/<section class="project-note wrap"[\s\S]*not affiliated with or endorsed by Deezer[\s\S]*<\/section>/);
  assert.match(homepage,/A portfolio notice does not grant rights to use third-party media/);
});

test('Build publishes the real app separately and no longer copies a popup script',()=>{
  assert.match(build,/cpSync\(resolve\(root,'app\/public'\),demo/);
  assert.match(build,/cpSync\(resolve\(root,'app\/src'\),resolve\(demo,'src'\)/);
  assert.doesNotMatch(build,/site\/splash\.js/);
  assert.ok(!existsSync(resolve(root,'site/splash.js')));
});