import test from 'node:test';
import assert from 'node:assert/strict';
import { configuredYouTubeKey, fetchYouTubePage, isYouTubeId, normalizeYouTubeVideo, youtubeEmbedUrl, YOUTUBE_SEARCH_LANES, parseYouTubeCursor } from '../src/youtube.mjs';
import { sanitizeState } from '../src/persistence.mjs';
import { createInitialState } from '../src/taste.mjs';
import { createViews } from '../public/views.js';
import { createServer } from '../server.mjs';

const id = 'abCDe12FG_h';
const item = { id: { videoId: id }, snippet: { title: 'Taylor Swift - A Lovely Track (Official Video)', channelTitle: 'TaylorSwiftVEVO',
  thumbnails: { high: { url: 'https://i.ytimg.com/vi/abCDe12FG_h/hqdefault.jpg' } } } };
const key = 'A'.repeat(39);
const mock = async (url) => {
  const u = new URL(url);
  assert.equal(u.hostname, 'www.googleapis.com');
  assert.equal(u.searchParams.get('key'), key);
  assert.equal(u.searchParams.get('videoEmbeddable'), 'true');
  assert.equal(u.searchParams.get('type'), 'video');
  return { ok: true, json: async () => ({ items: [item, item], nextPageToken: 'CBA_123' }) };
};

test('YouTube adapter extracts names, channel attribution and thumbnail without a playback URL', () => {
  const track = normalizeYouTubeVideo(item, 'pop');
  assert.equal(track.id, 'youtube:' + id);
  assert.equal(track.artist, 'Taylor Swift');
  assert.equal(track.title, 'A Lovely Track');
  assert.equal(track.uploader, 'TaylorSwiftVEVO');
  assert.equal(track.source, 'youtube');
  assert.ok(track.artwork.startsWith('https://'));
  assert.ok(!('audio' in track));
  assert.equal(isYouTubeId('bad'), false);
  assert.equal(youtubeEmbedUrl(id), `https://www.youtube.com/embed/${id}?start=30&end=52&playsinline=1&autoplay=1`);
  assert.equal(youtubeEmbedUrl('not a video'), null);
});

test('YouTube search uses official Data API with pagination, deduplication and 50-result page size', async () => {
  const first = await fetchYouTubePage('pop', '', mock, key);
  assert.equal(first.provider, 'youtube');
  assert.equal(first.tracks.length, 1);
  assert.equal(first.nextCursor, 's0~CBA_123');
  assert.equal(first.hasMore, true);
  const second = await fetchYouTubePage('pop', first.nextCursor, async url => {
    assert.equal(new URL(url).searchParams.get('pageToken'), 'CBA_123');
    return mock(url);
  }, key);
  assert.equal(second.tracks.length, 1);
  await assert.rejects(fetchYouTubePage('pop', '!invalid!', mock, key), /Invalid YouTube page cursor/);
  await assert.rejects(fetchYouTubePage('pop', '', mock, ''), /not configured/);
});

test('YouTube saved track survives reload and only an explicitly configured key enables provider', () => {
  const initial = createInitialState();
  const track = normalizeYouTubeVideo(item);
  const sanitized = sanitizeState({ ...initial, source: 'youtube', history: [{ id: track.id, action: 'like' }], favorites: [track.id], savedTracks: [track] });
  assert.equal(sanitized.source, 'youtube');
  assert.equal(sanitized.savedTracks[0].uploader, track.uploader);
  assert.equal(configuredYouTubeKey({}), '');
  assert.equal(configuredYouTubeKey({ YOUTUBE_API_KEY: key }), key);
  const markup = createViews({ state: sanitized, catalog: [track], current: track, allGenres: ['all'], challengeIds: [], challengeResponses: [], catalogWarning: '', catalogLive: true, collectionQuery: '', collectionSort: 'recent', availableSources: ['mix','youtube'] }).renderDiscovery();
  assert.match(markup, /A Lovely Track/);
  assert.match(markup, /22-second listening preview/);
  assert.match(markup, /track-source-chip">YOUTUBE/);
});

test('YouTube provider endpoint is gated behind a server-held key and never exposes it to catalog clients', async () => {
  const previous = process.env.YOUTUBE_API_KEY;
  process.env.YOUTUBE_API_KEY = key;
  const server = createServer({ fetcher: mock });
  try {
    await new Promise(done => server.listen(0, '127.0.0.1', done));
    const base = `http://127.0.0.1:${server.address().port}`;
    const catalog = await (await fetch(base + '/api/catalog')).json();
    assert.ok(catalog.providers.includes('youtube'));
    assert.ok(!JSON.stringify(catalog).includes(key));
    const discover = await (await fetch(base + '/api/discover?genre=pop&source=youtube&strict=1')).json();
    assert.equal(discover.tracks[0].source, 'youtube');
    assert.ok(!JSON.stringify(discover).includes(key));
  } finally {
    if (server.listening) await new Promise(done => server.close(done));
    if (previous === undefined) delete process.env.YOUTUBE_API_KEY; else process.env.YOUTUBE_API_KEY = previous;
  }
});

test('YouTube expands genre discovery across decades and styles after paged search exhausts', async () => {
  const seen = [];
  const fetcher = async (url) => {
    seen.push(new URL(url));
    return { ok:true, json:async () => ({ items: [item] }) }; // No nextPageToken.
  };
  assert.ok(YOUTUBE_SEARCH_LANES.pop.length >= 10);
  const first = await fetchYouTubePage('pop', '', fetcher, key);
  assert.equal(first.nextCursor, 's1~');
  assert.equal(first.hasMore, true);
  const second = await fetchYouTubePage('pop', first.nextCursor, fetcher, key);
  assert.equal(second.nextCursor, 's2~');
  assert.notEqual(seen[0].searchParams.get('q'), seen[1].searchParams.get('q'));
  assert.equal(seen[1].searchParams.get('pageToken'), null);
  assert.deepEqual(parseYouTubeCursor('s2~abcD_12'), {lane:2, token:'abcD_12'});
  assert.throws(() => parseYouTubeCursor('s250~'), /Invalid YouTube page cursor/);
  assert.throws(() => parseYouTubeCursor('bad;script'), /Invalid YouTube page cursor/);
});

test('YouTube artist search is not broadened into unrelated hits', async () => {
  const fetcher = async url => {
    assert.equal(new URL(url).searchParams.get('q'), 'Charlie Puth');
    return {ok:true, json:async () => ({items:[item]})};
  };
  const result = await fetchYouTubePage('pop','',fetcher,key,'Charlie Puth');
  assert.equal(result.nextCursor,null);
  assert.equal(result.hasMore,false);
});
