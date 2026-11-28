import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSavedQueue,nextSavedIndex} from '../app/src/saved-playback.mjs';
import {createViews} from '../app/public/views.js';
import {createInitialState} from '../app/src/taste.mjs';
const a='deezer:1',b='deezer:2',c='deezer:3',y='youtube:abcdefghi01';
const catalog=[a,b,c,y].map(id=>({id,source:id.split(':')[0],title:'Fixture '+id,artist:'Artist'}));
test('saved queue preserves requested order, deduplicates, excludes unsaved/missing/video identities',()=>{
  const ids=[b,a,b,c,y,'deezer:missing'];
  assert.deepEqual(buildSavedQueue(ids,[a,b,y,'deezer:missing'],catalog),[b,a]);
  assert.deepEqual(ids,[b,a,b,c,y,'deezer:missing']);
});
test('shuffle is deterministic with injected RNG and preserves every eligible ID',()=>{
  assert.deepEqual(buildSavedQueue([a,b,c],[a,b,c],catalog,{shuffle:true,random:()=>0}),[b,c,a]);
});
test('queue boundaries and repeat wrap without inventing an index',()=>{
  assert.equal(nextSavedIndex([a,b],0),1);
  assert.equal(nextSavedIndex([a,b],1),null);
  assert.equal(nextSavedIndex([a,b],1,{repeat:true}),0);
  assert.equal(nextSavedIndex([a,b],0,{direction:-1,repeat:true}),1);
  assert.equal(nextSavedIndex([],0,{repeat:true}),null);
  assert.equal(nextSavedIndex([a],0,{repeat:true}),0);
});
test('Collection has playback controls and playlist-specific launch actions',()=>{
  const state={...createInitialState(),favorites:[a,b],savedTracks:catalog,personalPlaylists:[{id:'pl-one',name:'Mix',trackIds:[a,b]}]};
  const html=createViews({state,catalog,current:null,allGenres:['all'],challengeIds:[],challengeResponses:[],personalPlaylistId:'pl-one'}).renderCollection();
  assert.match(html,/Play Collection/);assert.match(html,/Shuffle Playlist/);
  assert.match(html,/id="saved-playback-panel" hidden/);
  assert.match(html,/data-action="saved-playback-repeat"/);
});
