import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createViews} from '../app/public/views.js';
import {createInitialState} from '../app/src/taste.mjs';

const track={
  id:'deezer:9100001',source:'deezer',title:'Synthetic Melody',
  artist:'Synthetic Artist',genre:'unknown',mood:'Fresh'
};

function scene({blind=false,shared=false}={}) {
  return createViews({
    state:{...createInitialState(),blind},
    catalog:[track],current:track,allGenres:['all'],
    challengeIds:shared?[track.id]:[],challengeResponses:[],
    catalogWarning:'',catalogLive:true,
    collectionQuery:'',collectionSort:'recent',
    feed:{loading:false,primed:true,hasMore:false,available:1}
  }).renderDiscovery();
}

test('ordinary blind mode remains a pressed-state button with both states',()=>{
  const off=scene();
  const on=scene({blind:true});
  assert.match(off,/data-action="toggle-blind"[^>]*aria-label="Blind mode" aria-pressed="false"/);
  assert.match(on,/data-action="toggle-blind"[^>]*aria-label="Blind mode" aria-pressed="true"/);
  assert.match(off,/Turn blind mode on/);
  assert.match(on,/Turn blind mode off/);
  assert.doesNotMatch(off,/class="decision-button decision-blind is-on is-locked"/);
  assert.doesNotMatch(on,/class="decision-button decision-blind is-on is-locked"/);
});

test('shared challenge always presents a locked state instead of misleading toggle',()=>{
  for(const blind of [false,true]) {
    const markup=scene({blind,shared:true});
    assert.match(markup,/BLIND CHALLENGE/);
    assert.match(markup,/class="decision-button decision-blind is-on is-locked"/);
    assert.match(markup,/role="note" aria-label="Blind mode is locked for this shared challenge"/);
    assert.match(markup,/Shared challenges always keep song identities hidden/);
    assert.doesNotMatch(markup,/data-action="toggle-blind"/);
    assert.doesNotMatch(markup,/aria-pressed="(true|false)" class="decision-button decision-blind/);
  }
});

test('blind toggle action and keyboard shortcut do not change a shared challenge preference',()=>{
  const main=readFileSync(new URL('../app/public/main.js',import.meta.url),'utf8');
  const action=main.match(/case 'toggle-blind': \{([\s\S]*?)\n    \}/)?.[1];
  assert.ok(action,'Blind action is guarded');
  assert.match(action,/if\(view!=='discover' \|\| !current \|\| challengeIds\.length\) return/);
  assert.match(action,/state\.blind = !state\.blind/);
  const shortcut=main.slice(main.indexOf("if (event.key.toLowerCase() === 'b')"),
    main.indexOf("if (event.key === 'ArrowLeft')"));
  assert.match(shortcut,/if\(challengeIds\.length \|\| !current\) return/);
  assert.match(shortcut,/state\.blind = !state\.blind/);
});

test('normal toggle and same-track rerenders restore keyboard focus to rebuilt control',()=>{
  const main=readFileSync(new URL('../app/public/main.js',import.meta.url),'utf8');
  assert.match(main,/focusedOldControl\.matches\?\.\('\[data-action="lyrics-toggle"\],\[data-action="toggle-blind"\]'\)/);
  assert.match(main,/focusedOldControl\.matches\?\.\('\[data-action="toggle-blind"\]'\)\s*\?\s*'blind-toggle'/);
  assert.match(main,/focusedListeningControl==='blind-toggle'\s*\?\s*\$\('#listening-card \[data-action="toggle-blind"\]'\)/);
  assert.match(main,/render\(\); \/\/ Same-track focus continuity handles the toggle/);
  assert.match(main,/renderedListeningTrackId===String\(current\.id\)/);
});
