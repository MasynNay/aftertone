import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { selectAvailablePath, belongsToDiscoveryFeed } from '../app/src/discovery/queue.mjs';
import { planDiscoveryRequest } from '../app/src/discovery/mode-engine.mjs';
import { fetchDeezerPage } from '../app/src/deezer.mjs';
import { createViews } from '../app/public/views.js';
import { createInitialState } from '../app/src/taste.mjs';
import { renderDuels } from '../app/public/duels-view.js';

const track=(id,artist)=>({id:`deezer:${id}`,artist,title:'Single',source:'deezer',genre:'unknown'});
const heard=[{id:'deezer:101',action:'like',artist:'Harry Styles'}];
const context={history:heard,seeds:['Harry Styles'],related:[],position:0};

test('Comfort Zone still presents real available music before saved-artist matches arrive',()=>{
  const candidates=[track(102,'Nina Simone'),track(103,'Tame Impala')];
  const result=selectAvailablePath(candidates,'familiar',context);
  assert.deepEqual(result.tracks,candidates);
  assert.equal(result.broadened,true);
  assert.match(result.reason,/saved artists/);
});

test('New Territory never leaves an empty player just because the cached songs are familiar',()=>{
  const candidates=[track(102,'Harry Styles'),track(103,'Harry Styles')];
  const result=selectAvailablePath(candidates,'balanced',context);
  assert.equal(result.tracks.length,2);
  assert.equal(result.broadened,true);
  assert.match(result.reason,/Related-artist/);
});

test('Wild Card remains unfamiliar when novel performers exist, but never strands a nonempty music queue',()=>{
  const pool=[track(102,'Harry Styles'),track(103,'Tame Impala')];
  const ideal=selectAvailablePath(pool,'explore',context);
  assert.deepEqual(ideal.tracks.map(x=>x.artist),['Tame Impala']);
  assert.equal(ideal.broadened,false);
  assert.deepEqual(selectAvailablePath([pool[0]],'explore',context).tracks,[pool[0]]);
});

test('already heard preferred artists cannot block unplayed music',async()=>{
  // The main selector must filter history first, BEFORE it applies the strict
  // preference pool. This was an additional cause of the empty-track bug.
  const source=await readFile(new URL('../app/public/main.js',import.meta.url),'utf8');
  assert.match(source,/const heard=new Set\(state\.history\.map\(event=>event\.id\)\)/);
  assert.match(source,/!heard\.has\(track\.id\) && !unvotedPreviews\.has\(track\.id\)/);
  assert.match(source,/matchesFeed\(track,genre\)/);
  const available=[track(101,'Harry Styles'),track(102,'Nina Simone')]
    .filter(t=>!new Set(heard.map(h=>h.id)).has(t.id));
  assert.deepEqual(selectAvailablePath(available,'familiar',context).tracks.map(t=>t.artist),['Nina Simone']);
});

test('path changes reuse previously fetched discovery, but cannot recycle explicit search results',()=>{
  const active=new Set(['deezer:5']);
  const shared=new Set(['deezer:6']);
  assert.equal(belongsToDiscoveryFeed('deezer:6',active,shared,false),true);
  assert.equal(belongsToDiscoveryFeed('deezer:6',active,shared,true),false);
  assert.equal(belongsToDiscoveryFeed('deezer:5',active,shared,true),true);
  assert.equal(belongsToDiscoveryFeed('deezer:7',active,shared,false),false);
});

test('when a broad chart lane is exhausted, Comfort still requests saved songs',()=>{
  const result=planDiscoveryRequest({mode:'familiar',requestNumber:9,liked:[{artist:'Harry Styles'}],
    exhausted:new Set(['broad'])});
  assert.equal(result.kind,'liked');
  assert.equal(result.lane.artist,'Harry Styles');
});

test('when broad and all artist lanes are finished, scheduler reports none instead of repolling',()=>{
  assert.equal(planDiscoveryRequest({mode:'balanced',requestNumber:1,related:[],
    exhausted:new Set(['broad'])}).kind,'none');
});

test('Deezer artist search pages never repeat page zero after page one',async()=>{
  const offsets=[],lookups=[];
  const fetcher=async url=>{
    const u=new URL(url);
    if(u.pathname==='/search/artist') {
      lookups.push(u.searchParams.get('q'));
      return {ok:true,json:async()=>({data:[{id:51,name:'Harry Styles'}]})};
    }
    assert.equal(u.pathname,'/artist/51/top');
    offsets.push(Number(u.searchParams.get('index')));
    return {ok:true,json:async()=>({data:[{
      id:98401,title:'Good Song',readable:true,artist:{name:'Harry Styles'},
      album:{cover_big:'https://example.org/art.jpg'},preview:'https://cdnt-preview.dzcdn.net/test.mp3',
      duration:200,
    }],total:100})};
  };
  const first=await fetchDeezerPage('all','0',fetcher,'','all','any','Harry Styles');
  const second=await fetchDeezerPage('all','1',fetcher,'','all','any','Harry Styles');
  assert.deepEqual(offsets,[0,25]);
  assert.deepEqual(lookups,['Harry Styles','Harry Styles']);
  assert.equal(second.hasMore,false);
  assert.equal(first.hasMore,false,'a sparse artist top page must not imply infinite pagination');
});

test('the listening-room invitation encourages discovering artists and has a working action',async()=>{
  const page=createViews({state:createInitialState(),catalog:[],current:null,allGenres:['all'],
    challengeIds:[],challengeResponses:[],catalogWarning:'',catalogLive:true,
    collectionQuery:'',collectionSort:'recent'}).renderDiscovery();
  assert.match(page,/The more different artists you/);
  assert.match(page,/data-action="focus-music-search"/);
  const js=await readFile(new URL('../app/public/main.js',import.meta.url),'utf8');
  assert.match(js,/case 'focus-music-search'/);
  assert.match(js,/input\.focus\(\{preventScroll:true\}\)/);
});

test('Music Duels has no oversized trophy header or trophy emoji',()=>{
  const page=renderDuels({tournaments:[],selectedId:null,catalog:[],favorites:[]});
  assert.doesNotMatch(page,/duels-header-emblem|🏆/);
  assert.match(page,/Make a little/);
});
