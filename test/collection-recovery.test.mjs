import test from 'node:test';
import assert from 'node:assert/strict';
import {collectionRecoveryPlan,prepareRecoveredFavorites,RECOVERY_BATCH_SIZE} from '../app/src/collection-recovery.mjs';
import {createInitialState} from '../app/src/taste.mjs';
import {createViews} from '../app/public/views.js';
const song=i=>({id:'deezer:'+i,title:'Song '+i,artist:'Artist',source:'deezer'});
test('recovery uses exact saved identities and local catalog before remote, in bounded batches',()=>{
  const state={...createInitialState(),favorites:[...Array.from({length:9},(_,i)=>song(i+1).id),'commons:old'],savedTracks:[song(1)]};
  const catalog=[song(2),song(99)];
  const plan=collectionRecoveryPlan(state,catalog);
  assert.equal(plan.missing,9);assert.equal(plan.recoverable,8);assert.equal(plan.unsupported,1);
  assert.equal(plan.ids.length,RECOVERY_BATCH_SIZE);
  assert.deepEqual(plan.local,[song(2)]);
  assert.deepEqual(plan.remote,['deezer:3','deezer:4','deezer:5','deezer:6']);
  const next=collectionRecoveryPlan(state,catalog,new Set(plan.ids));
  assert.deepEqual(next.ids,['deezer:7','deezer:8','deezer:9']);
  assert.equal(collectionRecoveryPlan(state,catalog,new Set([...plan.ids,...next.ids])).retry,true);
});
test('wrong IDs, removed favorites, and already stored tracks never become recovered additions',()=>{
  const state={...createInitialState(),favorites:['deezer:1','deezer:2'],savedTracks:[song(1)],history:[{id:'deezer:1',action:'like'}]};
  const result=prepareRecoveredFavorites(state,['deezer:1','deezer:2','deezer:3'],[song(1),song(2),song(2),song(3),song(99)]);
  assert.deepEqual(result.tracks,[song(2)]);
  assert.deepEqual(result.next.favorites,state.favorites);
  assert.equal(result.next.history,state.history);
  assert.deepEqual(result.next.savedTracks,[song(1),song(2)]);
  assert.equal(state.savedTracks.length,1);
  assert.equal(prepareRecoveredFavorites(state,['deezer:3'],[song(3)]).next,state);
});
test('visible collection exposes recovery and unsupported identities without inventing song cards',()=>{
  const state={...createInitialState(),favorites:['deezer:2','commons:old']};
  const recovery={...collectionRecoveryPlan(state,[]),message:'<unsafe>'};
  const markup=createViews({state,catalog:[],current:null,allGenres:['all'],challengeIds:[],challengeResponses:[],collectionRecovery:recovery}).renderCollection();
  assert.match(markup,/Restore missing song details/);
  assert.match(markup,/Recover 1 song identity/);
  assert.match(markup,/1 identity cannot be recovered/);
  assert.match(markup,/&lt;unsafe&gt;/);
  assert.doesNotMatch(markup,/<unsafe>/);
});
