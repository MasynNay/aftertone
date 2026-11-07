import test from 'node:test';
import assert from 'node:assert/strict';
import { planArtistRequest, chooseListeningLane, splitSeedLanes, artistKey, DISCOVERY_MIXES } from '../src/discovery/rotation.mjs';
import { fetchDeezerRelatedArtists, parseDeezerRelated } from '../src/discovery/related-deezer.mjs';
import { selectNext, createInitialState } from '../src/taste.mjs';
import { sanitizeState } from '../src/persistence.mjs';
import { createViews } from '../public/views.js';
import { createServer } from '../server.mjs';

const seeds=['Harry Styles','Taylor Swift','Dua Lipa','Kacey Musgraves','Paramore'].map(artist=>({artist}));
const related=['Niall Horan','Conan Gray','Gracie Abrams','Maggie Rogers','The 1975','Halsey'].map(artist=>({artist,reason:'Recommended related performer'}));

test('balanced discovery requests five related and five broad with no seed repeats',()=>{
  const modes=Array.from({length:10},(_,requestNumber)=>planArtistRequest({requestNumber,seeds,related}));
  assert.equal(modes.filter(m=>m.kind==='favorite').length,0);
  assert.equal(modes.filter(m=>m.kind==='related').length,5);
  assert.equal(modes.filter(m=>m.kind==='broad').length,5);
  assert.ok(modes.filter(m=>m.kind==='related').every(m=>!seeds.some(a=>artistKey(a.artist)===artistKey(m.lane.artist))));
});

test('missing related metadata never forces repeat of the five starter artists',()=>{
  const kinds=Array.from({length:10},(_,requestNumber)=>planArtistRequest({requestNumber,seeds,related:[]}));
  assert.equal(kinds.filter(x=>x.kind==='favorite').length,0);
  assert.equal(kinds.filter(x=>x.kind==='broad').length,10);
});

test('saved discovery mix modes change quotas without changing saved favorites',()=>{
  assert.equal(DISCOVERY_MIXES.explore.filter(x=>x==='favorite').length,0);
  assert.equal(DISCOVERY_MIXES.familiar.filter(x=>x==='favorite').length,2);
  const loaded=sanitizeState({...createInitialState(),discoveryMix:'explore'});
  assert.equal(loaded.discoveryMix,'explore');
  assert.equal(sanitizeState({...loaded,discoveryMix:'bad'}).discoveryMix,'balanced');
});

test('related artist selection is an actual presentation lane, not just a ranking bonus',()=>{
  const catalog=[...seeds,...related,{artist:'Random Chart Hit'}].map((entry,n)=>({id:`deezer:${n+1}`,artist:entry.artist,title:'Song '+n,genre:'pop',mood:'Bright'}));
  const profile={personalized:true,seedArtists:seeds.map(a=>a.artist),relatedArtists:related.map(a=>a.artist),position:1,discoveryMix:'balanced'};
  const result=selectNext(catalog,[],'all',()=>0,profile);
  assert.ok(related.some(a=>a.artist===result.artist),`expected related artist, saw ${result.artist}`);
  const next=selectNext(catalog,[],'all',()=>0,{...profile,recentArtists:[result.artist],position:2});
  assert.notEqual(next.artist,result.artist);
});

test('artist appearance counters and recent artist limits protect variety',()=>{
  const catalog=[1,2,3,4,5,6,7].map(n=>({id:`deezer:${n}`,artist:n<6?'Harry Styles':n===6?'Conan Gray':'Gracie Abrams',genre:'pop',mood:'Bright'}));
  const selected=selectNext(catalog,[],'all',()=>0,{personalized:true,seedArtists:['Harry Styles'],relatedArtists:['Conan Gray','Gracie Abrams'],position:1,recentArtists:['Conan Gray'],artistAppearances:{'harry styles':9,'conan gray':2,'gracie abrams':0}});
  assert.equal(selected.artist,'Gracie Abrams');
});

test('same seed metadata gets rejected and irrelevant artist suggestion is excluded',async()=>{
  const fetcher=async u => {
    const url=new URL(u);
    if(url.pathname==='/search/artist') return {ok:true,json:async()=>({data:[{id:3,name:'Some other person'}]})};
    throw Error('Wrong endpoint');
  };
  const result=await fetchDeezerRelatedArtists('Unrelated Artist',fetcher);
  assert.equal(result.matched,false);
  assert.deepEqual(result.related,[]);
  assert.deepEqual(parseDeezerRelated({data:[{id:3,name:'Muse'}]},'Muse'),[]);
});

test('API route returns Deezer graph candidates with no secret or user account',async()=>{
  const fetcher=async u=>{
    const url=new URL(u);
    if(url.pathname==='/search/artist') return {ok:true,json:async()=>({data:[{id:1122,name:'API Test Band'}]})};
    return {ok:true,json:async()=>({data:[{id:44,name:'Indie Neighbor',nb_fan:334}]})};
  };
  const server=createServer({fetcher});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const result=await fetch(`http://127.0.0.1:${server.address().port}/api/related-artists?artist=API%20Test%20Band`);
    assert.equal(result.status,200);
    const body=await result.json();
    assert.equal(body.related[0].artist,'Indie Neighbor');
    assert.equal(body.source,'Deezer artist graph');
  }finally {await new Promise(resolve=>server.close(resolve));}
});

test('UI visibly distinguishes live related suggestions from unavailable recommendations',()=>{
  const base={state:{...createInitialState(),discoveryMix:'balanced'},catalog:[],current:null,allGenres:['all'],challengeIds:[],challengeResponses:[],catalogWarning:'',catalogLive:true,collectionQuery:'',collectionSort:'recent'};
  const view=createViews({...base,seedInfo:{active:true,kind:'artists',artists:5,related:12,mix:'balanced',lookupStatus:'ready'}});
  assert.match(view.renderDiscovery(),/12 related artists found/);
  assert.match(view.renderSidebarPreferences(),/discovery-mix-select/);
});
