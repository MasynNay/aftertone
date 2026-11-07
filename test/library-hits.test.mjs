import test from 'node:test';
import assert from 'node:assert/strict';
import { sameArtistAndSong, parseLibraryHitsCursor, matchOwnRecording, fetchAdFreeHitsPage } from '../app/src/library-hits.mjs';
import { createServer } from '../app/server.mjs';
import { createInitialState } from '../app/src/taste.mjs';
import { sanitizeState } from '../app/src/persistence.mjs';
import { createViews } from '../app/public/views.js';

const songId='c'.repeat(32);
const billieId='d'.repeat(32);
const serverConfig={base:'https://my-jellyfin.example', token:'EXAMPLE_TEST_SECRET_abcdef', userId:null};
const rows=Array.from({length:16},(_,i)=>({artist_name:i===0?'Charlie Puth':i===1?'Billie Eilish':`Unknown Artist ${i}`,
  track_name:i===0?'How Long':i===1?'bad guy':`Random song ${i}`,listen_count:5000-i}));
const requested=[];
function testFetch(url, options={}) {
  const uri=new URL(url);requested.push({url:uri,headers:options.headers||{}});
  if(uri.hostname==='api.listenbrainz.org') return Promise.resolve({ok:true,json:async()=>({payload:{recordings:rows}})});
  if(uri.hostname==='my-jellyfin.example' && uri.pathname.endsWith('/Items')) {
    const name=uri.searchParams.get('SearchTerm');
    const tracks = name==='How Long' ? [
      {Id:'f'.repeat(32),Type:'Audio', Name:'How Long',Artists:['Cover Singer'],Genres:['Pop'], RunTimeTicks:1800000000},
      {Id:songId,Type:'Audio',Name:'How Long',Artists:['Charlie Puth'],Genres:['Pop'],RunTimeTicks:1900000000,AlbumId:'e'.repeat(32)},
    ] : name==='bad guy' ? [
      {Id:billieId,Type:'Audio',Name:'bad guy',Artists:['Billie Eilish'],Genres:['Pop'],RunTimeTicks:1800000000},
    ] : [];
    return Promise.resolve({ok:true,json:async()=>({Items:tracks})});
  }
  if(uri.hostname==='my-jellyfin.example' && uri.pathname.endsWith('/stream')) {
    return Promise.resolve(new Response(new Uint8Array([1,2,3,4]),{status:200,headers:{'Content-Type':'audio/mpeg'}}));
  }
  throw new Error('Unexpected network request '+uri);
}

test('strict matching rejects covers and inaccurate song identities',()=>{
  assert.ok(sameArtistAndSong({artist:'Charlie Puth',title:'How Long'},{artist:'Charlie Puth',title:'How Long'}));
  assert.ok(sameArtistAndSong({artist:'Billie Eilish',title:'bad guy'},{artist:'Billie Eilish',title:'bad guy'}));
  assert.ok(!sameArtistAndSong({artist:'Cover Singer',title:'How Long'},{artist:'Charlie Puth',title:'How Long'}));
  assert.ok(!sameArtistAndSong({artist:'Charlie Puth',title:'How Long (Karaoke)'},{artist:'Charlie Puth',title:'How Long'}));
  assert.ok(!sameArtistAndSong({artist:'Charlie Puth',title:'Attention'},{artist:'Charlie Puth',title:'How Long'}));
  assert.equal(parseLibraryHitsCursor('16'),16);
  assert.throws(()=>parseLibraryHitsCursor('17'),/cursor/i);
  assert.throws(()=>parseLibraryHitsCursor('https://evil'),/cursor/i);
});

test('ranked identities map only onto user-owned Jellyfin audio, never YouTube streams',async()=>{
  requested.length=0;
  const match=await matchOwnRecording(serverConfig,{artist:'Charlie Puth',title:'How Long',origin:'Chart'},testFetch,'pop');
  assert.equal(match.id,`jellyfin:${songId}`);
  assert.equal(match.artist,'Charlie Puth');
  assert.equal(match.title,'How Long');
  assert.ok(match.artwork.startsWith('/api/jellyfin-art?id='));
  assert.equal(match.source,'jellyfin');
  assert.equal(match.originalCandidate,true);
  assert.ok(requested.every(row => row.url.hostname === 'my-jellyfin.example'));
  assert.ok(requested.every(row => !row.url.href.includes(serverConfig.token)));
  assert.ok(requested[0].headers.Authorization.includes(serverConfig.token));
});

test('new hits source paginates chart music and only includes matched local songs',async()=>{
  requested.length=0;
  const page=await fetchAdFreeHitsPage(serverConfig,'all','0',testFetch);
  const names=page.tracks.map(t=>t.artist+' — '+t.title);
  assert.ok(names.includes('Charlie Puth — How Long'));
  assert.ok(names.includes('Billie Eilish — bad guy'));
  assert.ok(page.tracks.every(t=>t.source==='jellyfin'));
  assert.equal(page.nextCursor,'16');
  assert.equal(page.hasMore,true);
  assert.ok(requested.some(row=>row.url.hostname==='api.listenbrainz.org'));
  assert.ok(requested.every(row=>row.url.hostname!=='www.googleapis.com'));
});

test('server exposes ad-free source only when Jellyfin is connected; never leaks API key',async()=>{
  const old={JELLYFIN_URL:process.env.JELLYFIN_URL,JELLYFIN_API_KEY:process.env.JELLYFIN_API_KEY,JELLYFIN_USER_ID:process.env.JELLYFIN_USER_ID};
  process.env.JELLYFIN_URL='https://my-jellyfin.example';
  process.env.JELLYFIN_API_KEY=serverConfig.token;
  delete process.env.JELLYFIN_USER_ID;
  const server=createServer({fetcher:testFetch});
  try {
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const base=`http://127.0.0.1:${server.address().port}`;
    const catalog=await (await fetch(base+'/api/catalog')).json();
    assert.ok(catalog.providers.includes('library-hits'));
    assert.ok(!JSON.stringify(catalog).includes(serverConfig.token));
    const response=await fetch(base+'/api/discover?source=library-hits&genre=all&cursor=0&language=all');
    assert.equal(response.status,200);
    const body=await response.json();
    assert.ok(body.tracks.length>0);
    assert.ok(body.tracks.every(t=>t.source==='jellyfin' && !('audio' in t)));
    assert.ok(!JSON.stringify(body).includes(serverConfig.token));
    const audio=await (await fetch(base+`/api/audio?id=jellyfin:${songId}`)).json();
    assert.equal(audio.url,`/api/jellyfin-stream?id=${songId}`);
    const stream=await fetch(base+audio.url);
    assert.equal(stream.status,200);
    assert.equal(stream.headers.get('content-type'),'audio/mpeg');
    assert.deepEqual([...new Uint8Array(await stream.arrayBuffer())],[1,2,3,4]);
  } finally {
    await new Promise(resolve=>server.close(resolve));
    for(const [key,val] of Object.entries(old)) {if(val===undefined) delete process.env[key]; else process.env[key]=val;}
  }
});

test('ad-free library-hits choice persists and UI discloses the Jellyfin requirement',()=>{
  const state={...createInitialState(),source:'library-hits',genre:'all',language:'all'};
  assert.equal(sanitizeState(state).source,'library-hits');
  const template=createViews({state,catalog:[],current:null,allGenres:['all','pop'],challengeIds:[],challengeResponses:[],catalogWarning:'',catalogLive:true,collectionQuery:'',collectionSort:'recent',feed:{hasMore:true,available:0},availableSources:['library-hits','jellyfin','featured']}).renderDiscovery();
  assert.doesNotMatch(template,/Popular hits from my library/);
  assert.doesNotMatch(template,/Jellyfin server/); // source and setup prompts retired from discovery
});
