import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createViews} from '../app/public/views.js';
import {createInitialState} from '../app/src/taste.mjs';
import {encodeChallenge,decodeChallenge} from '../app/src/challenge.mjs';
import {
  eligibleChallengeTracks,defaultChallengeDraft,reconcileChallengeDraft,
  toggleChallengeDraft,moveChallengeDraft,matchingChallengeTracks,challengeLibraryPage,
  MAX_CHALLENGE_TRACKS,CHALLENGE_SEARCH_PAGE_SIZE
} from '../app/src/challenge-draft.mjs';

const track=(id,title=id,source='deezer')=>({id,source,title,artist:'Fixture Artist',genre:'unknown'});
const tracks=Array.from({length:8},(_,i)=>track('deezer:'+(9100001+i)));
tracks.push(track('jellyfin:secret','Private Audio','jellyfin'));
const favorites=tracks.map(t=>t.id);
const eligible=eligibleChallengeTracks(favorites,tracks);

function render(state,selection=undefined,query='',page=1){
  const args={state,catalog:tracks,current:null,allGenres:['all'],
    challengeIds:[],challengeResponses:[],catalogWarning:'',catalogLive:true,
    collectionQuery:'',collectionSort:'recent',challengeFilterQuery:query,challengePage:page};
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

test('unselected saved tracks can be reached across every fixed-size result page',()=>{
  const large=Array.from({length:95},(_,i)=>track('deezer:'+(9300000+i),'Long Song '+i));
  const saved=large.map(t=>t.id);
  const all=eligibleChallengeTracks(saved,large);
  const chosen=defaultChallengeDraft(all);
  const a=challengeLibraryPage(all,chosen);
  assert.equal(a.total,90);
  assert.equal(a.pageCount,3);
  assert.equal(a.page,1);
  assert.equal(a.start,1);
  assert.equal(a.end,40);
  assert.equal(a.tracks.length,40);
  assert.ok(a.tracks.every(track=>!chosen.includes(track.id)));
  const b=challengeLibraryPage(all,chosen,'',2);
  assert.deepEqual([b.page,b.start,b.end,b.tracks.length],[2,41,80,40]);
  const c=challengeLibraryPage(all,chosen,'',3);
  assert.deepEqual([c.page,c.start,c.end,c.tracks.length],[3,81,90,10]);
  assert.equal(c.tracks.at(-1).id,all.at(-1).id);
  assert.equal(new Set([...a.tracks,...b.tracks,...c.tracks].map(t=>t.id)).size,90,
    'Every unselected song should be reachable exactly once');
});

test('search applies before slicing, resets to first page and excludes selected favorites',()=>{
  const many=Array.from({length:125},(_,i)=>track('deezer:'+(9400000+i),'Shared Artist Song '+i));
  const chosen=many.slice(0,5).map(t=>t.id);
  const searchable=challengeLibraryPage(many,chosen,'shared artist',1);
  assert.equal(searchable.total,120);
  assert.equal(searchable.tracks.length,40);
  assert.deepEqual(searchable.tracks[0],many[5]);
  assert.equal(challengeLibraryPage(many,chosen,'song 124',1).tracks[0].id,many[124].id);
  assert.equal(challengeLibraryPage(many,chosen,'song 0',1).total,0);
  const last=challengeLibraryPage(many,chosen,'',999999);
  assert.equal(last.page,3);
  assert.equal(last.tracks.length,40);
  const invalid=challengeLibraryPage(many,chosen,'',Infinity);
  assert.equal(invalid.page,1);
  assert.equal(challengeLibraryPage(many,chosen,'',0).page,1);
  const full=challengeLibraryPage(many,many.map(t=>t.id));
  assert.deepEqual(full.tracks,[]);
  assert.equal(full.total,0);
  assert.equal(full.pageCount,1);
});

test('challenge page controls expose honest range, accessible navigation and bounded rows',()=>{
  const large=Array.from({length:94},(_,i)=>track('deezer:'+(9500000+i),'Archive '+i));
  const state={...createInitialState(),favorites:large.map(t=>t.id)};
  const selected=large.slice(-5).map(t=>t.id);
  const args={state,catalog:large,current:null,allGenres:['all'],
    challengeIds:[],challengeResponses:[],challengeDraft:selected,
    catalogWarning:'',catalogLive:true,collectionQuery:'',collectionSort:'recent'};
  const show=(page)=>createViews({...args,challengePage:page}).renderChallenges();
  const first=show(1);
  assert.match(first,/89 unselected songs found · Showing 1–40 of 89/);
  assert.match(first,/Page 1 of 3/);
  assert.match(first,/data-action="challenge-previous-page"[^>]+disabled/);
  assert.match(first,/data-action="challenge-next-page"/);
  assert.match(first,/aria-label="Saved song search pages"/);
  assert.match(first,/id="challenge-match-count"[^>]+role="status"[^>]+aria-live="polite"/);
  assert.equal((first.match(/class="challenge-library-item"/g)||[]).length,40);
  const last=show(3);
  assert.match(last,/89 unselected songs found · Showing 81–89 of 89/);
  assert.match(last,/Page 3 of 3/);
  assert.match(last,/data-action="challenge-next-page"[^>]+disabled/);
  assert.equal((last.match(/class="challenge-library-item"/g)||[]).length,9);
  assert.doesNotMatch(last,/No unselected saved recordings match/);
});

test('controller resets paging on typing and announces pages without changing challenge drafts',()=>{
  const src=readFileSync(new URL('../app/public/main.js',import.meta.url),'utf8');
  assert.match(src,/let challengePage = 1/);
  assert.match(src,/challengePage=1; \/\/ Search changes/);
  assert.match(src,/case 'challenge-next-page':/);
  assert.match(src,/case 'challenge-previous-page':/);
  assert.match(src,/challengePage=next;\s+render\(\)/);
  assert.match(src,/querySelector\('#challenge-match-count'\)\?\.focus\(\)/);
  const part=src.slice(src.indexOf("case 'challenge-next-page':"),src.indexOf("case 'add-challenge-track':"));
  assert.doesNotMatch(part,/recordDecision\(|storeChallengeDraft\(|persist\(|sessionStorage/);
});

test('challenge buttons keep stable focus through unrelated redraws without changing draft state',()=>{
  const src=readFileSync(new URL('../app/public/main.js',import.meta.url),'utf8');
  const render=src.slice(src.indexOf('function render()'),src.indexOf('function renderModal()'));
  assert.match(render,/focusedChallengeAction=view==='challenges'/);
  assert.match(render,/focusedOldControl\?\.matches\?\.\('\.challenge-hero \[data-action\], \.challenge-builder \[data-action\]'\)/);
  assert.match(render,/button\.dataset\.action===focusedChallengeAction\.action/);
  assert.match(render,/button\.dataset\.id===focusedChallengeAction\.id/);
  assert.match(render,/main\.querySelector\('#challenge-track-search'\) \|\| main/);
  assert.match(render,/\(same \|\| sameTrack \|\| fallback\)\.focus\(\{preventScroll:true\}\)/);
  const focusLogic=render.slice(render.indexOf('if(focusedChallengeAction &&'),
    render.indexOf('applySavedVolume();',render.indexOf('if(focusedChallengeAction &&')));
  assert.doesNotMatch(focusLogic,/persist\(|recordDecision\(|storeChallengeDraft\(|sessionStorage|history\./,
    'Restoring keyboard focus must not write progress, record votes or change saved drafts');
});
