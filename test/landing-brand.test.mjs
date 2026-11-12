import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {test} from 'node:test';
import assert from 'node:assert/strict';

const root=resolve(import.meta.dirname,'..');
const site=readFileSync(resolve(root,'site/index.html'),'utf8');
const css=readFileSync(resolve(root,'site/styles.css'),'utf8');
const logo=readFileSync(resolve(root,'site/assets/mark.svg'),'utf8');

test('the brand uses the actual AFTERTONE logo palette as accents, not a lime billboard',()=>{
  assert.match(logo, /fill="#d6fb77"/);
  assert.match(logo, /stroke="#0d1a1e"/);
  assert.match(css, /--lime:\s*#d6fb77/);
  assert.match(css, /--ink:\s*#0d1a1e/);
  assert.match(css, /--paper:\s*#f7f8f4/);
  assert.match(site, /content="#f7f8f4"/);
});

test('landing directly launches the real app and has usable mode choices',()=>{
  assert.match(site, /id="explore-experience" href="\.\/demo\/"/);
  assert.match(site, /class="path-selector"/);
  assert.match(site, /class="selector-options"/);
  assert.equal((site.match(/class="selector-option"/g)||[]).length,3);
  assert.doesNotMatch(site, /src="\.\/assets\/app-(?:discover|collection|music-duels)\.webp"/);
  assert.match(site, /class="project-note wrap"/);
  assert.match(site, /not affiliated with or endorsed by Deezer/);
  assert.ok((site.match(/href="\.\/demo\/"/g)||[]).length >= 5);
});

test('responsive layouts and keyboard navigation are explicitly supported',()=>{
  assert.match(css, /@media \(max-width: 560px\)/);
  assert.match(css, /@media \(max-width: 360px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(site, /class="skip" href="#main"/);
  assert.match(site, /aria-labelledby="hero-heading"/);
});