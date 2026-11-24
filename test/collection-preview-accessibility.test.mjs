/** Playback state must remain accessible without O(collection-size) DOM work per tick. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInitialState} from '../app/src/taste.mjs';
import {createViews} from '../app/public/views.js';

const source=readFileSync(new URL('../app/public/main.js',import.meta.url),'utf8');
const tracks=Array.from({length:3},(_,i)=>({
  id:`deezer:${9100001+i}`,source:'deezer',
  title:`Fixture Melody ${String(i+1).padStart(2,'0')}`,
  artist:`Fixture Artist ${i+1}`,genre:'pop',artwork:null,
}));
test('Collection buttons start with a song-specific accessible name',()=>{
  const state={...createInitialState(),favorites:tracks.map(t=>t.id),savedTracks:tracks};
  const markup=createViews({state,catalog:tracks,current:null,allGenres:[],
    collectionQuery:'',collectionSort:'recent'}).renderCollection();
  assert.match(markup,/data-preview="deezer:9100001"/);
  assert.match(markup,/aria-label="Listen to Fixture Melody 01"/);
});

test('live Collection controls announce Pause and Cancel, not a stale Listen label',()=>{
  const begin=source.indexOf('function updatePlaybackView()');
  const end=source.indexOf("audio.addEventListener('timeupdate'");
  assert.ok(begin>0&&end>begin);
  const code=source.slice(begin,end);
  assert.match(code,/const trackTitle=side \? null/);
  assert.match(code,/Pause \$\{trackTitle\} preview/);
  assert.match(code,/Cancel loading \$\{trackTitle\} preview/);
  assert.match(code,/Listen to \$\{trackTitle\}/);
  assert.match(code,/if\(button.getAttribute\('aria-label'\)!==accessible\)/);
  assert.match(code,/button.setAttribute\('aria-label',accessible\)/);
  assert.match(code,/setTextIfChanged\(button,text\)/);
});

test('timeupdate retains the active button state without traversing all saved music',()=>{
  const body=source.slice(source.indexOf('function updatePlaybackView()'),
    source.indexOf("audio.addEventListener('timeupdate'"));
  assert.match(body,/const buttonKey=\[view,activeAudioId,audio.paused,isLoadingAudio,/);
  assert.match(body,/if\(previewButtonStateKey!==buttonKey\) \{[\s\S]*?document.querySelectorAll\('\[data-preview\], \[data-duel-play\]'\)/);
  assert.match(source,/previewButtonStateKey=null;\s*updatePlaybackView\(\)/,
    'Each full Collection rebuild must invalidate the cached controls');
});
