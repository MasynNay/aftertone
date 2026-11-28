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
test('theme tiles preserve modal focus rather than jumping to an inert header toggle',()=>{
  const handler=main.slice(
    main.indexOf("const theme = event.target.closest('[data-set-theme]');"),
    main.indexOf("if (!event.target.closest('#theme-picker'))")
  );
  assert.match(handler,/if \(modal\?\.kind === 'themes'\) \{[\s\S]*?renderModal\(\);\s*\} else \{[\s\S]*?setThemeMenuOpen\(false, true\);/);
  const renderModal=main.slice(main.indexOf('function renderModal()'),main.indexOf('function trapModalTab'));
  assert.match(renderModal,/const previousTheme=modalRoot\.contains\(document\.activeElement\)/);
  assert.match(renderModal,/\(restoreTheme \|\| modalRoot\.querySelector/);
  assert.match(renderModal,/\.focus\(\)/);
});

test('only same-song listening controls regain focus through card redraws',()=>{
  const views=readFileSync(new URL('../app/public/views.js',import.meta.url),'utf8');
  assert.doesNotMatch(views,/id="listening-card" data-track-id=/,
    'Blind challenges must not expose recording IDs in markup');
  const render=main.slice(main.indexOf('function render()'),main.indexOf('function renderModal()'));
  assert.match(render,/Boolean\(previousCard\) && renderedListeningTrackId===String\(current\.id\)/);
  assert.match(render,/renderedListeningTrackId=view==='discover' && \$\('#listening-card'\)/);
  for(const id of ['stage-play','preview-volume','lyrics-offset','lyrics-toggle'])
    assert.ok(render.includes(id),'No focus tracking for '+id);
  assert.match(render,/!replacement\.closest\('\[hidden\], \[inert\]'\)/);
  assert.match(render,/replacement\.getClientRects\(\)\.length/);
  assert.match(render,/replacement\.focus\(\{preventScroll:true\}\)/);
  const go=main.slice(main.indexOf('function goTo(nextView)'),main.indexOf('function render()'));
  assert.match(go,/view = nextView;[\s\S]*?render\(\);[\s\S]*?main\.focus\(\{preventScroll:true\}\)/);
});

test('discovery paths keep their focused option instead of jumping to Play',()=>{
  const render=main.slice(main.indexOf('function render()'),main.indexOf('function renderModal()'));
  assert.match(render,/focusedOldControl\?\.matches\?\.\('\.discovery-paths \.path-option\[data-path\]'\)/);
  assert.match(render,/\['familiar','balanced','explore'\]\.includes\(focusedOldControl\.dataset\.path\)/);
  assert.match(render,/replacement\.focus\(\{preventScroll:true\}\)/);
  const change=main.slice(main.indexOf('function changeDiscoveryPath('),main.indexOf('function motionSafeScroll()'));
  assert.doesNotMatch(change,/focusDiscoveryRecovery\(\)|main\.focus\(\{preventScroll:true\}\)/);
  assert.match(change,/void loadMore\(state\.genre,false,true\)/);
  assert.match(change,/stopContinuous\(\)/);
});

test('native keyboard activation takes priority over music hotkeys',()=>{
  const keys=main.match(/window\.addEventListener\('keydown', \(event\) => \{([\s\S]*?)\n\}\);/)?.[1];
  assert.ok(keys);
  assert.match(keys,/if\(interactive\)return/);
  assert.match(keys,/button,a\[href\],input,textarea,select/);
  assert.ok(keys.indexOf('if(interactive)return') < keys.indexOf("event.code === 'Space'"),
    'native keyboard guard should run before media shortcuts');
  assert.match(keys,/event\.key==='Escape'/);
  for (const guard of ['event.defaultPrevented','event.isComposing','event.repeat',
      'event.ctrlKey','event.metaKey','event.altKey','event.shiftKey']) {
    assert.ok(keys.includes(guard),`Missing keyboard safety guard: ${guard}`);
  }
  assert.ok(keys.indexOf('event.ctrlKey') < keys.indexOf("if(interactive)return"),
    'modified shortcuts must exit before both Discover and Duels handlers');
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

test('Keep, Pass and Undo restore focus after replacing the decision controls',()=>{
  const helper=main.match(/function restoreDecisionFocus\(action\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(helper,'Shared decision focus helper missing');
  assert.match(helper,/\(button && !button\.disabled \? button : main\)\.focus\(\{preventScroll:true\}\)/);
  const choice=main.match(/function acceptChoice\(action\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(choice);
  assert.match(choice,/const origin = card\?\.querySelector/);
  assert.match(choice,/document\.activeElement === origin/);
  assert.match(choice,/recordDecision\(selected,action\)/);
  assert.match(choice,/if \(restoreFocus\) restoreDecisionFocus\(action\)/);
  assert.match(choice,/if\(pendingChoice!==choice\)return/);
  const undo=main.slice(main.indexOf("case 'undo':"),main.indexOf("case 'remove-favorite':"));
  assert.match(undo,/if \(returnFocus\) restoreDecisionFocus\('undo'\)/);
});

test('backup restoration never strands focus on a hidden picker or silently loses feedback',()=>{
  assert.match(main,/function announceProgressBackup\(message\) \{/);
  assert.match(main,/let progressRestoreBusy=false/);
  assert.match(main,/if \(progressRestoreBusy\) return/);
  assert.match(main,/if \(restoreButton\) restoreButton\.disabled=true/);
  assert.match(main,/Restore canceled\. Your existing progress was not changed/);
  assert.match(main,/if \(view==='collection'\) action\.focus\(\{preventScroll:true\}\)/);
});


test('mobile Filters panel has a named toggle and a visible touch-friendly close action',()=>{
  assert.match(index,/id="mobile-refine-toggle" aria-expanded="false" aria-controls="sidebar-preferences"/);
  const views=readFileSync(new URL('../app/public/views.js',import.meta.url),'utf8');
  assert.match(views,/data-action="close-mobile-filters" aria-label="Close discovery filters"/);
  assert.match(css,/\.sidebar-filter-head-actions \.mobile-filter-close \{display:none;\}/);
  assert.match(css,/\.sidebar-filter-head-actions \.mobile-filter-close \{\s*display:inline-flex;/);
  assert.match(css,/min-height:44px;height:44px/);
});

test('mobile Filters dismissal, search submission, and navigation always synchronize aria-expanded',()=>{
  const helper=main.match(/function setMobileFiltersOpen\(open, focusTarget=''\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(helper,'Mobile drawer open/close helper must be centralized');
  assert.match(helper,/matchMedia\('\(max-width: 900px\)'\)\.matches/);
  assert.match(helper,/classList\.toggle\('mobile-filters-open',expanded\)/);
  assert.match(helper,/setAttribute\('aria-expanded',String\(expanded\)\)/);
  assert.match(helper,/close-mobile-filters/);
  assert.match(helper,/focus\(\{preventScroll:true\}\)/);
  assert.match(main,/case 'close-mobile-filters': return setMobileFiltersOpen\(false,'toggle'\)/);
  assert.match(main,/setMobileFiltersOpen\(!opened,'close'\)/);
  const go=main.slice(main.indexOf('function goTo(nextView)'),main.indexOf('function render()'));
  assert.match(go,/setMobileFiltersOpen\(false\)/);
  const submit=main.slice(main.indexOf("document.addEventListener('submit'"),main.indexOf("document.addEventListener('input'"));
  assert.match(submit,/setMobileFiltersOpen\(false\)/);
  assert.match(submit,/main\.focus\(\{preventScroll:true\}\)/);
  const keys=main.slice(main.indexOf("window.addEventListener('keydown'"),main.indexOf('// Gestures follow the pointer'));
  assert.match(keys,/if \(document\.body\.classList\.contains\('mobile-filters-open'\)\) \{/);
  assert.match(keys,/if \(event\.key==='Escape'\)/);
  assert.match(keys,/setMobileFiltersOpen\(false,'toggle'\)/);
  assert.match(keys,/event\.key==='Tab'\) trapMobileFiltersTab\(event\)/);
});

test('mobile Filters temporarily behave as a focused dialog and unwind on desktop resize',()=>{
  const helper=main.slice(main.indexOf("function setMobileFiltersOpen("),
    main.indexOf("function goTo(nextView)"));
  assert.match(helper,/side\.setAttribute\('role','dialog'\)/);
  assert.match(helper,/side\.setAttribute\('aria-modal','true'\)/);
  assert.match(helper,/side\.removeAttribute\('aria-modal'\)/);
  assert.match(helper,/function trapMobileFiltersTab\(event\)/);
  assert.match(helper,/side\.querySelectorAll\(/);
  assert.match(helper,/!element\.closest\('\[hidden\], \[inert\]'\)/);
  assert.match(helper,/last\.focus\(\{preventScroll:true\}\)/);
  assert.match(helper,/first\.focus\(\{preventScroll:true\}\)/);
  assert.match(helper,/matchMedia\('\(min-width: 901px\)'\)/);
  const render=main.slice(main.indexOf('function render()'),main.indexOf('function renderModal()'));
  assert.match(render,/focusedMobileFilterAction/);
  assert.match(render,/close-mobile-filters/);
  assert.match(render,/toggle-side-filters/);
  assert.match(render,/side\.querySelector\('\[data-action="'\+focusedMobileFilterAction/);
  const modal=main.slice(main.indexOf('function openModal('),main.indexOf('function recordDecision('));
  assert.match(modal,/wasMobileDrawerAction/);
  assert.match(modal,/setMobileFiltersOpen\(false\)/);
});

test('filter redraws retain focus on active select boxes',()=>{
  const render=main.slice(main.indexOf('function render()'),main.indexOf('function renderModal()'));
  assert.match(render,/focusedFilterId/);
  for (const id of ['genre-select','language-select','discovery-mix-select'])
    assert.match(render,new RegExp(id));
  assert.match(render,/\$\('#'\+focusedFilterId\)\?\.focus\(\{preventScroll:true\}\)/);
});


test('swipe gestures record decisions only for a primary pointer on the original card',()=>{
  const swipe=main.slice(main.indexOf('function clearSwipeGesture('),main.indexOf('async function init()'));
  assert.match(swipe,/pointerStart=null/);
  assert.match(swipe,/card\.releasePointerCapture\(gesture\.pointer\)/);
  assert.match(swipe,/event\.isPrimary===false \|\| event\.button!==0/);
  assert.match(swipe,/card\.setPointerCapture\?\.\(event\.pointerId\)/);
  assert.match(swipe,/trackId:current\.id/);
  assert.match(swipe,/!gesture\.card\.isConnected \|\| current\?\.id!==gesture\.trackId/);
  assert.match(swipe,/clearSwipeGesture\(event\.pointerId\)/);
  assert.match(swipe,/Math\.abs\(dx\)>75 && Math\.abs\(dx\)>Math\.abs\(dy\)\*1\.6/);
  assert.match(swipe,/main\.addEventListener\('pointercancel'/);
  assert.match(swipe,/main\.addEventListener\('lostpointercapture'/);
  assert.match(swipe,/window\.addEventListener\('blur'/);
  assert.match(swipe,/document\.addEventListener\('pointerdown', \(event\) => \{/);
  assert.match(swipe,/event\.pointerId!==pointerStart\.pointer/);
  assert.match(swipe,/event\.pointerType==='touch'\) clearSwipeGesture\(\)/);
  assert.match(swipe,/\}, true\);/,'Second contacts anywhere on the page must cancel the swipe');
  const render=main.slice(main.indexOf('function render()'),main.indexOf('function renderModal()'));
  assert.match(render,/clearSwipeGesture\(\)/,
    'Rebuilding the active card must invalidate a pending drag');
  assert.match(css,/touch-action: pan-y/,
    'Vertical touch scrolling must remain native');
});
