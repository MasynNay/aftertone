import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../app/server.mjs';
import { resolveAudiusAudio, normalizeAudiusTrack } from '../app/src/audius.mjs';
import { fetchJamendoById } from '../app/src/jamendo.mjs';
import { createViews } from '../app/public/views.js';
import { createInitialState } from '../app/src/taste.mjs';

const sourceTrack = { id: 'Bad1d_22', title: 'Charlie_Puth_-_How_Long', user: { name: 'Random Cover Account' },
  genre: 'Pop', is_streamable: true, is_available: true, is_stream_gated: false };
const reply = data => ({ ok: true, status: 200, json: async () => ({ data }) });

async function startServer(fetcher) {
  const server = createServer({ fetcher });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => server.close(resolve)) };
}

test('regression: original-only filters out miscredited uploads during discovery but audio resolver does not crash', async () => {
  assert.equal(normalizeAudiusTrack(sourceTrack, 'pop', true), null);
  const source = await resolveAudiusAudio(sourceTrack.id, async () => reply(sourceTrack));
  assert.equal(source.attribution, 'Random Cover Account');
  assert.match(source.url, /\/tracks\/Bad1d_22\/stream/);
  assert.equal(source.fallbackUrl, '/api/audius-stream?id=Bad1d_22');
});

test('regression: saved Audius track remains playable after its metadata changes', async () => {
  const server = await startServer(async () => reply(sourceTrack));
  try {
    const res = await fetch(`${server.url}/api/audio?id=audius:${sourceTrack.id}`);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.attribution, 'Random Cover Account');
    assert.equal(data.fallbackUrl, `/api/audius-stream?id=${sourceTrack.id}`);
  } finally { await server.close(); }
});

test('regression: Jamendo already-saved track can resolve audio regardless of originals filter', async () => {
  const track = await fetchJamendoById('client-id', '123', async () => ({ok:true, json:async () => ({headers:{status:'success'},results:[{
    id:123, name:'Popular Artist - Their Song', artist_name:'Local Tribute Artist', audio:'https://mp3d.jamendo.com/abc.mp3'
  }]})}));
  assert.equal(track.id, 'jamendo:123');
  assert.equal(track.originalCandidate, false);
});

test('Audius stream fallback accepts a known track ID and relays bytes and ranges without caching', async () => {
  const sound = Uint8Array.from([82,73,70,70,0,0,0,0,87,65,86,69]);
  const upstream = [];
  const server = await startServer(async (url, options) => {
    upstream.push({url: String(url), options});
    return {ok:true, status:206,
      headers:new Headers({'content-type':'audio/wav','content-range':'bytes 0-11/12','accept-ranges':'bytes','content-length':'12'}),
      body:new ReadableStream({start(controller){controller.enqueue(sound);controller.close();}}) };
  });
  try {
    const res = await fetch(`${server.url}/api/audius-stream?id=ABC_1`, {headers:{Range:'bytes=0-11'}});
    assert.equal(res.status, 206);
    assert.equal(res.headers.get('cache-control'), 'no-store, private');
    assert.equal(res.headers.get('content-type'), 'audio/wav');
    assert.deepEqual([...new Uint8Array(await res.arrayBuffer())], [...sound]);
    assert.equal(upstream[0].options.headers.Range, 'bytes=0-11');
    assert.equal(new URL(upstream[0].url).hostname, 'api.audius.co');
  } finally { await server.close(); }
});

test('Audius stream fallback never forwards arbitrary URLs and rejects non-audio content', async () => {
  const server = await startServer(async () => ({ok:true,status:200,
    headers:new Headers({'content-type':'application/json'}),
    body:new ReadableStream({start(controller){controller.enqueue(new Uint8Array([1]));controller.close();}}) }));
  try {
    let res = await fetch(`${server.url}/api/audius-stream?id=../../internal`);
    assert.equal(res.status, 400);
    res = await fetch(`${server.url}/api/audius-stream?id=abc_D4`);
    assert.equal(res.status, 502);
  } finally {await server.close();}
});

test('Audius explicitly unstreamable track never enters discovery feed', async () => {
  const track = {...sourceTrack, title:'A New Song', is_streamable:false};
  assert.equal(normalizeAudiusTrack(track, 'pop'), null);
});

test('Empty catalog search explains limits and provides clear-search action', () => {
  const markup = createViews({state: createInitialState(),catalog:[],current:null,allGenres:['all','pop'],
    challengeIds:[],challengeResponses:[],catalogWarning:'',catalogLive:true,collectionQuery:'',collectionSort:'recent',
    searchQuery:'Charlie Puth',sourceLabel:'Audius',feed:{loading:false,hasMore:false,available:0},
    availableSources:['mix','audius']}).renderDiscovery();
  assert.match(markup,/No matching recordings/);
  assert.match(markup,/Deezer search results/);
  assert.match(markup,/data-action="clear-search"/);
});
