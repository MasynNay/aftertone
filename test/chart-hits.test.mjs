import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchChartHitsPage, sanitizeChartEntry, parseChartCursor, sameSongTitle} from '../app/src/chart-hits.mjs';
import {createServer} from '../app/server.mjs';
import {createInitialState} from '../app/src/taste.mjs';
import {sanitizeState} from '../app/src/persistence.mjs';
import {createViews} from '../app/public/views.js';

const YOUTUBE_KEY='A'.repeat(39);
const id='abcdefghI_J';
const mbid='3dd1fe3b-0395-4790-93e4-7cc820a1ab8c';
const chartRows=[
  {artist_name:'Charlie Puth', track_name:'How Long',listen_count:7000,caa_release_mbid:mbid},
  {artist_name:'Taylor Swift',track_name:'Anti-Hero',listen_count:6000},
  {artist_name:'Various Artists',track_name:'Radio Mix',listen_count:1000},
  {artist_name:'Podcast Person',track_name:'My podcast',listen_count:500},
];
const data={
  id:{videoId:id},snippet:{title:'Charlie Puth - How Long (Official Music Video)',channelTitle:'CharliePuthVEVO',
    thumbnails:{high:{url:`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}}},
};
const cover={id:{videoId:'zbcdefghI_J'},snippet:{title:'Charlie Puth - How Long (Cover)',channelTitle:'Cover Band'}};
const metadata={id,contentDetails:{duration:'PT3M22S'},snippet:{defaultAudioLanguage:'en-US'},statistics:{viewCount:'10000000'},status:{embeddable:true}};
function buildMock({english=true, youtubeUnavailable=false, includeSong=true}={}) {
  const calls=[];
  const mock=async url=>{
    const u=new URL(url); calls.push(u);
    if(u.hostname==='api.listenbrainz.org') return {ok:true,json:async()=>({payload:{recordings:chartRows}})};
    if(u.pathname.endsWith('/search')) {
      if(youtubeUnavailable) return {ok:false,status:403,json:async()=>({})};
      return {ok:true,json:async()=>({items:includeSong ? [cover,data] : [cover]})};
    }
    if(u.pathname.endsWith('/videos')) return {ok:true,json:async()=>({items:[{...metadata,snippet:{defaultAudioLanguage:english?'en-US':'es'}}]})};
    throw Error('Unexpected URL: '+u);
  };
  return {mock,calls};
}

test('canonical chart data sanitizes and rejects non-recordings and makes no claim about playable files',()=>{
  assert.equal(sanitizeChartEntry(chartRows[0]).title,'How Long');
  assert.equal(sanitizeChartEntry(chartRows[0]).cover,`https://coverartarchive.org/release/${mbid}/front-500`);
  assert.equal(sanitizeChartEntry(chartRows[2]),null);
  assert.equal(sanitizeChartEntry({...chartRows[0],track_name:'How Long (Karaoke)'}),null);
  assert.ok(sameSongTitle('How Long','How Long'));
  assert.ok(!sameSongTitle('How Long','A different song'));
});

test('chart results are canonical ListenBrainz song identities matched to real artist channels, not covers',async()=>{
  const {mock,calls}=buildMock();
  const result=await fetchChartHitsPage('0',mock,YOUTUBE_KEY,'all');
  assert.equal(result.provider,'charts');
  assert.equal(result.tracks.length,1);
  const track=result.tracks[0];
  assert.equal(track.id,`youtube:${id}`);
  assert.equal(track.artist,'Charlie Puth');
  assert.equal(track.title,'How Long');
  assert.equal(track.artwork,`https://coverartarchive.org/release/${mbid}/front-500`);
  assert.equal(track.language,'en');
  assert.equal(track.source,'youtube');
  assert.equal(track.chartListens,7000);
  assert.equal(track.originalCandidate,true);
  assert.ok(!('audio' in track));
  assert.equal(result.nextCursor,'4');
  assert.ok(calls.some(c=>c.hostname==='api.listenbrainz.org'));
  assert.ok(calls.some(c=>c.pathname.endsWith('/videos')));
  assert.ok(calls.filter(c=>c.pathname.endsWith('/search')).length <= 2);
});

test('English identified filter remains strict when uploader explicitly labels non-English audio',async()=>{
  const {mock}=buildMock({english:false});
  const result=await fetchChartHitsPage('0',mock,YOUTUBE_KEY,'en-strict');
  assert.equal(result.tracks.length,0);
  assert.ok(result.hasMore);
});

test('does not replace unavailable popular songs with random covers or Commons material',async()=>{
  const {mock}=buildMock({includeSong:false});
  const result=await fetchChartHitsPage('0',mock,YOUTUBE_KEY);
  assert.equal(result.tracks.length,0);
  assert.equal(result.provider,'charts');
});

test('quota exhaustion surfaces a real error instead of silently switching sources',async()=>{
  const {mock}=buildMock({youtubeUnavailable:true});
  await assert.rejects(fetchChartHitsPage('0',mock,YOUTUBE_KEY),/quota exhausted/i);
});

test('chart pagination validates offsets and never accepts arbitrary URLs or excessive offsets',()=>{
  assert.equal(parseChartCursor(''),0);
  assert.equal(parseChartCursor('4'),4);
  assert.throws(()=>parseChartCursor('9'),/cursor/i);
  assert.throws(()=>parseChartCursor('http://bad'),/cursor/i);
  assert.throws(()=>parseChartCursor('2000'),/cursor/i);
});

test('chart source is offered only with a server-held API key and never exposes credentials',async()=>{
  const previous=process.env.YOUTUBE_API_KEY;
  process.env.YOUTUBE_API_KEY=YOUTUBE_KEY;
  const {mock}=buildMock();
  const server=createServer({fetcher:mock});
  try {
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const base=`http://127.0.0.1:${server.address().port}`;
    const metadata=await (await fetch(`${base}/api/catalog`)).json();
    assert.equal(metadata.providers[0],'deezer');
    assert.ok(metadata.providers.includes('charts'));
    assert.ok(metadata.providers.includes('youtube'));
    assert.ok(!JSON.stringify(metadata).includes(YOUTUBE_KEY));
    const response=await fetch(`${base}/api/discover?source=charts&genre=all&cursor=0`);
    assert.equal(response.status,200);
    const body=await response.json();
    assert.equal(body.tracks[0].title,'How Long');
    assert.ok(!JSON.stringify(body).includes(YOUTUBE_KEY));
    const wrongGenre=await (await fetch(`${base}/api/discover?source=charts&genre=pop`)).json();
    assert.match(wrongGenre.error,/All genres/);
  } finally {
    if(server.listening) await new Promise(resolve=>server.close(resolve));
    if(previous===undefined) delete process.env.YOUTUBE_API_KEY; else process.env.YOUTUBE_API_KEY=previous;
  }
});

test('new chart selection survives old favorite persistence and is labelled distinctly',()=>{
  const state={...createInitialState(),source:'charts'};
  assert.equal(sanitizeState(state).source,'charts');
  const markup=createViews({state,catalog:[],current:null,allGenres:['all','pop'],challengeIds:[],challengeResponses:[],catalogWarning:'',catalogLive:true,collectionQuery:'',collectionSort:'recent',availableSources:['mix','charts','youtube','audius','commons'],feed:{available:0,hasMore:true}}).renderDiscovery();
  assert.doesNotMatch(markup,/Independent audio mix/);
  assert.doesNotMatch(markup,/Global charts/); // retired from the discovery UI
});
