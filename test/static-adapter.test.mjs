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


test('aborting a browser discovery cancels its JSONP callback instead of reporting a provider error', async()=>{
  const previousCreate=document.createElement;
  const previousAppend=document.head.append;
  const waiting=[];
  let removed=0;
  document.createElement=()=>({remove(){removed++;},async:false});
  document.head.append=(script)=>waiting.push(script);
  try {
    const controller=new AbortController();
    const pending=apiFetch('/api/discover?source=deezer&genre=all&cursor=0',{signal:controller.signal});
    assert.equal(waiting.length,1,'The mocked Deezer chart request must still be in flight');
    const script=waiting[0];
    const callback=new URL(script.src).searchParams.get('callback');
    assert.equal(typeof globalThis[callback],'function');
    controller.abort();
    await assert.rejects(pending,(error)=>error?.name==='AbortError',
      'A canceled request must reject with AbortError, not resolve to a 502');
    assert.equal(removed,1,'Canceled JSONP scripts must be removed');
    assert.equal(typeof globalThis[callback],'function',
      'Canceled scripts need a temporary inert callback for late execution');
    assert.doesNotThrow(()=>globalThis[callback]({data:rows}),
      'Late JSONP must not cause a browser exception');
    assert.equal(typeof globalThis[callback],'function',
      'The canceled callback should remain inert until its bounded expiry');
  } finally {
    document.createElement=previousCreate;
    document.head.append=previousAppend;
  }
  const {response,payload}=await result('/api/discover?source=deezer&genre=all&cursor=0');
  assert.equal(response.status,200,'A later healthy request must still succeed');
  assert.equal(payload.tracks.length,25);
});

test('aborting during Deezer artist resolution does not start fallback catalog requests',async()=>{
  const previousAppend=document.head.append;
  const waiting=[];
  document.head.append=(script)=>waiting.push(script);
  try {
    const controller=new AbortController();
    const pending=apiFetch('/api/discover?source=deezer&q=Unfinished%20Artist',{signal:controller.signal});
    assert.equal(waiting.length,1);
    assert.match(new URL(waiting[0].src).pathname,/search\/artist/);
    controller.abort();
    await assert.rejects(pending,(error)=>error?.name==='AbortError');
    assert.equal(waiting.length,1,'An aborted artist lookup must not launch a fallback search');
  } finally {
    document.head.append=previousAppend;
  }
});


test('timed-out JSONP leaves a short-lived inert callback rather than crashing late scripts',async()=>{
  const previousAppend=document.head.append;
  const pendingScripts=[];
  document.head.append=(script)=>pendingScripts.push(script);
  try {
    const failure=deezerJSONP('https://api.deezer.com/search',{timeoutMs:1});
    await assert.rejects(failure,/did not respond/);
    assert.equal(pendingScripts.length,1);
    const callback=new URL(pendingScripts[0].src).searchParams.get('callback');
    assert.equal(typeof globalThis[callback],'function');
    assert.doesNotThrow(()=>globalThis[callback]({data:rows}),
      'A tardy timeout response must not raise an uncaught exception');
  } finally {
    document.head.append=previousAppend;
  }
});

test('callback tombstone lifetime and count are bounded, and valid data cleans up immediately',async()=>{
  const source=(await import('node:fs')).readFileSync(
    new URL('../app/src/static-adapter.mjs',import.meta.url),'utf8');
  assert.match(source,/const RETIRED_JSONP_MS=15000/);
  assert.match(source,/const MAX_RETIRED_JSONP=48/);
  assert.match(source,/while \(retiredJSONP\.size>MAX_RETIRED_JSONP\)/);
  assert.match(source,/setTimeout\(\(\)=>discardRetiredJSONP\(name\),RETIRED_JSONP_MS\)/);
  assert.match(source,/entry\.scope\[name\]===entry\.ignore/);
  const previousAppend=document.head.append;
  let normalCallback;
  document.head.append=script=>{
    normalCallback=new URL(script.src).searchParams.get('callback');
    queueMicrotask(()=>globalThis[normalCallback]?.(reply(script.src)));
  };
  try {
    const response=await apiFetch('/api/discover?source=deezer&genre=all&cursor=0');
    assert.equal(response.status,200);
    assert.equal(globalThis[normalCallback],undefined,
      'A normally completed callback should not leave a tombstone');
  } finally {
    document.head.append=previousAppend;
  }
});
