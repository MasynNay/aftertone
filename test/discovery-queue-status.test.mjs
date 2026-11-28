import test from 'node:test';
import assert from 'node:assert/strict';
import {countUpcoming,queueStatus,MAX_SESSION_TRACKS,REFILL_TARGET} from '../app/src/discovery/auto-refill.mjs';
import {createViews} from '../app/public/views.js';
import {createInitialState} from '../app/src/taste.mjs';
test('upcoming count excludes current card and duplicate identities',()=>{
  const pool=[{id:'deezer:1'},{id:'deezer:2'},{id:'deezer:2'},{id:'deezer:3'},null];
  assert.equal(countUpcoming(pool,'deezer:2'),2);
  assert.equal(countUpcoming(pool),3);
  assert.equal(countUpcoming(pool,'outside'),3);
});
test('queue status differentiates load, cooldown, exhaustion, search, bounds and visibility',()=>{
  const base={ready:3,loaded:22,now:1000,sourceLabel:'Local catalog'};
  assert.equal(queueStatus(base).state,'refill');
  assert.equal(queueStatus({...base,ready:REFILL_TARGET}).state,'ready');
  assert.equal(queueStatus({...base,loading:true,retryAt:2000}).state,'loading');
  assert.equal(queueStatus({...base,hasMore:false}).state,'exhausted');
  assert.equal(queueStatus({...base,retryAt:2000}).state,'cooldown');
  assert.equal(queueStatus({...base,retryAt:1000}).state,'refill');
  assert.equal(queueStatus({...base,visible:false}).state,'paused');
  assert.equal(queueStatus({...base,searching:true}).state,'search');
  assert.equal(queueStatus({...base,loaded:MAX_SESSION_TRACKS}).state,'bounded');
  assert.match(queueStatus({...base,searching:true}).loadedLabel,/22 loaded for this search · Local catalog/);
  assert.equal(queueStatus({ready:-1,loaded:NaN}).ready,0);
});
test('queue renders honest state and explicit action while shared challenges hide queue',()=>{
  const track={id:'deezer:1',title:'Test',artist:'Fixture',source:'deezer',genre:'rock',mood:'Fresh'};
  const opts={state:createInitialState(),catalog:[track],current:track,allGenres:['all'],challengeIds:[],challengeResponses:[],feed:{queue:queueStatus({ready:0,loaded:1,hasMore:false,sourceLabel:'Deezer'})}};
  const html=createViews(opts).renderDiscovery();
  assert.match(html,/data-queue-state="exhausted"/);
  assert.match(html,/id="queue-count">0</);
  assert.match(html,/1 loaded for this path · Deezer/);
  assert.match(html,/id="queue-refill-button"/);
  const challenge=createViews({...opts,challengeIds:[track.id]}).renderDiscovery();
  assert.doesNotMatch(challenge,/id="queue-refill-button"/);
  assert.match(challenge,/class="compact-queue"[^>]+hidden/);
});
