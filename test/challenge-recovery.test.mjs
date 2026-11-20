import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createViews} from '../app/public/views.js';
import {createInitialState} from '../app/src/taste.mjs';

const track={id:'deezer:9100002',source:'deezer',title:'Original Fixture',artist:'Fixture Act',genre:'unknown'};
function render({ids=[track.id],current=null,responses=[],recovery=null,availableCatalog=[track]}={}) {
  return createViews({
    state:createInitialState(), catalog:availableCatalog,current,
    allGenres:['all'], challengeIds:ids,challengeResponses:responses,
    challengeRecovery:recovery,catalogWarning:'',catalogLive:true,
    collectionQuery:'',collectionSort:'recent',
  }).renderDiscovery();
}

test('all missing shared tracks render a persistent recovery screen, never ordinary discovery',()=>{
  const markup=render({ids:['deezer:9100001'],availableCatalog:[],recovery:{
    waiting:true,loading:false,requested:1,available:0,missing:['deezer:9100001'],
    canRetry:true,failed:true
  }});
  assert.match(markup,/Your Shared Challenge/);
  assert.match(markup,/Shared Challenge Unavailable/);
  assert.match(markup,/None of the 1 shared song is available right now/);
  assert.match(markup,/data-action="retry-shared-challenge"/);
  assert.match(markup,/data-action="exit-challenge"/);
  assert.match(markup,/The music provider could not complete the request/);
  assert.doesNotMatch(markup,/data-action="load-more"/);
  assert.doesNotMatch(markup,/data-action="continue-shared-challenge"/);
  assert.doesNotMatch(markup,/id="listening-card"/);
  assert.match(markup,/class="discovery-paths"[^>]*hidden/);
});
test('missing tracks cannot be voted on while retry is pending',()=>{
  const markup=render({ids:['deezer:9100001','deezer:9100002'],recovery:{
    waiting:true,loading:true,requested:2,available:1,missing:['deezer:9100001'],
    canRetry:true,failed:false
  }});
  assert.match(markup,/Checking Shared Songs/);
  assert.match(markup,/data-action="retry-shared-challenge" disabled/);
  assert.match(markup,/data-action="continue-shared-challenge" disabled/);
  assert.doesNotMatch(markup,/data-action="pass"/);
  assert.doesNotMatch(markup,/id="listening-card"/);
});
test('partial challenge asks before shortening and always offers a valid exit',()=>{
  const markup=render({ids:['deezer:9100001','deezer:9100002'],recovery:{
    waiting:true,loading:false,requested:2,available:1,missing:['deezer:9100001'],
    canRetry:true,failed:false
  }});
  assert.match(markup,/Some Shared Songs Are Unavailable/);
  assert.match(markup,/1 of 2 shared songs available/);
  assert.match(markup,/data-action="continue-shared-challenge"/);
  assert.match(markup,/Play 1 Available Song/);
  assert.match(markup,/role="region" aria-labelledby="challenge-recovery-heading"/);
  assert.match(markup,/id="challenge-recovery-status" role="status" aria-live="polite"/);
});
test('legacy provider shared links never suggest Deezer retry when there is no resolvable ID',()=>{
  const markup=render({ids:['commons:old-one'],availableCatalog:[],recovery:{
    waiting:true,loading:false,requested:1,available:0,missing:['commons:old-one'],
    canRetry:false,failed:false
  }});
  assert.match(markup,/cannot be resolved through the current public music source/);
  assert.doesNotMatch(markup,/data-action="retry-shared-challenge"/);
  assert.match(markup,/data-action="exit-challenge"/);
});
test('explicitly shortened challenges report missing songs before play and at completion',()=>{
  const recovery={waiting:false,skipped:2};
  const playing=render({ids:[track.id],current:track,recovery});
  assert.match(playing,/Playing 1 available song · 2 unavailable in the original shared link/);
  assert.match(playing,/CHALLENGE 01 \/ 1/);
  assert.match(playing,/class="discovery-paths"[^>]*hidden/);
  assert.match(playing,/class="compact-queue"[^>]*hidden/);
  const done=render({ids:[track.id],current:null,recovery,
    responses:[{id:track.id,action:'pass'}]});
  assert.match(done,/Challenge Complete/);
  assert.match(done,/2 shared songs were unavailable/);
  assert.match(done,/data-action="exit-challenge"/);
});
test('controller invalidates late requests and requires explicit choice before short play',()=>{
  const main=readFileSync(new URL('../app/public/main.js',import.meta.url),'utf8');
  assert.match(main,/let challengeLookupSerial = 0/);
  assert.match(main,/challengeLookupSerial\+\+;/);
  assert.match(main,/challengeLookupController\?\.abort\(\)/);
  assert.match(main,/if\(controller\.signal\.aborted \|\| serial!==challengeLookupSerial\)return/);
  assert.match(main,/if \(challengeIds\.length && challengeRecovery\?\.waiting\) \{\s*current=null/);
  assert.match(main,/const playable=challengeIds\.filter\(id=>Boolean\(lookup\(id\)\)\)/);
  assert.match(main,/if\(!playable\.length\)return/);
  assert.match(main,/case 'retry-shared-challenge'/);
  assert.match(main,/case 'continue-shared-challenge'/);
  assert.match(main,/case 'exit-challenge': return exitSharedChallenge/);
  assert.match(main,/void loadMore\(state\.genre,true,false,returnFocus\)/);
  assert.match(main,/if\(challengeIds\.length\)await hydrateSharedChallenge\(\{initial:true\}\)/);
});
