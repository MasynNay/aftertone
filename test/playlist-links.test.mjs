import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePlaylistLink, importPlaylistLink} from '../src/playlist-links.mjs';
import {createServer} from '../server.mjs';
import {createViews} from '../public/views.js';
import {createInitialState} from '../src/taste.mjs';
import {chooseListeningLane,DISCOVERY_MIXES} from '../src/discovery/rotation.mjs';

test('playlist link parser only accepts HTTPS Deezer and Spotify playlist paths',()=>{
  assert.deepEqual(parsePlaylistLink('https://www.deezer.com/en/playlist/12345678?utm_source=share'),{provider:'deezer',id:'12345678'});
  assert.deepEqual(parsePlaylistLink('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc'),{provider:'spotify',id:'37i9dQZF1DXcBWIGoYBM5M'});
  for (const url of ['http://deezer.com/playlist/12','https://evil.test/playlist/12','https://deezer.com/track/12','https://deezer.com@evil.test/playlist/12','https://deezer.com:8080/playlist/12'])
    assert.throws(()=>parsePlaylistLink(url));
});

test('public Deezer playlist pages import canonical songs, dedupe and never fetch an untrusted URL',async()=>{
  const calls=[];
  const fetcher=async (raw)=>{
    const url=new URL(raw);calls.push(url);
    assert.equal(url.hostname,'api.deezer.com');
    if(url.pathname==='/playlist/2468')return {ok:true,json:async()=>({title:'Roadtrip',nb_tracks:3})};
    const index=Number(url.searchParams.get('index'));
    if(index===0) return {ok:true,json:async()=>({data:[
      {title:'How Long',artist:{name:'Charlie Puth'}},
      {title:'Levitating',artist:{name:'Dua Lipa'}},
      {title:'How Long',artist:{name:'Charlie Puth'}}
    ]})};
    return {ok:true,json:async()=>({data:[]})};
  };
  const result=await importPlaylistLink('https://www.deezer.com/playlist/2468',fetcher);
  assert.equal(result.count,2);
  assert.equal(result.playlistTitle,'Roadtrip');
  assert.deepEqual(result.tracks[0],{artist:'Charlie Puth',title:'How Long'});
  assert.equal(calls.length,2);
});

test('Spotify playlist URLs fail transparently rather than manufacturing metadata',async()=>{
  const url='https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M';
  await assert.rejects(importPlaylistLink(url,()=>{throw Error('should never fetch');}),/Spotify link recognized/);
});

test('playlist link HTTP endpoint supplies songs and honest Spotify status',async()=>{
  const fetcher=async u=>({ok:true,json:async()=> new URL(u).pathname.includes('/tracks') ? {data:[{artist:{name:'Muse'},title:'Starlight'}]} : {title:'Rock',nb_tracks:1}});
  const server=createServer({fetcher});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{
    const base=`http://127.0.0.1:${server.address().port}`;
    const hit=await fetch(base+'/api/playlist-link?url='+encodeURIComponent('https://deezer.com/playlist/112233'));
    assert.equal(hit.status,200);assert.equal((await hit.json()).tracks[0].artist,'Muse');
    const no=await fetch(base+'/api/playlist-link?url='+encodeURIComponent('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M'));
    assert.equal(no.status,422);assert.match((await no.json()).error,/authorized/i);
  }finally{await new Promise(r=>server.close(r));}
});

test('heart and X controls appear INSIDE the listening card for mouse and keyboard users',()=>{
  const track={id:'deezer:123',source:'deezer',artist:'Dua Lipa',title:'Levitating',genre:'pop',mood:'Bright'};
  const markup=createViews({state:createInitialState(),catalog:[track],current:track,allGenres:['all'],challengeIds:[],challengeResponses:[],catalogWarning:'',catalogLive:true,collectionQuery:'',collectionSort:''}).renderDiscovery();
  const start=markup.indexOf('id="listening-card"');
  const end=markup.indexOf('class="player-shortcuts"',start);
  assert.ok(start>0 && end>start);
  assert.match(markup.slice(start,end),/data-action="pass"/);
  assert.match(markup.slice(start,end),/data-action="like"/);
  assert.match(markup.slice(start,end),/aria-label="Keep this song in my favorites"/);
  assert.match(markup.slice(start,end),/data-action="undo"/);
});

test('balanced and adventurous do not schedule any starter artist repeats',()=>{
  for(const mode of ['balanced','explore']){
    assert.ok(DISCOVERY_MIXES[mode].every(slot=>slot!=='favorite'));
    assert.equal(Array.from({length:10},(_,i)=>chooseListeningLane(i,mode,['favorite','related','broad'])).filter(x=>x==='favorite').length,0);
  }
});
