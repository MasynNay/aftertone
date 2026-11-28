import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rememberUnratedPreview,previousUnratedPreview,removeUnratedPreview,MAX_RECENT_PREVIEWS} from '../app/src/discovery/preview-history.mjs';
import {createViews} from '../app/public/views.js';
import {createInitialState} from '../app/src/taste.mjs';
test('recent preview history is bounded, deduplicated and newest-first',()=>{
  let ids=[];
  for(let i=0;i<40;i++)ids=rememberUnratedPreview(ids,'deezer:'+i);
  assert.equal(ids.length,MAX_RECENT_PREVIEWS);
  assert.equal(previousUnratedPreview(ids),'deezer:39');
  assert.equal(previousUnratedPreview(ids,id=>id!=='deezer:39'),'deezer:38');
  assert.equal(previousUnratedPreview(ids,()=>false),null);
  const remembered=rememberUnratedPreview(ids,'deezer:25');
  assert.equal(remembered.at(-1),'deezer:25');
  assert.equal(new Set(remembered).size,remembered.length);
  assert.equal(removeUnratedPreview(remembered,'deezer:25').includes('deezer:25'),false);
  assert.equal(ids.at(-1),'deezer:39');
});
const track={id:'deezer:123',title:'Fixture secret title',artist:'Fixture secret artist',source:'deezer',genre:'pop'};
function scene({blind=false,challenge=false,autoAdvanceEnabled=true,canRevisit=false,current=track}={}) {
  return createViews({state:{...createInitialState(),blind},catalog:[track],current,allGenres:['all','pop'],challengeIds:challenge?[track.id]:[],challengeResponses:[],feed:{autoAdvanceEnabled,canRevisit}}).renderDiscovery();
}
test('normal controls preserve autoplay default, pressed state, neutral navigation and blindness',()=>{
  assert.match(scene(),/aria-label="Auto-advance previews" aria-pressed="true"/);
  assert.match(scene(),/id="previous-unrated"[^>]*disabled/);
  const manual=scene({autoAdvanceEnabled:false,canRevisit:true,blind:true});
  assert.match(manual,/aria-label="Auto-advance previews" aria-pressed="false"/);
  assert.match(manual,/Single-preview mode waits for your decision/);
  assert.doesNotMatch(manual,/id="previous-unrated"[^>]*disabled/);
  assert.match(manual,/Next without rating/);
  assert.doesNotMatch(manual,/Fixture secret title|Fixture secret artist/);
});
test('shared challenges never expose neutral navigation or radio preferences; empty discovery permits revisit',()=>{
  assert.doesNotMatch(scene({challenge:true,canRevisit:true}),/data-action="(?:toggle-preview-mode|next-unrated|previous-unrated)"/);
  assert.match(scene({current:null,canRevisit:true}),/data-action="previous-unrated"/);
});
test('neutral navigation is feed-scoped and never persists a choice or starts audio',()=>{
  const source=readFileSync(new URL('../app/public/main.js',import.meta.url),'utf8');
  const block=source.slice(source.indexOf('function rememberCurrentUnrated()'),source.indexOf('async function togglePlayback('));
  assert.match(block,/feed\.recentUnrated/);
  assert.match(block,/!heard\.has\(id\)/);
  assert.match(block,/matchesFeed\(track,state\.genre\)/);
  assert.match(block,/unvotedPreviews\.delete\(track\.id\)/);
  assert.doesNotMatch(block,/recordDecision\(|recordChoice\(|persist\(|togglePlayback\(/);
  assert.match(source,/continuousListening = !challengeIds\.length && autoAdvanceEnabled/);
  assert.match(source,/function completePreview\(\)/);
});
