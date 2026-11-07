import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchDeezerPage, normalizeDeezerTrack } from '../src/deezer.mjs';
import { createServer } from '../server.mjs';
import { createInitialState, recordChoice } from '../src/taste.mjs';
import { sanitizeState } from '../src/persistence.mjs';
import { createViews } from '../public/views.js';

const row=(id,title='bad guy',artist='Billie Eilish')=>({id,title,title_short:title,readable:true,
  artist:{name:artist,id:7}, album:{cover_big:`https://e-cdns-images.dzcdn.net/images/cover/${id}/500x500.jpg`},
  duration:195,rank:490000,preview:`https://cdnt-preview.dzcdn.net/api/1/1/${id}.mp3`,link:`https://www.deezer.com/track/${id}`});
function fakeDeezer(requested=[],shouldFail=false) {
 return async (url,opts={})=>{
   const u=new URL(url);requested.push(u);
   assert.equal(u.hostname,'api.deezer.com');
   assert.ok(!u.searchParams.has('api_key'));
   if(shouldFail) return {ok:false,status:503};
   if (/^\/track\/\d+$/.test(u.pathname)) return {ok:true,json:async()=>row(Number(u.pathname.split('/').pop()))};
   if (u.pathname==='/search/artist') { const name=u.searchParams.get('q'); return {ok:true,json:async()=>({data:[{id:501,name}],total:1})}; }
   if (u.pathname==='/artist/501/top') { const name=requested.filter(v=>v.pathname==='/search/artist').at(-1)?.searchParams.get('q')||'Charlie Puth'; return {ok:true,json:async()=>({data:[row(102,'How Long',name)],total:1})}; }
   const rows=u.pathname.includes('chart') ? [row(101),row(102,'How Long','Charlie Puth')] :
     u.searchParams.get('q')?.includes('Charlie Puth') ? [row(102,'How Long','Charlie Puth'), row(900,'How Long cover','A Different Singer')] :
     [row(101)];
   return {ok:true,json:async()=>({data:rows,total:400,next:'https://api.deezer.com/search?index=25'})};
 };
}

test('official Deezer metadata preserves recognizable artist, song title and real album artwork',()=>{
 const t=normalizeDeezerTrack(row(101));
 assert.equal(t.id,'deezer:101');assert.equal(t.artist,'Billie Eilish');assert.equal(t.title,'bad guy');
 assert.match(t.artwork,/e-cdns-images\.dzcdn\.net/);assert.equal(t.link,'https://www.deezer.com/track/101');
 assert.equal(t.source,'deezer');assert.equal('audio' in t,false);
 assert.equal(normalizeDeezerTrack(row(100,'How Long cover','Cover Singer')),null);
 assert.equal(normalizeDeezerTrack(row(103,'How Long','Cover Singer'),{artist:'Charlie Puth'}),null);
 assert.equal(normalizeDeezerTrack({...row(104),readable:false}),null);
});

test('no-key catalog starts with global chart music, then switches to established artist lanes',async()=>{
 const calls=[],fetcher=fakeDeezer(calls);
 const first=await fetchDeezerPage('all','0',fetcher);
 assert.equal(first.tracks.length,2);assert.equal(first.tracks[0].artist,'Billie Eilish');
 assert.equal(first.nextCursor,'1');assert.equal(calls[0].pathname,'/chart/0/tracks');
 const fourth=await fetchDeezerPage('all','3',fetcher);
 assert.ok(calls.some(u=>u.pathname==='/search/artist'));
 assert.ok(calls.at(-1).pathname==='/artist/501/top');
 assert.equal(fourth.provider,'deezer');
});

test('search accepts user supplied artist without breaking into unrelated uploads',async()=>{
 const calls=[];const p=await fetchDeezerPage('all','0',fakeDeezer(calls),'Charlie Puth');
 assert.deepEqual(p.tracks.map(x=>`${x.artist} - ${x.title}`),['Charlie Puth - How Long']);
 assert.equal(calls[0].pathname,'/search/artist');
 assert.equal(calls[0].searchParams.get('q'),'Charlie Puth');
 assert.equal(p.tracks[0].artwork!==null,true);
});

test('English artist lanes and Spanish artist lanes work without pretending vocal metadata is verified',async()=>{
 const calls=[];const fetcher=fakeDeezer(calls);
 const english=await fetchDeezerPage('pop','0',fetcher,'','en');
 assert.equal(english.provider,'deezer');
 assert.equal(calls.at(-1).pathname,'/artist/501/top');
 assert.equal(english.tracks.every(t=>t.language==='unknown'),true);
 await fetchDeezerPage('pop','0',fetcher,'','es');
 assert.match(calls.filter(u=>u.pathname==='/search/artist').at(-1).searchParams.get('q'),/Shakira|ROSAL|Bad Bunny|Karol|Enrique|J Balvin/i);
});

test('API serves Deezer by default, never silently falls back to Commons, and needs no API key',async()=>{
 const calls=[],server=createServer({fetcher:fakeDeezer(calls)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try {
   const base=`http://127.0.0.1:${server.address().port}`;
   const c=await (await fetch(`${base}/api/catalog`)).json();
   assert.equal(c.provider,'deezer');assert.ok(c.providers.includes('deezer'));
   const r=await fetch(`${base}/api/discover?genre=all`);
   assert.equal(r.status,200);
   const d=await r.json();assert.ok(d.tracks.some(t=>t.title==='bad guy'));
   assert.ok(d.tracks.every(t=>t.source==='deezer'));
   assert.ok(calls.every(c=>c.hostname==='api.deezer.com'));
 } finally {await new Promise(resolve=>server.close(resolve));}
 const failure=createServer({fetcher:fakeDeezer([],true)});
 await new Promise(resolve=>failure.listen(0,'127.0.0.1',resolve));
 try {
   const r=await fetch(`http://127.0.0.1:${failure.address().port}/api/discover?source=deezer&q=force-outage-different-cache-key`);
   assert.equal(r.status,502);assert.match((await r.json()).error,/Deezer/i);
 } finally {await new Promise(resolve=>failure.close(resolve));}
});

test('Deezer favorites survive hydration and the new source is displayed beside the song art',()=>{
 const t=normalizeDeezerTrack(row(101));
 let state={...createInitialState(),source:'deezer'};
 state=recordChoice(state,{id:t.id,action:'like',artist:t.artist,genre:t.genre});
 state=sanitizeState({...state,savedTracks:[t]});
 assert.equal(state.savedTracks[0].artist,'Billie Eilish');assert.deepEqual(state.favorites,[t.id]);
 const pages=createViews({state,catalog:[t],current:t,allGenres:['all','pop'],challengeIds:[],challengeResponses:[],catalogWarning:'',catalogLive:true,collectionQuery:'',collectionSort:'recent',feed:{available:1,hasMore:true},availableSources:['deezer']});
 const ui=pages.renderDiscovery();
 assert.match(ui,/<span class="track-source-chip">DEEZER<\/span>/);assert.match(ui,/Billie Eilish/);
 assert.doesNotMatch(pages.renderSidebarPreferences(), /toggle-originals/);
 assert.match(ui,/22-second listening preview/);
});
