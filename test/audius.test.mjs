import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server.mjs';
import { fetchAudiusPage, mapAudiusGenre, normalizeAudiusTrack, parseAudiusCursor, resolveAudiusAudio } from '../src/audius.mjs';
import { sanitizeState } from '../src/persistence.mjs';
import { createInitialState, recordChoice } from '../src/taste.mjs';
import { encodeChallenge, decodeChallenge } from '../src/challenge.mjs';

const makeTrack = (i, genre = 'Pop') => ({
  id: `jD78_${i}`, title: `A beautiful song ${i}`, genre, duration: 183,
  user: { name: `Artist ${i}`, handle: `artist${i}` }, is_available: true, is_stream_gated: false,
  permalink: `/artist${i}/song-${i}`, artwork: { '480x480': `https://audius.co/artwork/${i}.jpg` },
});
const mockResponse = (payload, status = 200) => ({ ok: status < 400, status, json: async () => payload });

test('Audius normalizer preserves artist attribution, blocks gated tracks and maps genres', () => {
  const result = normalizeAudiusTrack(makeTrack(1), 'pop');
  assert.equal(result.id, 'audius:jD78_1');
  assert.equal(result.genre, 'pop');
  assert.equal(result.artist, 'Artist 1');
  assert.equal(result.link, 'https://audius.co/artist1/song-1');
  assert.equal(mapAudiusGenre('Hip-Hop/Rap'), 'hiphop');
  assert.equal(mapAudiusGenre('Alternative'), 'indie');
  assert.equal(normalizeAudiusTrack({ ...makeTrack(1), is_stream_gated: true }, 'pop'), null);
  assert.equal(normalizeAudiusTrack({ ...makeTrack(1), is_available: false }, 'pop'), null);
  assert.equal(normalizeAudiusTrack({ ...makeTrack(1), id: '../../secret' }, 'pop'), null);
});

test('Audius pages advance to different offsets and search after trending windows', async () => {
  const queries = [];
  const fetcher = async (url) => {
    queries.push(new URL(url));
    return mockResponse({ data: Array.from({ length: 40 }, (_, i) => makeTrack(i + queries.length * 100)) });
  };
  const first = await fetchAudiusPage('pop', '0:0', fetcher);
  assert.equal(first.tracks.length, 40);
  assert.equal(first.nextCursor, '0:40');
  assert.equal(queries[0].searchParams.get('genre'), 'Pop');
  assert.equal(queries[0].searchParams.get('time'), 'week');
  const second = await fetchAudiusPage('pop', first.nextCursor, fetcher);
  assert.equal(second.nextCursor, '0:80');
  assert.equal(queries[1].searchParams.get('offset'), '40');
  await fetchAudiusPage('pop', '4:240', fetcher);
  assert.ok(queries[2].pathname.endsWith('/tracks/search'));
  assert.equal(queries[2].searchParams.get('offset'), '240');
});

test('Empty Audius pages skip windows and do not prematurely exhaust genre', async () => {
  let calls = 0;
  const fetcher = async () => mockResponse({ data: ++calls <= 2 ? [] : [makeTrack(45)] });
  const result = await fetchAudiusPage('pop', '0:0', fetcher);
  assert.equal(result.tracks.length, 1);
  assert.equal(result.nextCursor, '3:0');
  assert.equal(calls, 3);
  assert.deepEqual(parseAudiusCursor('1:20'), { phase: 1, offset: 20 });
  assert.deepEqual(parseAudiusCursor('hello'), { phase: 0, offset: 0 });
});

test('Audius audio resolver checks playback availability and never proxies audio bytes', async () => {
  let requested;
  const fetcher = async (url) => { requested = new URL(url); return mockResponse({ data: makeTrack(34) }); };
  const result = await resolveAudiusAudio('jD78_34', fetcher);
  assert.equal(requested.pathname, '/v1/tracks/jD78_34');
  assert.equal(result.url, 'https://api.audius.co/v1/tracks/jD78_34/stream?app_name=aftertone');
  assert.equal(result.attribution, 'Artist 34');
  assert.equal(await resolveAudiusAudio('../../passwd', fetcher), null);
});

test('Audius favorites and challenge IDs survive sanitization and shared link format', () => {
  const song = normalizeAudiusTrack(makeTrack(9), 'pop');
  const state = recordChoice(createInitialState(), { id: song.id, action: 'like' });
  const saved = sanitizeState({ ...state, savedTracks: [song], theme: 'mint' });
  assert.deepEqual(saved.favorites, [song.id]);
  assert.equal(saved.savedTracks[0].source, 'audius');
  assert.equal(saved.theme, 'mint');
  assert.deepEqual(decodeChallenge(encodeChallenge([song.id])), [song.id]);
});

test('HTTP API explicitly supports Audius for pop and resolves its artist-authored tracks', async () => {
  const requested = [];
  const fetcher = async (url) => {
    const path = new URL(url);
    requested.push(path.pathname);
    return mockResponse({ data: path.pathname.endsWith('/trending') ? Array.from({ length: 40 }, (_, i) => makeTrack(i)) : makeTrack(0) });
  };
  const server = createServer({ fetcher });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const info = await (await fetch(`${base}/api/catalog`)).json();
    assert.equal(info.provider, 'deezer'); // The default now offers mainstream metadata with the Deezer official widget.
    assert.equal(info.live, true);
    const discovery = await (await fetch(`${base}/api/discover?source=audius&genre=pop`)).json();
    assert.equal(discovery.provider, 'audius');
    assert.equal(discovery.tracks.length, 40);
    assert.equal(discovery.nextCursor, '0:40');
    assert.ok(requested.some(path => path.endsWith('/tracks/trending')));
    const playback = await (await fetch(`${base}/api/audio?id=audius:jD78_0`)).json();
    assert.equal(new URL(playback.url).pathname, '/v1/tracks/jD78_0/stream');
    assert.ok(requested.some(path => path.endsWith('/tracks/jD78_0')));
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('HTTP discovery switches to Commons if Audius is down', async () => {
  const fetcher = async (url) => {
    const parsed = new URL(url);
    if (parsed.hostname === 'api.audius.co') return mockResponse({ message: 'service unavailable' }, 503);
    return mockResponse({
      query: { pages: [{ pageid: 9901, title: 'File:Rock_sample.mp3', imageinfo: [{
        url: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Sample.mp3',
        mime: 'audio/mpeg', size: 123000, extmetadata: {},
      }] }] }, continue: { gsroffset: 40 },
    });
  };
  const server = createServer({ fetcher });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/discover?source=audius&genre=rock`);
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.provider, 'commons');
    assert.equal(result.tracks[0].genre, 'rock');
    assert.match(result.warning, /audius unavailable/i);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('HTTP discovery switches to Commons if Audius reports no matching music', async () => {
  const fetcher = async (url) => {
    const parsed = new URL(url);
    if (parsed.hostname === 'api.audius.co') return mockResponse({ data: [] });
    return mockResponse({ query: { pages: [{ pageid: 9092, title: 'File:Pop_music.mp3', imageinfo: [{
      url: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Sample.mp3', mime: 'audio/mpeg', size: 50000,
    }] }] } });
  };
  const server = createServer({ fetcher });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/discover?source=audius&genre=classical`);
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.provider, 'commons');
    assert.equal(result.tracks.length, 1);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
