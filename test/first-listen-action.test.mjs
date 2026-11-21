import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {firstListenAction} from '../app/src/discovery/first-listen.mjs';
import {createViews} from '../app/public/views.js';
import {createInitialState} from '../app/src/taste.mjs';

const track={id:'deezer:9000111',source:'deezer',artist:'Fixture Artist',
  title:'Fixture Melody',genre:'unknown',mood:'Fresh'};
function discovery({current=track,feed={},history=[],challengeIds=[]}={}) {
  return createViews({
    state:{...createInitialState(),history},catalog:[track],current,allGenres:['all'],
    challengeIds,challengeResponses:[],catalogWarning:'',catalogLive:true,
    collectionQuery:'',collectionSort:'recent',
    feed:{loading:false,hasMore:true,available:1,ids:new Set([track.id]),...feed}
  }).renderDiscovery();
}
test('ready first listen delegates to the actual audio player, never a new pseudo-player',()=>{
  const action=firstListenAction({hasTrack:true});
  assert.equal(action.action,'first-listen-play');
  assert.equal(action.disabled,false);
  assert.match(action.label,/Play My First Preview/);
  const ui=discovery();
  assert.match(ui,/aria-label="How to start discovering music"/);
  assert.match(ui,/data-action="first-listen-play"/);
  assert.match(ui,/id="stage-play"/);
  assert.match(ui,/Keep or Pass/);
  assert.doesNotMatch(ui,/first-listen-play" disabled/);
});
test('while loading, guide is honest and never issues a second competing request',()=>{
  const action=firstListenAction({loading:true});
  assert.equal(action.action,null);
  assert.equal(action.disabled,true);
  const ui=discovery({current:null,feed:{loading:true}});
  assert.match(ui,/Finding Your First Song/);
  assert.equal((ui.match(/data-action="load-more"/g)||[]).length,1);
  const guideControls=ui.split('<div class="first-listen-actions">')[1]?.split('</div>')[0]||'';
  assert.doesNotMatch(guideControls,/data-action="load-more"/);
});
test('outages offer an immediate manual retry instead of a disabled tutorial CTA',()=>{
  const action=firstListenAction({error:'Provider unavailable'});
  assert.equal(action.action,null);
  assert.equal(action.disabled,false);
  const ui=discovery({current:null,feed:{error:'Provider unavailable'}});
  assert.match(ui,/Use Retry Discovery below/);
  assert.equal((ui.match(/data-action="load-more"/g)||[]).length,1);
  assert.match(ui,/Retry Discovery/);
  assert.match(ui,/Music Is Temporarily Unavailable/);
});
test('an empty but healthy queue offers Find My First Song without creating decisions',()=>{
  const action=firstListenAction();
  assert.equal(action.action,null);
  assert.equal(action.disabled,false);
  assert.match(discovery({current:null,feed:{hasMore:true}}),/Ready to Find Your First Song/);
});
test('no onboarding takeover after one decision or in shared blind challenges',()=>{
  assert.doesNotMatch(discovery({history:[{id:track.id,action:'pass',artist:track.artist}]}),
    /data-action="first-listen-play"/);
  assert.doesNotMatch(discovery({challengeIds:[track.id]}),/data-action="first-listen-play"/);
});
test('controller focus is moved to persistent Play button and reuses normal playback path',()=>{
  const controller=readFileSync(new URL('../app/public/main.js',import.meta.url),'utf8');
  assert.match(controller,/case 'first-listen-play': \{/);
  assert.match(controller,/if\(view!=='discover' \|\| modal \|\| challengeIds\.length \|\| state\.history\.length \|\| !current\)return/);
  assert.match(controller,/\$\('#stage-play'\)\?\.focus\(\{preventScroll:true\}\)/);
  assert.match(controller,/return togglePlayback\(current,false\)/);
  assert.doesNotMatch(controller,/case 'first-listen-play':[\s\S]{0,500}recordDecision\(/);
});
