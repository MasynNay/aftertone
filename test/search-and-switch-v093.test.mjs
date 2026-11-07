import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fetchDeezerPage } from '../app/src/deezer.mjs';
import { selectRouteQueue, isActiveRequest } from '../app/src/discovery/route-session.mjs';
import { planDiscoveryRequest } from '../app/src/discovery/mode-engine.mjs';
import { createServer } from '../app/server.mjs';

const t=(id,artist='Harry Styles',title='Satellite')=>({id,title,artist:{name:artist},readable:true,duration:213,rank:500000,
  album:{cover_big:'https://cdn.example.com/album.jpg'},preview:`https://cdnt-preview.dzcdn.net/${id}.mp3`});
const response = data => ({ok:true,json:async()=>({data,total:data.length,next:data.length===25?'https://api.deezer.com/more':null})});
const path = id => `deezer:${id}`;

/** A mock service that behaves like Deezer's independent artist + top endpoints. */
function deezerFixture(calls, {artist='Harry Styles',artistId=42,emptyTop=false,unrelated=false}={}) {
  return async url=>{
    const u=new URL(url);calls.push(u);
    if(u.pathname==='/search/artist')return response([{id:artistId,name:unrelated?'Some Other Band':artist}]);
    if(u.pathname===`/artist/${artistId}/top`)return response(emptyTop?[]:[t(1001,artist)]);
    if(u.pathname==='/search')return response([t(1001,artist),t(1002,'A Different Singer','Covers'),t(1003,artist,'Watermelon Sugar')]);
    if(u.pathname==='/chart/0/tracks')return response([t(2001,'Billie Eilish','bad guy')]);
    throw new Error(`Unexpected mock endpoint: ${u.pathname}`);
  };
}

test('artist-name searches resolve an exact artist, then its real top-track listing',async()=>{
  const calls=[],rows=await fetchDeezerPage('all','0',deezerFixture(calls),'Harry Styles');
  assert.deepEqual(calls.map(c=>c.pathname),['/search/artist','/artist/42/top']);
  assert.deepEqual(rows.tracks.map(track=>track.title),['Satellite']);
  assert.equal(rows.tracks[0].artist,'Harry Styles');
});

test('search/artist near-matches are not accepted as the requested performer',async()=>{
  const calls=[],data=await fetchDeezerPage('all','0',deezerFixture(calls,{unrelated:true}),'Harry Styles');
  assert.equal(calls.at(-1).pathname,'/search');
  assert.ok(!calls.some(c=>c.pathname.includes('/top')));
  assert.deepEqual(data.tracks.map(track=>track.artist),['Harry Styles','A Different Singer','Harry Styles'],
    'manual queries can search songs, not just force artist matches');
});

test('an empty artist top list falls back to ordinary ranked search',async()=>{
  const calls=[],data=await fetchDeezerPage('all','0',deezerFixture(calls,{emptyTop:true}),'Harry Styles');
  assert.deepEqual(calls.map(c=>c.pathname),['/search/artist','/artist/42/top','/search']);
  assert.equal(data.tracks.length,2,'cover recordings are filtered even in fallback search');
});

test('title searches remain normal track searches',async()=>{
  const calls=[],data=await fetchDeezerPage('all','0',deezerFixture(calls,{unrelated:true}),'Watermelon Sugar');
  assert.equal(calls.at(-1).pathname,'/search');
  assert.ok(data.tracks.some(track=>track.title==='Watermelon Sugar'));
});

test('verified artist seed pages use separate top-track offsets',async()=>{
  const calls=[];
  const fetcher=async url=>{
    const u=new URL(url);calls.push(u);
    if(u.pathname==='/search/artist')return response([{id:42,name:'Harry Styles'}]);
    const index=Number(u.searchParams.get('index'));
    return response(Array.from({length:25},(_,i)=>t(1000+index+i)));
  };
  const a=await fetchDeezerPage('all','0',fetcher,'','all','any','Harry Styles');
  const b=await fetchDeezerPage('all','1',fetcher,'','all','any','Harry Styles');
  assert.deepEqual(calls.filter(c=>c.pathname.endsWith('/top')).map(c=>c.searchParams.get('index')),['0','25']);
  assert.notEqual(a.tracks[0].id,b.tracks[0].id);
  assert.equal(a.hasMore,true);
});

test('distinct modes fetch distinct artist/genre origins on their first request',()=>{
  const history=[{artist:'Harry Styles',action:'like',genre:'pop'}];
  const liked=[{artist:'Harry Styles'}];
  const related=[{artist:'Niall Horan',because:'Harry Styles'}];
  const args={requestNumber:0,liked,related,history};
  const comfort=planDiscoveryRequest({...args,mode:'familiar'});
  const territory=planDiscoveryRequest({...args,mode:'balanced'});
  const wild=planDiscoveryRequest({...args,mode:'explore'});
  assert.deepEqual([comfort.kind,comfort.lane.artist],['liked','Harry Styles']);
  assert.deepEqual([territory.kind,territory.lane.artist],['related','Niall Horan']);
  assert.equal(wild.kind,'wild');
  assert.notEqual(wild.genre,'pop');
});

test('fresh modes show a loading state rather than instantly recycling a previously loaded track',()=>{
  const pool=[{id:path(11),artist:'Harry Styles'},{id:path(12),artist:'Billie Eilish'}];
  assert.equal(selectRouteQueue({pool,feedIds:new Set(),primed:false,mode:'explore'}).tracks.length,0);
  assert.equal(selectRouteQueue({pool,feedIds:new Set(),primed:false,loading:true,mode:'explore'}).origin,'loading');
});

test('on first successful path fetch, the queue uses that mode’s IDs rather than shared results',()=>{
  const pool=[{id:path(11),artist:'Harry Styles'},{id:path(12),artist:'Billie Eilish'},{id:path(13),artist:'Niall Horan'},
    {id:path(14),artist:'Yaeji'}];
  const context={history:[{action:'like',artist:'Harry Styles'}],related:[{artist:'Niall Horan'}],seeds:['Harry Styles']};
  const comfort=selectRouteQueue({pool,feedIds:new Set([path(11)]),primed:true,mode:'familiar',context});
  const territory=selectRouteQueue({pool,feedIds:new Set([path(13)]),primed:true,mode:'balanced',context});
  const wildcard=selectRouteQueue({pool,feedIds:new Set([path(14)]),primed:true,mode:'explore',context});
  assert.deepEqual([comfort.tracks[0].artist,territory.tracks[0].artist,wildcard.tracks[0].artist],
    ['Harry Styles','Niall Horan','Yaeji']);
  assert.ok([comfort,territory,wildcard].every(v=>v.origin==='path'));
});

test('temporary provider outages can fall back after a route really finished trying',()=>{
  const pool=[{id:path(21),artist:'Ava Max'}];
  const result=selectRouteQueue({pool,feedIds:new Set(),primed:true,loading:false,mode:'familiar'});
  assert.equal(result.origin,'fallback');
  assert.equal(result.tracks[0].artist,'Ava Max');
  assert.match(result.reason,/needs more matching tracks/);
  assert.deepEqual(selectRouteQueue({pool,feedIds:new Set(),primed:true,loading:true}).tracks,[]);
});

test('search result isolation is enforced before and after a mode switch',()=>{
  const pool=[{id:path(7),artist:'Harry Styles'},{id:path(8),artist:'Other'}];
  const result=selectRouteQueue({pool,feedIds:new Set([path(7)]),primed:true,searching:true,mode:'explore'});
  assert.deepEqual(result.tracks.map(track=>track.artist),['Harry Styles']);
});

test('a stale outgoing mode cannot overwrite the active mode’s card',()=>{
  const old={};const next={};
  assert.equal(isActiveRequest(old,old),true);
  assert.equal(isActiveRequest(old,next),false);
  assert.equal(isActiveRequest(next,next),true);
});

test('UI changes mode before choosing a new card, and the new feed is primed first',async()=>{
  const app=await readFile(new URL('../app/public/main.js',import.meta.url),'utf8');
  assert.match(app,/if\(feed\.primed\) chooseNext\(\);/);
  assert.match(app,/if\(!feed\.primed \|\| !availableCount\(state\.genre\)\) void loadMore/);
  assert.match(app,/isActiveRequest\(feed,getFeed\(genre\)\)/);
  assert.match(app,/const requestSearch=searchQuery/);
});

test('HTTP discovery supports no-key exact artist search through the new catalog adapter',async()=>{
  const calls=[],server=createServer({fetcher:deezerFixture(calls)});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const base=`http://127.0.0.1:${server.address().port}`;
    const reply=await fetch(`${base}/api/discover?source=deezer&q=Harry%20Styles`);
    assert.equal(reply.status,200);
    const payload=await reply.json();
    assert.equal(payload.tracks[0].title,'Satellite');
    assert.equal(payload.tracks[0].artist,'Harry Styles');
    assert.ok(calls.some(c=>c.pathname==='/artist/42/top'));
  } finally {await new Promise(resolve=>server.close(resolve));}
});

test('switching discovery paths exits an active artist search rather than reusing its song results',async()=>{
  const app=await readFile(new URL('../app/public/main.js',import.meta.url),'utf8');
  const block=app.slice(app.indexOf('function changeDiscoveryPath('),app.indexOf('function goTo(',app.indexOf('function changeDiscoveryPath(')));
  assert.match(block,/const wasSearching=Boolean\(searchQuery\)/);
  assert.match(block,/searchQuery=''; searchDraft='';/);
  assert.match(block,/state\.discoveryMix=mode/);
  assert.match(block,/const feed=getFeed\(\)/);
});
