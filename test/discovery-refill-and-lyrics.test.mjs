import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldRefill,REFILL_INTERVAL_MS,REFILL_TARGET} from '../app/src/discovery/auto-refill.mjs';
import {parseLrc,lineAt,lookupLyrics} from '../app/src/lyrics.mjs';
test('refill checks every three seconds but stops at a bounded ready queue',()=>{
 assert.equal(REFILL_INTERVAL_MS,3000);
 assert.equal(shouldRefill({ready:REFILL_TARGET-1,loaded:200}),true);
 assert.equal(shouldRefill({ready:REFILL_TARGET,loaded:200}),false);
 assert.equal(shouldRefill({ready:2,loaded:1500}),false);
 assert.equal(shouldRefill({ready:2,loading:true}),false);
 assert.equal(shouldRefill({ready:2,visible:false}),false);
 assert.equal(shouldRefill({ready:2,hasMore:false}),false);
});
test('LRC parser reads multiple time tags and offset highlights correct line',()=>{
 const lines=parseLrc('[00:10.15][00:20.00] A chorus\n[01:02.50] A verse');
 assert.equal(lines.length,3);
 assert.equal(lineAt(lines,4.5,16)?.text,'A chorus');
 assert.equal(lineAt(lines,10,52.5)?.text,'A verse');
 assert.equal(lineAt(lines,1,0),null);
});
test('lyrics only match exact artist/title and never claim a synced line for wrong singer',async()=>{
 const fake=async()=>({ok:true,status:200,json:async()=>({artistName:'Cover Singer',trackName:'Hello',syncedLyrics:'[00:10.00] Not the right one'})});
 const result=await lookupLyrics({artist:'Adele',title:'Hello'},fake);
 assert.equal(result.status,'unavailable');
 assert.equal(result.lines.length,0);
});

import {normalizeDeezerTrack} from '../app/src/deezer.mjs';
import {computeTaste} from '../app/src/taste.mjs';
test('unlabeled Deezer charts do not pretend every artist is Pop',()=>{
 const song=normalizeDeezerTrack({id:1980,title:'Example Song',readable:true,duration:205,preview:'https://cdn-preview.dzcdn.net/audio.mp3',artist:{name:'Jazz Artist'},album:{}});
 assert.equal(song.genre,'unknown');
 const taste=computeTaste([{id:song.id,action:'like',genre:song.genre}], [song]);
 assert.deepEqual(taste.genres,[]);
});

import {createServer} from '../app/server.mjs';
test('local lyrics endpoint uses exact artist metadata and never bundles lines',async()=>{
  const urls=[];
  const fake=async url=>{
    const u=new URL(url);urls.push(u);
    assert.equal(u.host,'lrclib.net');
    assert.equal(u.pathname,'/api/get');
    return {ok:true,status:200,json:async()=>({artistName:'Unique Musician',trackName:'Unique Song',duration:200,syncedLyrics:'[00:30.00] A sample line'})};
  };
  const server=createServer({fetcher:fake});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const port=server.address().port;
    const no=await fetch(`http://127.0.0.1:${port}/api/lyrics`);
    assert.equal(no.status,400);
    const yes=await fetch(`http://127.0.0.1:${port}/api/lyrics?artist=Unique%20Musician&title=Unique%20Song&duration=200`);
    const data=await yes.json();
    assert.equal(data.status,'available');
    assert.equal(data.lines[0].time,30);
    assert.equal(urls.length,1);
  }finally {await new Promise(resolve=>server.close(resolve));}
});


// Cancellation must not masquerade as "lyrics unavailable" in the cache.
// All artist names and lyric lines in this test are fictional fixtures.
test('an abandoned timed-lyrics fetch aborts and a later request can retry',async()=>{
 const track={artist:'Fixture Cancellation Singer',title:'Fixture Cancelled Tune',duration:173};
 const controller=new AbortController();
 let started;
 const entered=new Promise(resolve=>{started=resolve;});
 const pending=lookupLyrics(track,(_url,{signal})=>new Promise((_resolve,reject)=>{
   started(signal);
   signal.addEventListener('abort',()=>reject(new DOMException('Stopped','AbortError')),{once:true});
 }),undefined,{signal:controller.signal});
 const activeSignal=await entered;
 assert.equal(activeSignal.aborted,false);
 controller.abort();
 await assert.rejects(pending,error=>error?.name==='AbortError');
 assert.equal(activeSignal.aborted,true);
 let called=0;
 const response=await lookupLyrics(track,async()=>{
   called++;
   return {ok:true,status:200,json:async()=>({
     artistName:track.artist,trackName:track.title,
     syncedLyrics:'[00:03.00] A fictional line',duration:track.duration
   })};
 });
 assert.equal(called,1,'An aborted request must not be saved in the error cache');
 assert.equal(response.status,'available');
 assert.equal(response.lines[0].text,'A fictional line');
});

test('an already-aborted lyric lookup never calls its provider',async()=>{
 const controller=new AbortController();
 controller.abort();
 let calls=0;
 await assert.rejects(
   lookupLyrics({artist:'Fixture Stopped Performer',title:'Fixture Silence'},
     async()=>{calls++;throw new Error('This must not be requested');},
     undefined,{signal:controller.signal}),
   error=>error?.name==='AbortError'
 );
 assert.equal(calls,0);
});

test('static lyrics route forwards abort into the lyrics provider and UI cancels on exit',async()=>{
 const {readFileSync}=await import('node:fs');
 const adapter=readFileSync(new URL('../app/src/static-adapter.mjs',import.meta.url),'utf8');
 const main=readFileSync(new URL('../app/public/main.js',import.meta.url),'utf8');
 assert.match(adapter,/lookupLyrics\([\s\S]*?\{signal:options\.signal\}\)/);
 assert.match(main,/function cancelCurrentLyrics\(\) \{[\s\S]*?lyricsController\?\.abort\(\)/);
 assert.match(main,/const response=await apiFetch\([\s\S]*?\{signal:controller\.signal\}\)/);
 assert.match(main,/if\(lyricsController && \(!lyricsEnabled \|\| view!=='discover' \|\| !current\)\) cancelCurrentLyrics\(\)/);
 assert.match(main,/if\(!lyricsEnabled\) cancelCurrentLyrics\(\)/);
});
