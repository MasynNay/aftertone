import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../app/server.mjs';
import {createViews} from '../app/public/views.js';
import {createInitialState} from '../app/src/taste.mjs';
import {encodeChallenge,decodeChallenge,parseDeezerChallengeIds} from '../app/src/challenge.mjs';
import {loadDeezerChallengeTracks} from '../app/src/challenge-tracks.mjs';

const item=id=>({
  id:Number(id),title:'Fixture Melody '+id,duration:205,readable:true,
  artist:{id:7,name:'Fixture Artist'},album:{cover_medium:'https://images.example.test/art.jpg'},
  preview:'https://cdn-preview.dzcdn.net/stream/fictional-'+id
});
const mockFetch=async url=>({ok:true,status:200,json:async()=>item(new URL(url).pathname.split('/').pop())});
test('public Deezer links round trip without adding personal sources or history',()=>{
  const ids=['deezer:910001','deezer:910002','deezer:910003'];
  const value=encodeChallenge(['jellyfin:private','youtube:key',...ids,ids[0]]);
  assert.equal(value,'v1.'+ids.join('~'));
  assert.deepEqual(decodeChallenge(value),ids);
  assert.deepEqual(decodeChallenge('v1.commons:original~audius:sample'),['commons:original','audius:sample']);
  assert.deepEqual(decodeChallenge('v1.deezer:910001~deezer:910001'),['deezer:910001']);
  assert.equal(encodeChallenge(['jellyfin:private']),'');
  for(const bad of ['v1.deezer:0','v1.deezer:x','v1.deezer:1~jellyfin:myfile',
    'v1.deezer:1~bad','v1.deezer:1~'.repeat(12),'',
    'v1.deezer:1'.repeat(30)])assert.deepEqual(decodeChallenge(bad),[]);
});
test('shared metadata endpoint is bounded, ordered, and never leaks preview URLs',async()=>{
  const ids='deezer:910001,deezer:910002,deezer:910003';
  const result=await loadDeezerChallengeTracks(ids,mockFetch);
  assert.deepEqual(result.tracks.map(t=>t.id),ids.split(','));
  assert.deepEqual([result.requested,result.unavailable],[3,0]);
  assert.ok(result.tracks.every(t=>t.source==='deezer'&&t.title.startsWith('Fixture Melody')));
  assert.ok(result.tracks.every(t=>!('preview' in t)&&!('audio' in t)));
});
test('missing or mismatched tracks are omitted, never replaced by another recording',async()=>{
  const result=await loadDeezerChallengeTracks('deezer:910001,deezer:910002,deezer:910003',
    async url=>{
      const id=new URL(url).pathname.split('/').pop();
      if(id==='910002')throw new Error('Deezer busy');
      return {ok:true,json:async()=>item(id==='910003'?'910004':id)};
    });
  assert.deepEqual(result.tracks.map(t=>t.id),['deezer:910001']);
  assert.equal(result.unavailable,2);
});
test('malformed IDs do not trigger ANY external metadata requests',async()=>{
  let calls=0;
  const fetcher=async()=>{calls++;return mockFetch('https://api.deezer.com/track/910001');};
  for(const raw of ['', 'deezer:0','deezer:abc','deezer:1,deezer:1',
    'deezer:1,jellyfin:private','deezer:1,'.repeat(6),'x'.repeat(131)]){
    assert.throws(()=>parseDeezerChallengeIds(raw),/Invalid shared track IDs/);
    await assert.rejects(loadDeezerChallengeTracks(raw,fetcher),/Invalid shared track IDs/);
  }
  assert.equal(calls,0);
});
test('local server serves only bounded Deezer IDs and rejects malformed requests',async()=>{
  const called=[];
  const server=createServer({fetcher:async url=>{
    called.push(new URL(url).pathname);
    return mockFetch(url);
  }});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const base='http://127.0.0.1:'+server.address().port;
    const r=await fetch(base+'/api/challenge-tracks?ids=deezer%3A910001%2Cdeezer%3A910002');
    assert.equal(r.status,200);
    const data=await r.json();
    assert.deepEqual(data.tracks.map(t=>t.id),['deezer:910001','deezer:910002']);
    assert.deepEqual(called,['/track/910001','/track/910002']);
    const invalid=await fetch(base+'/api/challenge-tracks?ids=jellyfin%3Asecret');
    assert.equal(invalid.status,400);
    assert.equal(called.length,2);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
test('Challenges screen only offers ID-only sharing for actually saved Deezer recordings',()=>{
  const deezer={id:'deezer:910001',source:'deezer',title:'Saved fixture',artist:'Artist'};
  const commons={id:'commons:old-one',source:'commons',title:'Old favorite',artist:'Other'};
  const render=(state,catalog)=>createViews({state,catalog,current:null,allGenres:['all'],
    challengeIds:[],challengeResponses:[],catalogWarning:'',catalogLive:true,
    collectionQuery:'',collectionSort:'recent'}).renderChallenges();
  const blank=render(createInitialState(),[]);
  assert.match(blank,/data-action="share-challenge" disabled/);
  const populated=render({...createInitialState(),favorites:[commons.id,deezer.id]},[deezer,commons]);
  assert.match(populated,/data-action="share-challenge" >/);
  assert.match(populated,/1 saved Deezer song available/);
  assert.match(populated,/shared by ID only/);
});
