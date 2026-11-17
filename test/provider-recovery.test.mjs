import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createViews} from '../app/public/views.js';
import {createInitialState} from '../app/src/taste.mjs';

const viewWith = (overrides={})=>{
  const track={id:'deezer:123',source:'deezer',title:'Fixture Melody',artist:'Fixture Artist',genre:'unknown',mood:'Fresh',artwork:null,duration:190};
  return createViews({state:createInitialState(),catalog:[track],current:track,allGenres:['all'],
    challengeIds:[],challengeResponses:[],catalogWarning:'',catalogLive:true,collectionQuery:'',
    collectionSort:'recent',feed:{loading:false,hasMore:true,available:1},availableSources:['deezer'],...overrides}).renderDiscovery();
};

test('preview recovery provides accessible retry and neutral skip actions',()=>{
  const markup=viewWith();
  assert.match(markup,/id="preview-recovery"[^>]*role="status"[^>]*hidden/);
  assert.match(markup,/data-action="retry-preview"/);
  assert.match(markup,/data-action="skip-unavailable"/);
  assert.match(markup,/Skip Without Voting/);
});
test('discovery errors offer a retry while preserving the listening card',()=>{
  const markup=viewWith({feed:{loading:false,hasMore:true,available:1,error:'Deezer did not respond.'}});
  assert.match(markup,/Deezer did not respond/);
  assert.match(markup,/Retry Discovery/);
  assert.match(markup,/id="listening-card"/);
});
test('retry invalidates old preview URL; neutral skip does not record a decision',()=>{
  const source=readFileSync(new URL('../app/public/main.js',import.meta.url),'utf8');
  assert.match(source,/function retryFailedPreview\(\)[\s\S]*?resolved\.delete\(current\.id\)/);
  assert.match(source,/function skipUnavailablePreview\(\)[\s\S]*?unvotedPreviews\.add\(current\.id\)/);
  const skip=source.match(/function skipUnavailablePreview\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(skip,'Skip handler exists');
  assert.doesNotMatch(skip,/recordDecision|acceptChoice|persist\(/);
});

test('preview recovery explains the active music source rather than always blaming Deezer',()=>{
  const base={id:'deezer:123',source:'deezer',title:'Fixture Melody',artist:'Fixture Artist',genre:'unknown',mood:'Fresh',artwork:null,duration:190};
  const render=(track)=>viewWith({catalog:[track],current:track});
  const deezer=render(base);
  const jellyfin=render({...base,id:'jellyfin:123',source:'jellyfin'});
  const audius=render({...base,id:'audius:123',source:'audius'});
  assert.match(deezer,/This Deezer preview is unavailable/);
  assert.match(deezer,/Retry a fresh provider link/);
  assert.match(jellyfin,/Your Jellyfin stream is unavailable/);
  assert.match(jellyfin,/Check your media server/);
  assert.doesNotMatch(jellyfin,/This Deezer preview is unavailable/);
  assert.match(audius,/This preview is unavailable from its music source/);
  assert.doesNotMatch(audius,/Retry a fresh provider link/);
  for (const view of [deezer,jellyfin,audius]) {
    assert.match(view,/data-action="retry-preview"/);
    assert.match(view,/data-action="skip-unavailable"/);
    assert.match(view,/without counting it as a Pass/);
  }
});

test('empty provider outage has one understandable retry and one error announcement',()=>{
  const error='Deezer did not respond.';
  const markup=viewWith({current:null,feed:{loading:false,hasMore:true,available:0,error}});
  assert.match(markup,/Music Is Temporarily Unavailable/);
  assert.equal((markup.match(/data-action="load-more"/g)||[]).length,1,
    'There should not be two different retry buttons for one empty-state outage');
  assert.match(markup,/>Retry Discovery<\/button>/);
  assert.doesNotMatch(markup,/Find More Songs/);
  assert.equal(markup.split(error).length-1,1,'Provider error should only be announced once');
  assert.doesNotMatch(markup,/class="discovery-mode-note" role="status"/,
    'An empty-state error already has its own live status region');
  const withSong=viewWith({feed:{loading:false,hasMore:true,available:1,error}});
  assert.match(withSong,/class="discovery-mode-note" role="status"/,
    'While a song is visible, preserve the provider retry banner without replacing it');
});
