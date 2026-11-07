import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchCommonsDiscovery, normalizeCommonsFile, parseCursor, SEARCH_LANES } from '../src/live-commons.mjs';
import { fetchJamendoPage, fetchJamendoById } from '../src/jamendo.mjs';
import { THEMES, THEME_IDS } from '../src/themes.mjs';
import { createInitialState, recordChoice } from '../src/taste.mjs';
import { sanitizeState } from '../src/persistence.mjs';
import { createServer } from '../server.mjs';

const popFile = (n) => ({ pageid: n, title: `File:Bright_Pop_Song_${n}.mp3`, imageinfo: [{
  url: `https://upload.wikimedia.org/wikipedia/commons/3/38/pop${n}.mp3`,
  mime: 'audio/mpeg', size: 64000, descriptionurl: `https://commons.wikimedia.org/wiki/File:Bright_Pop_Song_${n}.mp3`,
  extmetadata: { Artist: { value: '<a>Independent Artist</a>' }, LicenseShortName: { value: 'CC BY 4.0' } },
}] });

test('all twelve genres have curated live-search lanes, and cursors reject strange inputs', () => {
  assert.equal(Object.keys(SEARCH_LANES).length, 12);
  assert.deepEqual(parseCursor('2:160'), { lane: 2, offset: 160 });
  assert.deepEqual(parseCursor('4; DROP TABLE;'), { lane: 0, offset: 0 });
  assert.deepEqual(parseCursor('-3:4000'), { lane: 0, offset: 0 });
  assert.deepEqual(parseCursor('999:777'), { lane: 0, offset: 0 });
});

test('Commons page normalizer only permits plausible, host-validated audio files', () => {
  const item = normalizeCommonsFile(popFile(801), 'pop');
  assert.equal(item.id, 'commons:file-801');
  assert.equal(item.genre, 'pop');
  assert.equal(item.artist, 'Independent Artist');
  assert.equal(item.license, 'CC BY 4.0');
  assert.equal(normalizeCommonsFile({ ...popFile(801), imageinfo: [{ ...popFile(801).imageinfo[0], url: 'https://evil.example/a.mp3' }] }, 'pop'), null);
  assert.equal(normalizeCommonsFile({ ...popFile(801), imageinfo: [{ ...popFile(801).imageinfo[0], mime: 'image/png' }] }, 'pop'), null);
  assert.equal(normalizeCommonsFile({ ...popFile(801), imageinfo: [{ ...popFile(801).imageinfo[0], size: 900_000_000 }] }, 'pop'), null);
});

test('live Commons pagination progresses, deduplicates and never returns arbitrary metadata', async () => {
  const queries = [];
  const fetcher = async (url) => {
    queries.push(new URL(url));
    return { ok: true, json: async () => ({ query: { pages: [popFile(1001), popFile(1002), popFile(1001), { pageid: 900, title: 'File:Cover.png', imageinfo: [{ mime: 'image/png', url: 'https://upload.wikimedia.org/pic.png' }] }] }, continue: { gsroffset: 40 } }) };
  };
  const page = await fetchCommonsDiscovery('pop', '0:0', fetcher);
  assert.equal(page.tracks.length, 2);
  assert.equal(page.nextCursor, '0:40');
  assert.equal(page.hasMore, true);
  assert.equal(queries[0].searchParams.get('gsrnamespace'), '6');
  assert.match(queries[0].searchParams.get('gsrsearch'), /pop/i);
  assert.equal(queries[0].searchParams.get('prop'), 'imageinfo');
  await fetchCommonsDiscovery('pop', page.nextCursor, fetcher);
  assert.equal(queries[1].searchParams.get('gsroffset'), '40');
});

test('live Commons search advances past empty results instead of reporting premature exhaustion', async () => {
  let seen = 0;
  const fetcher = async () => {
    seen++;
    return { ok: true, json: async () => seen < 3 ? ({ query: { pages: [] } }) : ({ query: { pages: [popFile(2100)] } }) };
  };
  const page = await fetchCommonsDiscovery('pop', '0:0', fetcher);
  assert.equal(page.tracks.length, 1);
  assert.equal(page.nextCursor, '3:0');
  assert.equal(seen, 3);
});

test('Jamendo paginates one genre at a time using own credentials and original attribution', async () => {
  const queries = [];
  const fetcher = async (url) => {
    queries.push(new URL(url));
    return { ok: true, json: async () => ({ headers: { status: 'success' }, results: Array.from({ length: 60 }, (_, i) => ({
      id: 2000 + i, name: `Indie pop ${i}`, artist_name: `Act ${i}`, audio: `https://mp3d.jamendo.com/audio/${i}`, license_ccurl: 'https://creativecommons.org/licenses/by/4.0/' })) }) };
  };
  const one = await fetchJamendoPage('my-own-key', 'pop', '0', fetcher);
  assert.equal(one.tracks.length, 60);
  assert.equal(one.nextCursor, '60');
  const two = await fetchJamendoPage('my-own-key', 'pop', one.nextCursor, fetcher);
  assert.equal(queries[1].searchParams.get('offset'), '60');
  assert.equal(queries[1].searchParams.get('client_id'), 'my-own-key');
  assert.equal(one.tracks[0].license, 'https://creativecommons.org/licenses/by/4.0/');
  assert.equal(two.tracks.length, 60);
});

test('Jamendo saved tracks can be fetched by ID in a later server session', async () => {
  const fetcher = async (url) => ({ ok: true, json: async () => ({ headers: { status: 'success' }, results: [{ id: 123, name: 'Returning Song', artist_name: 'Indie Act', audio: 'https://music.example/song.mp3' }] }) });
  assert.equal((await fetchJamendoById('my-key', '123', fetcher)).id, 'jamendo:123');
  assert.equal(await fetchJamendoById('my-key', 'invalid', fetcher), null);
});

test('twenty named palettes have unique IDs and complete design tokens', () => {
  assert.equal(THEMES.length, 20);
  assert.equal(new Set(THEME_IDS).size, 20);
  assert.ok(THEMES.filter((t) => t.kind === 'light').length >= 5);
  for (const theme of THEMES) {
    for (const token of ['bg','side','surface','surface2','surface3','border','text','muted','dim','accent','accentInk','warm','purple','vinyl','heroA','heroB','heroC','shadow']) {
      assert.ok(theme.colors[token], `${theme.name} missing ${token}`);
    }
  }
});

test('theme and saved catalog metadata survive storage hydration', () => {
  const track = { ...normalizeCommonsFile(popFile(831), 'pop'), audio: 'https://stream.example/song' };
  const initial = recordChoice(createInitialState(), { id: track.id, action: 'like' });
  const sanitized = sanitizeState({ ...initial, theme: 'charcoal', savedTracks: [track] });
  assert.equal(sanitized.theme, 'charcoal');
  assert.equal(sanitized.savedTracks[0].title, track.title);
  assert.equal('audio' in sanitized.savedTracks[0], false);
  assert.deepEqual(sanitized.favorites, [track.id]);
});

test('HTTP live discovery works with a mocked upstream provider without requiring any key', async () => {
  const fetcher = async (url) => ({ ok: true, json: async () => String(url).includes('pageids=')
    ? { query: { pages: { 3101: { imageinfo: [popFile(3101).imageinfo[0]] } } } }
    : { query: { pages: [popFile(3101), popFile(3102)] }, continue: { gsroffset: 40 } } });
  const server = createServer({ fetcher });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(`${base}/api/discover?source=commons&genre=pop`);
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.provider, 'commons');
    assert.equal(result.tracks.length, 2);
    assert.equal(result.tracks[0].genre, 'pop');
    assert.equal(result.nextCursor, '0:40');
    const streaming = await fetch(`${base}/api/audio?id=commons:file-3101`);
    assert.equal(streaming.status, 200);
  } finally {
    await new Promise((done) => server.close(done));
  }
});
