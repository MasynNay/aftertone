import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchFeaturedPage, FEATURED_VIDEOS } from '../src/featured-hits.mjs';
import { createServer } from '../server.mjs';
import { createInitialState } from '../src/taste.mjs';
import { sanitizeState } from '../src/persistence.mjs';
import { createViews } from '../public/views.js';

test('curated starter links belong to uniquely identified YouTube videos and retain canonical artist/title artwork', () => {
  assert.ok(FEATURED_VIDEOS.length >= 20);
  const ids = FEATURED_VIDEOS.map(row => row[0]);
  assert.equal(new Set(ids).size, ids.length);
  for (const row of FEATURED_VIDEOS) assert.match(row[0],/^[\w-]{11}$/);
  const page = fetchFeaturedPage('pop','0','Charlie Puth','en-strict');
  assert.deepEqual(page.tracks.map(t => `${t.artist} - ${t.title}`), ['Charlie Puth - How Long']);
  assert.ok(page.tracks[0].artwork.includes('CwfoyVa980U'));
  assert.ok(page.tracks[0].originalCandidate);
  assert.equal(page.tracks[0].source,'youtube');
});

test('English, Spanish, and Korean choices serve real curated tracks rather than removing every result', () => {
  assert.ok(fetchFeaturedPage('pop','0','','en-strict').tracks.length > 0);
  assert.ok(fetchFeaturedPage('pop','0','','es').tracks.every(x => x.language==='es'));
  assert.ok(fetchFeaturedPage('pop','0','','es').tracks.length >= 2);
  assert.ok(fetchFeaturedPage('pop','0','','ko').tracks.length >= 3);
  assert.equal(fetchFeaturedPage('pop','0','','ja').tracks.length,0); // Do not fake a Japanese song.
});

test('featured page is finite, paginated, immune to arbitrary cursors, and never switches to Commons', () => {
  const a = fetchFeaturedPage('all','0');
  const b = fetchFeaturedPage('all',a.nextCursor);
  assert.equal(a.tracks.length,12);
  assert.ok(b.tracks.length>0);
  assert.equal(b.hasMore,false);
  assert.ok([...a.tracks,...b.tracks].every(t=>t.source==='youtube'));
  assert.equal(fetchFeaturedPage('all','999').tracks.length,0);
  assert.equal(fetchFeaturedPage('all','https://bad').nextCursor,a.nextCursor);
});

test('HTTP catalog always offers a no-key featured source; streaming never rewrites to Commons', async () => {
  const previous=process.env.YOUTUBE_API_KEY;
  delete process.env.YOUTUBE_API_KEY;
  const server=createServer({fetcher:async()=>{throw Error('network should not be called')}});
  try {
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const base=`http://127.0.0.1:${server.address().port}`;
    const catalog=await (await fetch(`${base}/api/catalog`)).json();
    assert.ok(catalog.providers.includes('featured'));
    assert.ok(!catalog.providers.includes('youtube'));
    assert.equal(catalog.youtubeConfigured,false);
    const results=await (await fetch(`${base}/api/discover?source=featured&genre=pop&language=en-strict`)).json();
    assert.ok(results.tracks.length>0);
    assert.ok(results.tracks.every(t=>t.source==='youtube'));
  } finally {
    await new Promise(resolve=>server.close(resolve));
    if (previous === undefined) delete process.env.YOUTUBE_API_KEY;
    else process.env.YOUTUBE_API_KEY=previous;
  }
});

test('fresh default is recognizable starter and saved source remains selectable',()=>{
  assert.equal(createInitialState().source,'deezer');
  const loaded=sanitizeState({...createInitialState(),source:'featured'});
  assert.equal(loaded.source,'featured');
  const page=createViews({state:loaded,catalog:[],current:null,allGenres:['all','pop'],challengeIds:[],challengeResponses:[],catalogWarning:'',catalogLive:true,collectionQuery:'',collectionSort:'recent',feed:{hasMore:true,available:0},availableSources:['mix','featured','audius','commons']}).renderDiscovery();
  assert.doesNotMatch(page,/CONFIGURE_YOUTUBE.command/);
  assert.doesNotMatch(page,/Familiar songs · instant video starter/); // deprecated as a source
});
