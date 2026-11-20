import test from 'node:test';
import assert from 'node:assert/strict';
import {createViews} from '../app/public/views.js';
import {createInitialState} from '../app/src/taste.mjs';
import {encodeChallenge,decodeChallenge} from '../app/src/challenge.mjs';
import {
  eligibleChallengeTracks,defaultChallengeDraft,reconcileChallengeDraft,
  toggleChallengeDraft,moveChallengeDraft,matchingChallengeTracks,
  MAX_CHALLENGE_TRACKS,CHALLENGE_SEARCH_PAGE_SIZE
} from '../app/src/challenge-draft.mjs';

const track=(id,title=id,source='deezer')=>({id,source,title,artist:'Fixture Artist',genre:'unknown'});
const tracks=Array.from({length:8},(_,i)=>track('deezer:'+(9100001+i)));
tracks.push(track('jellyfin:secret','Private Audio','jellyfin'));
const favorites=tracks.map(t=>t.id);
const eligible=eligibleChallengeTracks(favorites,tracks);

function render(state,selection=undefined,query=''){
  const args={state,catalog:tracks,current:null,allGenres:['all'],
    challengeIds:[],challengeResponses:[],catalogWarning:'',catalogLive:true,
    collectionQuery:'',collectionSort:'recent',challengeFilterQuery:query};
  if(selection!==undefined)args.challengeDraft=selection;
  return createViews(args).renderChallenges();
}

test('eligible challenge sources are saved public Deezer songs, in newest order, once',()=>{
  const withDuplicates=eligibleChallengeTracks([...favorites,'deezer:9100002','deezer:9100002','deezer:999999'],tracks);
  assert.deepEqual(withDuplicates.map(t=>t.id).slice(0,3),
    ['deezer:9100002','deezer:9100008','deezer:9100007']);
  assert.equal(withDuplicates.length,8);
  assert.ok(withDuplicates.every(t=>t.id.startsWith('deezer:')));
  const corrupt=eligibleChallengeTracks(['jellyfin:secret','deezer:00001','deezer:9100001'],[
    track('deezer:00001','Suspicious'),...tracks
  ]);
  assert.deepEqual(corrupt.map(t=>t.id),['deezer:9100001']);
});
test('default remains five most recent; selection never exceeds five or duplicates',()=>{
  assert.equal(MAX_CHALLENGE_TRACKS,5);
  assert.equal(CHALLENGE_SEARCH_PAGE_SIZE,40);
  const chosen=defaultChallengeDraft(eligible);
  assert.deepEqual(chosen,eligible.slice(0,5).map(t=>t.id));
  const noSixth=toggleChallengeDraft(chosen,eligible[5].id,eligible);
  assert.deepEqual(noSixth,chosen);
  const smaller=toggleChallengeDraft(chosen,chosen[0],eligible);
  assert.deepEqual(smaller,chosen.slice(1));
  const appended=toggleChallengeDraft(smaller,eligible[5].id,eligible);
  assert.deepEqual(appended,[...chosen.slice(1),eligible[5].id]);
  assert.deepEqual(reconcileChallengeDraft([...chosen,chosen[0],'jellyfin:secret'],eligible),chosen);
});
test('up/down reorders without dropping songs; stale and invalid selections are discarded',()=>{
  const initial=eligible.slice(0,3).map(t=>t.id);
  assert.deepEqual(moveChallengeDraft(initial,initial[0],1,eligible),
    [initial[1],initial[0],initial[2]]);
  assert.deepEqual(moveChallengeDraft(initial,initial[1],-1,eligible),
    [initial[1],initial[0],initial[2]]);
  assert.deepEqual(moveChallengeDraft(initial,initial[0],-1,eligible),initial);
  assert.deepEqual(moveChallengeDraft(initial,initial[2],1,eligible),initial);
  assert.deepEqual(moveChallengeDraft(initial,'jellyfin:secret',1,eligible),initial);
  const missing=eligible.filter(t=>t.id!==initial[1]);
  assert.deepEqual(reconcileChallengeDraft(initial,missing),[initial[0],initial[2]]);
  const reordered=moveChallengeDraft(initial,initial[0],1,eligible);
  const link=encodeChallenge(reordered);
  assert.equal(link,'v1.'+reordered.join('~'));
  assert.deepEqual(decodeChallenge(link),reordered);
});
test('search includes older favorites, clips visible rows, excludes private data',()=>{
  const large=Array.from({length:75},(_,i)=>track('deezer:'+(9000000+i),'Song '+i));
  const pages=matchingChallengeTracks(large);
  assert.equal(pages.total,75);
  assert.equal(pages.tracks.length,40);
  assert.deepEqual(matchingChallengeTracks(large,'song 74').tracks.map(t=>t.id),[large[74].id]);
  assert.equal(matchingChallengeTracks(large,'nonexistent').total,0);
});
test('screen renders genuine editable order, selection counts and escaped saved song names',()=>{
  const markup=render({...createInitialState(),favorites},eligible.slice(0,3).map(t=>t.id));
  assert.match(markup,/3 of 5 tracks selected/);
  assert.match(markup,/data-action="share-challenge" >↗ Share 3 Songs/);
  assert.match(markup,/data-action="move-challenge-up"/);
  assert.match(markup,/data-action="move-challenge-down"/);
  assert.match(markup,/data-action="remove-challenge-track"/);
  assert.match(markup,/data-action="add-challenge-track"/);
  assert.match(markup,/id="challenge-track-search"/);
  assert.match(markup,/data-action="reset-challenge-draft"/);
  assert.match(markup,/saved Deezer songs available/);
  assert.doesNotMatch(markup,/Private Audio|jellyfin:secret/);
});
test('empty draft disables sharing even with saved songs; older one-click UI still defaults',()=>{
  const state={...createInitialState(),favorites};
  const none=render(state,[]);
  assert.match(none,/data-action="share-challenge" disabled/);
  assert.match(none,/No songs selected/);
  const defaultMarkup=render(state);
  assert.match(defaultMarkup,/5 of 5 tracks selected/);
  assert.match(defaultMarkup,/data-action="share-challenge" >↗ Share 5 Songs/);
});
test('untrusted song titles are escaped before entering attributes and card HTML',()=>{
  const bad=track('deezer:9200111','<script>alert("x")</script>');
  const html= createViews({
    state:{...createInitialState(),favorites:[bad.id]},
    catalog:[bad],current:null,allGenres:['all'],
    challengeIds:[],challengeResponses:[],challengeDraft:[bad.id],
    catalogWarning:'',catalogLive:true,
    collectionQuery:'',collectionSort:'recent'
  }).renderChallenges();
  assert.doesNotMatch(html,/<script>/);
  assert.match(html,/&lt;script&gt;/);
  assert.match(html,/data-action="remove-challenge-track"/);
});
