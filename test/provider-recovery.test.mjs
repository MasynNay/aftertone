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
