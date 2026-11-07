import test from 'node:test';
import assert from 'node:assert/strict';
import { STARTER_TRACKS, getStarterTrack } from '../src/catalog.mjs';
import { createInitialState, computeTaste, selectNext, recordChoice, removeFavorite, restoreLastChoice } from '../src/taste.mjs';
import { makeRecognitionQuiz } from '../src/quiz.mjs';
import { encodeChallenge, decodeChallenge } from '../src/challenge.mjs';
import { sanitizeState, loadState, saveState } from '../src/persistence.mjs';
import { resolveCommonsAudio } from '../src/commons.mjs';
import { fetchJamendoCatalog } from '../src/jamendo.mjs';
import { createServer } from '../server.mjs';

const first = STARTER_TRACKS[0];
const second = STARTER_TRACKS.find((track) => track.genre !== first.genre);

test('starter catalog contains distinct verifiable source files and diverse genres', () => {
  assert.ok(STARTER_TRACKS.length >= 40);
  assert.equal(new Set(STARTER_TRACKS.map((track) => track.id)).size, STARTER_TRACKS.length);
  assert.ok(new Set(STARTER_TRACKS.map((track) => track.artist)).size >= 5);
  assert.ok(new Set(STARTER_TRACKS.map((track) => track.genre)).size >= 8);
  for (const track of STARTER_TRACKS) {
    assert.match(track.id, /^commons:[a-z0-9-]+$/);
    assert.ok(track.file.endsWith('.mp3') || track.file.endsWith('.opus') || track.file.endsWith('.ogg') || track.file.endsWith('.oga'));
    assert.ok(track.link.startsWith('https://commons.wikimedia.org/wiki/File:'));
    assert.equal(getStarterTrack(track.id)?.title, track.title);
  }
});

test('likes and passes are recorded independently of recognition', () => {
  let state = createInitialState();
  state = recordChoice(state, { id: first.id, action: 'like', recognized: false, correct: null, mood: 'Warm' });
  state = recordChoice(state, { id: second.id, action: 'pass' });
  assert.deepEqual(state.favorites, [first.id]);
  const model = computeTaste(state.history, STARTER_TRACKS);
  assert.equal(model.liked, 1);
  assert.equal(model.total, 2);
  assert.equal(model.accuracy, null);
  assert.equal(model.genres.find(([genre]) => genre === first.genre)[1], 3);
});

test('correct quiz answers affect accuracy, not whether track is kept', () => {
  let state = createInitialState();
  state = recordChoice(state, { id: first.id, action: 'like', recognized: true, correct: false });
  state = recordChoice(state, { id: second.id, action: 'like', recognized: true, correct: true });
  assert.equal(computeTaste(state.history, STARTER_TRACKS).accuracy, 50);
  assert.equal(state.favorites.length, 2);
});

test('predictor does not repeat listened tracks and honors the genre selector', () => {
  const history = [{ id: first.id, action: 'pass' }];
  for (let n = 0; n < 30; n++) {
    const next = selectNext(STARTER_TRACKS, history, first.genre, () => n / 30);
    assert.ok(next);
    assert.equal(next.genre, first.genre);
    assert.notEqual(next.id, first.id);
  }
  assert.equal(selectNext(STARTER_TRACKS, STARTER_TRACKS.map((track) => ({ id: track.id, action: 'pass' }))), null);
});

test('duplicate decisions are ignored, undo removes the last like, and favorites can be deleted', () => {
  let state = createInitialState();
  state = recordChoice(state, { id: first.id, action: 'like' });
  state = recordChoice(state, { id: first.id, action: 'pass' });
  assert.equal(state.history.length, 1);
  assert.deepEqual(restoreLastChoice(state).favorites, []);
  assert.deepEqual(removeFavorite(state, first.id).favorites, []);
});

test('recognition quiz always includes the answer and no duplicate options', () => {
  for (const random of [() => 0, () => 0.999, () => 0.47]) {
    const quiz = makeRecognitionQuiz(first, STARTER_TRACKS, random);
    assert.ok(quiz.options.includes(quiz.correct));
    assert.equal(quiz.options.length, 4);
    assert.equal(new Set(quiz.options).size, 4);
  }
});

test('challenge links are bounded, readable and reject malformed IDs', () => {
  const input = STARTER_TRACKS.slice(0, 7).map((track) => track.id);
  const code = encodeChallenge(input);
  assert.deepEqual(decodeChallenge(code), input.slice(0, 5));
  assert.deepEqual(decodeChallenge('v1.commons:a~xss:<script>'), []);
  assert.deepEqual(decodeChallenge('v2.commons:a'), []);
  assert.deepEqual(decodeChallenge('x'.repeat(500)), []);
});

test('saved state survives roundtrip and sanitizes corruption', () => {
  const memory = new Map();
  const storage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
  const state = recordChoice(createInitialState(), { id: first.id, action: 'like', recognized: true, correct: true });
  assert.equal(saveState(storage, state), true);
  assert.deepEqual(loadState(storage), state);
  memory.set('aftertone:session:v1', '{ broken');
  assert.deepEqual(loadState(storage), createInitialState());
  assert.deepEqual(sanitizeState({ version: 3, history: [], favorites: [] }), createInitialState());
});

test('Commons resolver reads an allowlisted file and returns attribution metadata', async () => {
  let called = '';
  const fetcher = async (url) => {
    called = String(url);
    return { ok: true, json: async () => ({ query: { pages: { 1: { imageinfo: [{ url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/song.mp3', descriptionurl: first.link, extmetadata: { LicenseShortName: { value: 'CC BY 4.0' } } }] } } } }) };
  };
  const result = await resolveCommonsAudio(first.id, fetcher);
  assert.match(called, /commons\.wikimedia\.org/);
  assert.ok(called.includes('imageinfo'));
  assert.equal(result.license, 'CC BY 4.0');
  await assert.rejects(() => resolveCommonsAudio('commons:not-here', fetcher), /Unknown starter track/);
});

test('Jamendo adapter normalizes only tracks with audio and preserves source links', async () => {
  const fetcher = async (url) => ({ ok: true, json: async () => ({ headers: { status: 'success' }, results: [{ id: 789, name: 'Signal', artist_name: 'Small Artist', image: 'https://image.example/album.jpg', audio: 'https://audio.example/song.mp3', shareurl: 'https://www.jamendo.com/track/789' }] }) });
  const tracks = await fetchJamendoCatalog('dev-test-abc', fetcher);
  assert.equal(tracks.length, 1);
  assert.equal(tracks[0].id, 'jamendo:789');
  assert.equal(tracks[0].title, 'Signal');
});

test('HTTP server delivers frontend and catalog without dependencies', async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = `http://127.0.0.1:${server.address().port}`;
    const [health, catalog, page, script, denied] = await Promise.all([
      fetch(`${address}/api/health`), fetch(`${address}/api/catalog`),
      fetch(address), fetch(`${address}/src/taste.mjs`), fetch(`${address}/src/../server.mjs`),
    ]);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).status, 'ok');
    assert.equal(catalog.status, 200);
    assert.equal((await catalog.json()).count, STARTER_TRACKS.length);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /aftertone/);
    assert.equal(script.status, 200);
    assert.notEqual(denied.status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
