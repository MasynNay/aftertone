import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createViews} from '../app/public/views.js';
import {createInitialState,recordChoice} from '../app/src/taste.mjs';

const render=({state=createInitialState(),current=null,feed={},searchQuery=''}={})=>
  createViews({state,catalog:[],current,allGenres:['all','pop'],challengeIds:[],
    challengeResponses:[],catalogWarning:'',catalogLive:true,
    collectionQuery:'',collectionSort:'recent',searchQuery,feed:{
      loading:false,hasMore:false,available:0,primed:true,...feed,
    }}).renderDiscovery();

test('first session shows three inline instructions and no forced popup',()=>{
  const markup=render();
  assert.match(markup,/class="first-listen-guide"/);
  assert.match(markup,/Three steps to find your sound/);
  assert.match(markup,/Choose a Path/);
  assert.match(markup,/Press Play/);
  assert.match(markup,/Keep or Pass/);
  assert.doesNotMatch(markup,/class="first-listen-guide"[^>]*hidden/);
  const track={id:'deezer:501',artist:'Sample Artist',title:'A Song'};
  const state=recordChoice(createInitialState(),{id:track.id,action:'like',artist:track.artist});
  assert.doesNotMatch(render({state}),/class="first-listen-guide"/);
});
test('empty search offers retry, clear search, alternate route and broadened filters',()=>{
  const state={...createInitialState(),genre:'pop',language:'en'};
  const markup=render({state,searchQuery:'a sample artist'});
  assert.match(markup,/No Matching Songs Found/);
  assert.match(markup,/data-action="load-more"/);
  assert.match(markup,/Retry Search/);
  assert.match(markup,/data-action="clear-search"/);
  assert.match(markup,/data-action="reset-discovery-filters"/);
  assert.match(markup,/data-path="explore"/);
  assert.doesNotMatch(markup,/data-action="reset-listens"/);
});
test('temporary provider failures have actionable status and do not replace saved data',()=>{
  const error='Network <unavailable>';
  const markup=render({feed:{error,hasMore:true}});
  assert.match(markup,/Music Is Temporarily Unavailable/);
  assert.match(markup,/Network &lt;unavailable&gt;/);
  assert.match(markup,/Find More Songs/);
  assert.match(markup,/Search for an Artist/);
  assert.match(markup,/role="status" aria-live="polite"/);
  assert.doesNotMatch(markup,/data-action="reset-listens"/);
});
test('pending search cannot be spammed; playlist challenge completion keeps exit action',()=>{
  const loading=render({feed:{loading:true,hasMore:true},searchQuery:'test'});
  assert.match(loading,/Finding Your Next Song/);
  assert.match(loading,/data-action="load-more" disabled/);
  assert.doesNotMatch(loading,/data-action="clear-search"/);
  const challenge=createViews({state:createInitialState(),catalog:[],current:null,
    allGenres:['all'],challengeIds:['deezer:99'],challengeResponses:[{id:'deezer:99',action:'pass'}],
    catalogWarning:'',catalogLive:true,collectionQuery:'',collectionSort:'recent',feed:{loading:false,hasMore:false}}).renderDiscovery();
  assert.match(challenge,/Challenge Complete/);
  assert.match(challenge,/data-action="exit-challenge"/);
  assert.doesNotMatch(challenge,/data-action="reset-discovery-filters"/);
});
test('broaden filters action keeps listening history and saved favorites intact',()=>{
  const main=readFileSync(new URL('../app/public/main.js',import.meta.url),'utf8');
  const reset=main.match(/case 'reset-discovery-filters':([\s\S]*?)case 'clear-search'/)?.[1];
  assert.ok(reset);
  for(const expected of ["state.genre='all'","state.language='all'","state.era='any'","persist();","loadMore(state.genre,true)"])
    assert.ok(reset.includes(expected),expected);
  assert.doesNotMatch(reset,/state\.history\s*=|state\.favorites\s*=|reset-listens|saveImportedPlaylist/);
  assert.match(main,/changeDiscoveryPath\(path\.dataset\.path\)/);
});
