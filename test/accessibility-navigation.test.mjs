import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const index=readFileSync(new URL('../app/public/index.html',import.meta.url),'utf8');
const main=readFileSync(new URL('../app/public/main.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../app/public/styles.css',import.meta.url),'utf8');

test('app exposes a keyboard-first skip link to its focusable main content',()=>{
  assert.match(index,/<a class="skip-to-content" href="#main-content">Skip to listening room<\/a>/);
  assert.match(index,/<main id="main-content" tabindex="-1"/);
  assert.match(index,/<nav class="primary-nav" id="main-nav" aria-label="App sections"/);
  assert.match(css,/\.skip-to-content:focus-visible/);
});
test('screen-reader navigation announces a named section without live-reading the whole app',()=>{
  assert.ok(index.includes('<main id="main-content" tabindex="-1" aria-label="Discover section"></main>'));
  assert.doesNotMatch(index, /<main[^>]*aria-live=/);
  assert.doesNotMatch(index, /<div id="modal-root"[^>]*aria-live=/);
  assert.match(index, /id="toast"[^>]*role="status" aria-live="polite"/);
  assert.ok(main.includes("main.setAttribute('aria-label', \`${viewLabel} section\`)"));
  assert.ok(main.includes("document.title = \`${viewLabel} — AFTERTONE\`"));
});
test('app navigation exposes the current view and moves keyboard focus to its content',()=>{
  assert.match(main,/button\.setAttribute\('aria-current',active\?'page':'false'\)/);
  const go=main.match(/function goTo\(nextView\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(go);
  assert.match(go,/render\(\);[\s\S]*main\.focus\(\{preventScroll:true\}\)/);
  assert.match(go,/main\.focus\(\{preventScroll:true\}\)/);
  assert.match(go,/prefers-reduced-motion: reduce/);
});
test('modal focus stays inside and returns to the original opener on close',()=>{
  assert.match(main,/let modalReturnFocus = null/);
  assert.match(main,/function trapModalTab\(event\) \{/);
  assert.match(main,/last\.focus\(\)/);
  assert.match(main,/first\.focus\(\)/);
  assert.match(main,/modalReturnFocus\?\.isConnected/);
  assert.match(main,/opener\.focus\(\{preventScroll:true\}\)/);
  assert.match(main,/if\(event\.key==='Tab'\)trapModalTab\(event\)/);
  assert.match(main,/modal\.kind === 'playlist' \? 'Import a playlist'/);
});
test('native keyboard activation takes priority over music hotkeys',()=>{
  const keys=main.match(/window\.addEventListener\('keydown', \(event\) => \{([\s\S]*?)\n\}\);/)?.[1];
  assert.ok(keys);
  assert.match(keys,/if\(interactive\)return/);
  assert.match(keys,/button,a\[href\],input,textarea,select/);
  assert.ok(keys.indexOf('if(interactive)return') < keys.indexOf("event.code === 'Space'"),
    'native keyboard guard should run before media shortcuts');
  assert.match(keys,/event\.key==='Escape'/);
});
test('focus visibility and reduced-motion rules cover app interactions',()=>{
  assert.match(css,/button:focus-visible,a:focus-visible,input:focus-visible/);
  assert.match(css,/\.passport-go:focus-visible/);
  assert.match(css,/@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css,/animation-duration:0\.01ms!important/);
});

test('phone music controls expose touch-friendly sizes without hiding six navigation tabs',()=>{
  assert.match(css,/@media\(max-width:650px\)\s*\{[\s\S]*?\.topbar-actions \.icon-button \{width:44px;height:44px;min-width:44px;\}/);
  assert.match(css,/#mobile-refine-toggle \{min-height:44px;\}/);
  assert.match(css,/\.primary-nav \.nav-link \{min-height:44px;\}/);
  assert.match(css,/@media\(max-width:360px\)\s*\{\s*\.topbar-crumb \{display:none;\}/);
});

test('scripted scroll targets obey the user reduced-motion preference',()=>{
  assert.match(main,/function motionSafeScroll\(\) \{\s*return matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches \? 'auto' : 'smooth';/);
  assert.equal((main.match(/scrollIntoView\(\{behavior:motionSafeScroll\(\)/g)||[]).length,3,
    'Search, listening passport and Duels must each use the motion-aware helper');
  assert.doesNotMatch(main,/scrollIntoView\(\{behavior:'smooth'/,
    'Do not force smooth scrolling when the OS requests reduced motion');
});
