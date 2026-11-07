import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeVolume, updateVolumeSetting, toggleMuteSetting, actualVolume, DEFAULT_VOLUME } from '../app/src/volume.mjs';
import { createInitialState } from '../app/src/taste.mjs';
import { sanitizeState, loadState, saveState } from '../app/src/persistence.mjs';
import { createViews } from '../app/public/views.js';
import { createTournament } from '../app/src/duels.mjs';
import { renderDuels } from '../app/public/duels-view.js';

const tracks = Array.from({length:4},(_,i)=>({id:`deezer:${i+1}`,source:'deezer',title:`Song ${i+1}`,artist:`Artist ${i+1}`,genre:'pop',mood:'Fresh',artwork:null}));
function discovery(state) {
  return createViews({ state, catalog:tracks, current:tracks[0], allGenres:['all','pop'],
    challengeIds:[],challengeResponses:[],feed:{available:4},availableSources:['deezer'],collectionQuery:'',collectionSort:'recent' }).renderDiscovery();
}

test('safe 35% volume default and old-state upgrade without wiping saved history',()=>{
  const defaults=createInitialState();
  assert.equal(DEFAULT_VOLUME,35);
  assert.equal(defaults.volume,35);
  const old={...defaults,favorites:['deezer:1'],history:[{id:'deezer:1',action:'like'}]};
  delete old.volume;
  const restored=sanitizeState(old);
  assert.equal(restored.volume,35);
  assert.deepEqual(restored.favorites,old.favorites);
  assert.deepEqual(restored.history.map(x=>x.id),['deezer:1']);
});

test('volume sanitization clamps and never admits NaN or infinity',()=>{
  for(const [input,want] of [[0,0],[-2,0],[115,100],[22.5,23],['70',70],['',35],[null,35],['NaN',35],[Number.POSITIVE_INFINITY,35]]){
    assert.equal(normalizeVolume(input),want);
  }
  assert.equal(sanitizeState({...createInitialState(),volume:-90}).volume,0);
  assert.equal(sanitizeState({...createInitialState(),volume:1000}).volume,100);
  assert.equal(sanitizeState({...createInitialState(),volume:'not a number'}).volume,35);
});

test('volume slider updates a saved state, starts at zero muted, and unmutes for nonzero values',()=>{
  let state=updateVolumeSetting(createInitialState(),0);
  assert.equal(actualVolume(state),0);
  assert.equal(state.sound,false);
  state=updateVolumeSetting(state,62);
  assert.equal(actualVolume(state),0.62);
  assert.equal(state.sound,true);
  state=toggleMuteSetting(state);
  assert.equal(actualVolume(state),0);
  assert.equal(state.volume,62,'mute must keep a safe remembered level');
  state=toggleMuteSetting(state);
  assert.equal(actualVolume(state),0.62);
  state=updateVolumeSetting(state,0);
  state=toggleMuteSetting(state);
  assert.equal(actualVolume(state),0.35,'unmute after a zero slider revives at safe default');
});

test('stored volume persists through refresh and recovers with other preferences',()=>{
  const values=new Map();
  const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
  const state={...createInitialState(),volume:14,theme:'night',blind:true,favorites:['deezer:1']};
  assert.equal(saveState(storage,state),true);
  const loaded=loadState(storage);
  assert.equal(loaded.volume,14);
  assert.equal(loaded.blind,true);
  assert.deepEqual(loaded.favorites,['deezer:1']);
});

test('music listening card contains a labeled volume slider with current percentage',()=>{
  const page=discovery({...createInitialState(),volume:27});
  assert.match(page,/id="preview-volume"/);
  assert.match(page,/data-volume-slider/);
  assert.match(page,/aria-label="Adjust music preview volume"/);
  assert.match(page,/value="27"/);
  assert.match(page,/>27%<\/output>/);
  assert.match(discovery({...createInitialState(),sound:false}),/>Muted<\/output>/);
});

test('Music Duels share the same saved volume and do not depend on the discovery card',()=>{
  const event=createTournament({id:'duel_volume123',name:'Volume test',tracks});
  const page=renderDuels({tournaments:[event],selectedId:event.id,catalog:tracks,volume:54,sound:true});
  assert.match(page,/id="duel-volume"/);
  assert.match(page,/value="54"/);
  assert.match(page,/>54%<\/output>/);
  assert.match(page,/data-duel-play="deezer:1"/);
});

test('the single browser player is adjusted without remounting and slider gestures do not swipe',()=>{
  const code=readFileSync(new URL('../app/public/main.js',import.meta.url),'utf8');
  assert.match(code,/audio\.volume = level \/ 100/);
  assert.match(code,/audio\.muted = !state\.sound \|\| level === 0/);
  assert.match(code,/main\.addEventListener\('input'/);
  assert.match(code,/updateVolumeSetting\(state, event\.target\.value\)/);
  assert.match(code,/event\.target\.closest\('button, input, select, textarea, label, a, \[data-volume-slider\]'/);
  assert.match(code,/case 'duels': main\.innerHTML = renderDuels\(\{[^;]+volume:state\.volume/);
});
