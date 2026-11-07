import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchYouTubePage, YOUTUBE_SEARCH_LANES, normalizeYouTubeVideo } from '../app/src/youtube.mjs';
import { createInitialState } from '../app/src/taste.mjs';
import { sanitizeState } from '../app/src/persistence.mjs';
import { createViews } from '../app/public/views.js';
import { likelyMusicRecording } from '../app/src/recording-quality.mjs';

const key='A'.repeat(39);
const videos=[
  {id:{videoId:'EnglishA001'},snippet:{title:'Charlie Puth - How Long (Official Video)',channelTitle:'Charlie Puth',defaultLanguage:'es',thumbnails:{high:{url:'https://i.ytimg.com/vi/EnglishA001/hqdefault.jpg'}}}},
  {id:{videoId:'SpanishA001'},snippet:{title:'Shakira - Antología (Official Video)',channelTitle:'ShakiraVEVO',thumbnails:{high:{url:'https://i.ytimg.com/vi/SpanishA001/hqdefault.jpg'}}}},
  {id:{videoId:'CoverArtist'},snippet:{title:'Charlie Puth - How Long (Cover)',channelTitle:'Someone Else'}},
  {id:{videoId:'Podcast0001'},snippet:{title:'Music Artist Interview Podcast',channelTitle:'MusicVEVO'}},
];
const metadata={
  EnglishA001:{id:'EnglishA001',snippet:{defaultAudioLanguage:'en-US',defaultLanguage:'es',categoryId:'10'},statistics:{viewCount:'12000000'},contentDetails:{duration:'PT3M29S'},status:{embeddable:true}},
  SpanishA001:{id:'SpanishA001',snippet:{defaultAudioLanguage:'es',defaultLanguage:'en',categoryId:'10'},statistics:{viewCount:'5000000'},contentDetails:{duration:'PT3M15S'},status:{embeddable:true}},
};
const calls=[];
const provider = async url => {
  const u=new URL(url); calls.push(u);
  if (u.pathname.endsWith('/search')) return {ok:true,json:async()=>({items:videos})};
  if (u.pathname.endsWith('/videos')) return {ok:true,json:async()=>({items:Object.values(metadata)})};
  throw Error('unexpected endpoint');
};

test('official artist searches return real titles, source thumbnails, and avoid covers and podcasts',async()=>{
  const {tracks}=await fetchYouTubePage('pop','',provider,key,'official music video',true,'all');
  assert.deepEqual(tracks.map(t=>t.title),['How Long','Antología']);
  assert.deepEqual(tracks.map(t=>t.artist),['Charlie Puth','Shakira']);
  assert.ok(tracks.every(t=>t.artwork?.startsWith('https://i.ytimg.com/')));
  assert.ok(calls.some(u=>u.pathname.endsWith('/videos') && u.searchParams.get('part').includes('contentDetails')));
});

test('audio language uses videos.list defaultAudioLanguage not title/description metadata language',async()=>{
  const all=await fetchYouTubePage('pop','',provider,key,'official music video',true,'all');
  assert.deepEqual(all.tracks.map(t=>t.language),['en','es']);
  const english=await fetchYouTubePage('pop','',provider,key,'official music video',true,'en-strict');
  assert.deepEqual(english.tracks.map(t=>t.artist),['Charlie Puth']);
  const spanish=await fetchYouTubePage('pop','',provider,key,'official music video',true,'es');
  assert.deepEqual(spanish.tracks.map(t=>t.artist),['Shakira']);
  assert.equal(all.tracks[0].metadataLanguage,'es');
});

test('hits mode rejects obscure uploads with verified low views; variety and user search admit them', async()=>{
  const local={...videos[0],id:{videoId:'LowView0001'},snippet:{...videos[0].snippet,channelTitle:'Charlie Puth'}};
  const detail={id:'LowView0001',snippet:{defaultAudioLanguage:'en'},statistics:{viewCount:'999'},contentDetails:{duration:'PT3M'},status:{embeddable:true}};
  assert.equal(normalizeYouTubeVideo(local,'pop',true,detail,{hitsOnly:true}),null);
  assert.ok(normalizeYouTubeVideo(local,'pop',true,detail,{hitsOnly:false}));
  assert.ok(normalizeYouTubeVideo(local,'pop',true,detail,{hitsOnly:true,explicitSearch:true}));
});

test('YouTube discovery uses named artists across multiple languages instead of generic keyword spam',()=>{
  assert.ok(YOUTUBE_SEARCH_LANES.pop.length>=30);
  assert.ok(YOUTUBE_SEARCH_LANES.all.length>=35);
  assert.ok(YOUTUBE_SEARCH_LANES.pop.some(q=>q.includes('Charlie Puth')));
  assert.ok(YOUTUBE_SEARCH_LANES.pop.some(q=>q.includes('Shakira')));
  assert.ok(!YOUTUBE_SEARCH_LANES.pop.some(q=>q==='pop official music video'));
});

test('all languages and search options persist while legacy default English switches once to all',()=>{
  const state=createInitialState();
  assert.equal(state.language,'all');
  assert.equal(state.discovery,'hits');
  assert.equal(state.era,'any');
  assert.equal(sanitizeState({...state,era:'1990s',discovery:'variety',language:'ko'}).language,'ko');
  assert.equal(sanitizeState({...state,era:'1990s',discovery:'variety',language:'ko'}).era,'1990s');
  const old={...state}; delete old.era; delete old.discovery; old.language='en';
  assert.equal(sanitizeState(old).language,'all');
  assert.equal(sanitizeState({...state,language:'en'}).language,'en');
  assert.equal(sanitizeState({...old,language:'en-strict'}).language,'en-strict');
});

test('UI exposes language and era menus plus a mainstream-first shortcut in audio mix',()=>{
  const s={...createInitialState(),source:'mix'};
  const markup=createViews({state:s,catalog:[],current:null,allGenres:['all','pop'],challengeIds:[],challengeResponses:[],catalogWarning:'',catalogLive:true,collectionQuery:'',collectionSort:'recent',availableSources:['mix','audius','youtube'],feed:{available:0,hasMore:true}}).renderDiscovery();
  const sidebar=createViews({state:s,catalog:[],current:null,allGenres:['all','pop'],challengeIds:[],challengeResponses:[],feed:{}}).renderSidebarPreferences();
  assert.match(sidebar,/All languages/);
  assert.match(sidebar,/Spanish/);
  assert.match(sidebar,/Korean/);
  assert.doesNotMatch(markup,/data-action="use-mainstream"/);
  assert.doesNotMatch(markup,/value="1990s"/);
});

test('blocks obvious album and playlist uploads without rejecting ordinary songs',()=>{
  assert.equal(likelyMusicRecording({title:'My Music Compilation Full Album 2026'}),false);
  assert.equal(likelyMusicRecording({title:'All the Small Things',duration:185}),true);
});


test('global popular lanes mix English and non-English performers early rather than after all English ones',async()=>{
  const queries=[];
  const mock = async (url) => {
    const u=new URL(url);
    queries.push(u.searchParams.get('q'));
    return {ok:true,json:async()=>({items:[]})};
  };
  let cursor='';
  for (let n=0;n<9;n++) {
    const result=await fetchYouTubePage('all',cursor,mock,key,'',true,'all');
    cursor=result.nextCursor;
    assert.ok(cursor);
  }
  assert.ok(queries.slice(0,7).some(q=>/Shakira|Bad Bunny|ROSALÍA|Karol G/i.test(q)),JSON.stringify(queries));
});
