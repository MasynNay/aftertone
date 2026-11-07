/** Browser-facing full API contract checks with a controlled JSONP fixture.
 * These confirm mapping/validation, NOT Deezer network reachability or permission.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apiFetch,deezerJSONP} from '../app/src/static-adapter.mjs';

const rows=Array.from({length:25},(_,i)=>({
  id:100+i,title:`Demo song ${i+1}`,artist:{id:1,name:'Example Artist'},
  album:{cover_big:'https://cdn.example.com/cover.jpg'},
  duration:190,readable:true,preview:'https://cdnt-preview.dzcdn.net/sample123.mp3',rank:250-i,
}));
let invoked=[];
const reply=(url)=>{
  const u=new URL(url);
  const path=u.pathname;
  if(path.startsWith('/track/')) return {...rows[0],id:Number(path.split('/').pop())};
  if(path==='/search/artist')return {data:[{id:1,name:u.searchParams.get('q'),nb_fan:1000}]};
  if(path.endsWith('/related'))return {data:[{id:2,name:'Other Artist',nb_fan:700}]};
  if(path==='/playlist/55')return {title:'Demo List',nb_tracks:2};
  if(path==='/playlist/55/tracks')return {data:rows.slice(0,2)};
  if(path.includes('/top') || path.includes('/search') || path.includes('/chart/'))return {data:rows,total:25,next:null};
  return {error:{message:'Unsupported fixture'}};
};
globalThis.location={hostname:'aftertone.masynnay.com',port:'',href:'https://aftertone.masynnay.com/'};
globalThis.window=globalThis;
globalThis.document={
  createElement:()=>({remove(){},async:false}),
  head:{append(script){
    const u=new URL(script.src);
    invoked.push(u);
    queueMicrotask(()=>globalThis[u.searchParams.get('callback')]?.(reply(script.src)));
  }},
};

async function result(route){const response=await apiFetch(route);return {response,payload:await response.json()};}

test('public catalog retains actual original genres and Deezer provider',async()=>{
  const {response,payload}=await result('/api/catalog');
  assert.equal(response.status,200);
  assert.equal(payload.provider,'deezer');assert(payload.genres.includes('rock'));
  assert(payload.tracks.length>25);
});

test('Deezer chart fetch returns playable real-shaped records and full metadata',async()=>{
  const {response,payload}=await result('/api/discover?source=deezer&genre=all&cursor=0');
  assert.equal(response.status,200);assert.equal(payload.provider,'deezer');
  assert.equal(payload.tracks.length,25);
  assert.equal(payload.tracks[0].id,'deezer:100');
  assert(payload.tracks[0].artwork.startsWith('https://'));
  assert(invoked.some(url=>url.hostname==='api.deezer.com'&&url.searchParams.get('output')==='jsonp'));
});

test('fresh audio preview endpoint returns provider CDN URL, not synthetic audio',async()=>{
  const {response,payload}=await result('/api/audio?id=deezer%3A100');
  assert.equal(response.status,200);
  assert.equal(payload.url,'https://cdnt-preview.dzcdn.net/sample123.mp3');
  assert(payload.ttlSeconds>0);
});

test('artist discovery and related artist flow are still available',async()=>{
  const {response,payload}=await result('/api/related-artists?artist=Example%20Artist');
  assert.equal(response.status,200);assert.equal(payload.related[0].artist,'Other Artist');
});

test('Deezer playlist link imports real track metadata',async()=>{
  const {response,payload}=await result('/api/playlist-link?url=https%3A%2F%2Fwww.deezer.com%2Fplaylist%2F55');
  assert.equal(response.status,200);
  assert.equal(payload.playlistTitle,'Demo List');
  assert(payload.tracks.length===2);
});

test('rejects untrusted JSONP hosts and malformed IDs',async()=>{
  await assert.rejects(deezerJSONP('https://evil.example/steal'),/Blocked/);
  const {response}=await result('/api/audio?id=deezer%3Aabc');
  assert.equal(response.status,404);
});
