import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createViews} from '../app/public/views.js';
import {createInitialState} from '../app/src/taste.mjs';

const track=id=>({id,title:'Synthetic Track',artist:'Fixture Artist',
  source:'deezer',genre:'unknown',mood:'Fresh',duration:208});
const ids=['deezer:9100001','deezer:9100002'];
const catalog=ids.map(track);
function discovery({current=catalog[0],responses=[],skipped=new Set(),
  challengeIds=ids,recovery=null}={}) {
  return createViews({
    state:createInitialState(),catalog,current,allGenres:['all'],
    challengeIds,challengeResponses:responses,challengeSkippedIds:skipped,
    challengeRecovery:recovery,feed:{available:0,loading:false,hasMore:false},
    catalogWarning:'',catalogLive:true,collectionQuery:'',collectionSort:'recent',
  }).renderDiscovery();
}
test('a broken shared preview retains a neutral skip, retry, and explicit exit',()=>{
  const markup=discovery();
  assert.match(markup,/id="preview-recovery"[^>]+hidden/);
  assert.match(markup,/data-action="retry-preview"/);
  assert.match(markup,/id="preview-skip" data-action="skip-unavailable"/);
  assert.match(markup,/skip this recording without counting a Pass/);
  assert.match(markup,/data-action="exit-challenge">Leave Challenge/);
  assert.match(markup,/Listen before deciding; failed clips can be skipped without a vote/);
  assert.match(markup,/CHALLENGE 01 \/ 2/);
});
test('a neutral skip advances the challenge ordinal without a Pass or phantom completion',()=>{
  const markup=discovery({current:catalog[1],skipped:new Set([ids[0]])});
  assert.match(markup,/CHALLENGE 02 \/ 2/);
  assert.match(markup,/BLIND CHALLENGE/);
  assert.doesNotMatch(markup,/Challenge Finished/);
});
test('when every preview fails, the outcome is not an invented vote',()=>{
  const markup=discovery({current:null,skipped:new Set(ids)});
  assert.match(markup,/Challenge Finished/);
  assert.match(markup,/No songs were rated/);
  assert.match(markup,/2 previews were unplayable and not counted as Passes/);
  assert.match(markup,/data-action="exit-challenge"/);
  assert.doesNotMatch(markup,/You kept \d+ of 2 rated songs/);
});
test('a failed preview and a real Pass are counted independently',()=>{
  const markup=discovery({current:null,
    responses:[{id:ids[1],action:'pass'}],
    skipped:new Set([ids[0]])});
  assert.match(markup,/Challenge Finished/);
  assert.match(markup,/You kept 0 of 1 rated songs/);
  assert.match(markup,/1 preview was unplayable and not counted as a Pass/);
});
test('a fully voted challenge still reports normal completion',()=>{
  const markup=discovery({current:null,responses:ids.map(id=>({id,action:'like'}))});
  assert.match(markup,/Challenge Complete/);
  assert.match(markup,/You kept 2 of 2 rated songs/);
  assert.doesNotMatch(markup,/preview was unplayable|previews were unplayable/);
});
test('ordinary discovery retains the same neutral skip and continuous listening guidance',()=>{
  const markup=discovery({challengeIds:[],skipped:new Set()});
  assert.match(markup,/id="preview-skip" data-action="skip-unavailable"/);
  assert.match(markup,/Play to begin continuous listening/);
  assert.doesNotMatch(markup,/data-action="exit-challenge">Leave Challenge/);
});
test('controller skips failed shared previews without writing ratings or changing share IDs',()=>{
  const main=readFileSync(new URL('../app/public/main.js',import.meta.url),'utf8');
  const begin=main.indexOf('function skipUnavailablePreview()');
  const end=main.indexOf('function advancePreview()',begin);
  assert.ok(begin>0&&end>begin);
  const body=main.slice(begin,end);
  assert.match(body,/failedAudioId !== current\.id/);
  assert.match(body,/challengeSkippedIds\.add\(current\.id\)/);
  assert.match(body,/else unvotedPreviews\.add\(current\.id\)/);
  assert.doesNotMatch(body,/recordChoice|recordDecision|history\.replaceState|persist\(\)/);
  assert.match(body,/chooseNext\(\)/);
  assert.match(body,/main\.querySelector\('\[data-action="exit-challenge"\]'\)/);
  assert.match(main,/new Set\(\[\.\.\.challengeResponses\.map\(item=>item\.id\),\.\.\.challengeSkippedIds\]\)/);
  assert.match(main,/challengeSkippedIds\.clear\(\)/);
  assert.match(main,/continuousListening = !challengeIds\.length/);
  assert.doesNotMatch(main,/skipRecovery\.hidden=Boolean\(challengeIds\.length\)/);
  assert.match(main,/challengeIds\.length\s*\?\s*'Listen, then Keep or Pass/);
});
