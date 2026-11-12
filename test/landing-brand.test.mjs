import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {test} from 'node:test';
import assert from 'node:assert/strict';

const root=resolve(import.meta.dirname,'..');
const site=readFileSync(resolve(root,'site/index.html'),'utf8');
const css=readFileSync(resolve(root,'site/styles.css'),'utf8');
const logo=readFileSync(resolve(root,'site/assets/mark.svg'),'utf8');

test('portfolio palette matches the existing AFTERTONE logo',()=>{
  assert.match(logo, /fill="#d6fb77"/);
  assert.match(logo, /stroke="#0d1a1e"/);
  assert.match(css, /--lime:#d6fb77/);
  assert.match(css, /--ink:#0d1a1e/);
  assert.match(site, /content="#d6fb77"/);
});

test('brand-led landing has direct app links and no fabricated interface preview',()=>{
  assert.match(site, /id="explore-experience" href="\.\/demo\/"/);
  assert.match(site, /class="duel-visual"/);
  assert.match(site, /class="art-symbol"/);
  assert.doesNotMatch(site, /app-(?:discover|collection|music-duels)\.webp/);
  assert.match(site, /class="project-note wrap"/);
  assert.match(site, /not affiliated with or endorsed by Deezer/);
  assert.ok((site.match(/href="\.\/demo\/"/g)||[]).length >= 4);
});

test('small screens and accessibility are first-class',()=>{
  assert.match(css, /@media\(max-width:540px\)/);
  assert.match(css, /@media\(max-width:360px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(site, /class="skip" href="#main"/);
  assert.match(site, /aria-labelledby="hero-heading"/);
});
