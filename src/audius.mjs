/**
 * Audius discovery and streaming adapter.
 * https://docs.audius.co/api/ — public read-only endpoints work without a key;
 * an optional developer-owned AUDIUS_API_KEY increases throughput.
 * Audio is never downloaded, cached or rehosted by AFTERTONE.
 */
import { validGenre } from './live-commons.mjs';
import { readable, parsedCredit, candidateOriginalFromUpload, likelyMusicRecording, trackLanguage } from './recording-quality.mjs';

const BASE = 'https://api.audius.co/v1';
const PAGE_SIZE = 40;
const SEARCH_PHASE = 4;
const GENRE = Object.freeze({
  pop: 'Pop', rock: 'Rock', indie: 'Alternative', electronic: 'Electronic',
  hiphop: 'Hip-Hop/Rap', ambient: 'Ambient', jazz: 'Jazz', funk: 'Funk',
  folk: 'Folk', cinematic: 'Soundtrack', classical: 'Classical',
});
const MOODS = Object.freeze({ Pop: 'Bright', Rock: 'Bold', Alternative: 'Reflective',
  Electronic: 'Focused', 'Hip-Hop/Rap': 'Bold', Ambient: 'Dreamy', Jazz: 'Warm', Funk: 'Bright',
  Folk: 'Warm', Soundtrack: 'Mysterious', Classical: 'Reflective' });
const PHASES = ['week', 'month', 'year', 'allTime'];
const normal = (value) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, 180);

export function isAudiusId(id) { return /^[A-Za-z0-9_-]{2,45}$/.test(String(id || '')); }
export function mapAudiusGenre(raw) {
  const lookup = { 'pop':'pop', 'hyperpop':'pop', 'rock':'rock','metal':'rock','punk':'rock',
    'alternative':'indie', 'electronic':'electronic', 'dancehall':'electronic',
    'techno':'electronic','house':'electronic', 'deep house':'electronic', 'lo-fi':'electronic',
    'trap':'hiphop', 'hip-hop/rap':'hiphop','jazz':'jazz', 'funk':'funk',
    'r&b/soul':'funk', 'folk':'folk', 'acoustic':'folk','ambient':'ambient',
    'soundtrack':'cinematic','classical':'classical', 'world':'folk' };
  return lookup[normal(raw).toLowerCase()] || 'indie';
}
function playable(item) {
  return item && isAudiusId(item.id) && normal(item.title) && normal(item.user?.name || item.user?.handle)
    && item.is_available !== false && item.is_unlisted !== true
    && item.is_stream_gated !== true && item.is_delete !== true && item.is_streamable !== false
    && item.access?.stream !== false;
}
export function normalizeAudiusTrack(item, requestedGenre = 'all', checkProvenance = true) {
  if (!playable(item) || !likelyMusicRecording({ title:item.title, tags:item.tags, description:item.description, duration:item.duration, kind:item.genre })) return null;
  const uploader = readable(item.user?.name || item.user?.handle);
  const originalCandidate = candidateOriginalFromUpload({ title: item.title, uploader, description: item.description, tags: item.tags, remixOf: item.remix_of });
  if (checkProvenance && !originalCandidate) return null;
  const cleaned = parsedCredit(item.title);
  const genre = requestedGenre === 'all' ? mapAudiusGenre(item.genre) : validGenre(requestedGenre);
  const permalink = String(item.permalink || '');
  const link = /^\/[A-Za-z0-9_\-/%]+$/.test(permalink)
    ? `https://audius.co${permalink}` : `https://audius.co/tracks/${encodeURIComponent(item.id)}`;
  const rawArt = item.artwork?.['480x480'] || item.artwork?.['150x150'] || item.artwork?.['1000x1000'];
  return {
    id: `audius:${item.id}`, title: cleaned.creditedArtist && !checkProvenance ? readable(item.title) : cleaned.title, artist: uploader,
    genre, mood: MOODS[item.genre] || 'Fresh', tags: [genre], source: 'audius', originalCandidate, language: trackLanguage({language:item.language, title:item.title, tags:item.tags}),
    artwork: typeof rawArt === 'string' && /^https:\/\//.test(rawArt) ? rawArt : null,
    link, license: 'Streamed via Audius. Rights remain with the artist and applicable rights holders.',
  };
}

export function parseAudiusCursor(cursor) {
  if (typeof cursor !== 'string' || !/^[0-4]:\d{1,6}$/.test(cursor)) return { phase: 0, offset: 0 };
  const [phase, offset] = cursor.split(':').map(Number);
  return { phase, offset: offset > 50000 ? 0 : offset };
}

function headers() {
  return { Accept: 'application/json', 'User-Agent': 'Aftertone/0.2 (music discovery prototype)' };
}
async function requestAudius(url, fetcher, apiKey) {
  // Identification is supported for public read-only usage; API keys are optional.
  url.searchParams.set(apiKey ? 'api_key' : 'app_name', apiKey || 'aftertone');
  const response = await fetcher(url, { headers: headers(), signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`Audius HTTP ${response.status}`);
  const payload = await response.json();
  if (payload?.error) throw new Error(`Audius: ${typeof payload.error === 'string' ? payload.error : 'unexpected response'}`);
  return payload.data;
}

/**
 * Four trending time windows plus deep recent-track searching. A finite API
 * cannot provide literally infinite tracks; cursors progress without repeats
 * until the source has no additional music or its service limit is reached.
 */
export async function fetchAudiusPage(genre = 'all', cursor = '0:0', fetcher = fetch, apiKey = '', search = '', checkProvenance = true) {
  genre = validGenre(genre);
  let { phase, offset } = parseAudiusCursor(cursor);
  if (search) phase = SEARCH_PHASE;
  if (phase > SEARCH_PHASE || offset >= 50000) return { tracks: [], nextCursor: null, hasMore: false, provider: 'audius' };
  let data = [];
  let tries = 0;
  while (phase <= SEARCH_PHASE && tries < 5) {
    tries++;
    const url = new URL(phase === SEARCH_PHASE ? `${BASE}/tracks/search` : `${BASE}/tracks/trending`);
    url.searchParams.set('limit', String(PAGE_SIZE));
    url.searchParams.set('offset', String(offset));
    if (genre !== 'all' && !search) url.searchParams.set('genre', GENRE[genre] || 'Alternative');
    if (phase === SEARCH_PHASE) { url.searchParams.set('sort_method', 'recent'); if (search) url.searchParams.set('query', search.slice(0, 90)); }
    else url.searchParams.set('time', PHASES[phase]);
    data = await requestAudius(url, fetcher, apiKey);
    if (!Array.isArray(data)) throw new Error('Audius returned an invalid track list');
    const tracks = [...new Map(data.map(t => normalizeAudiusTrack(t, genre, checkProvenance)).filter(Boolean).map(t => [t.id, t])).values()];
    const fullPage = data.length >= PAGE_SIZE;
    const next = fullPage ? { phase, offset: offset + data.length } : { phase: phase + 1, offset: 0 };
    const hasMore = next.phase <= SEARCH_PHASE && next.offset < 50000;
    if (tracks.length) return { tracks, nextCursor: hasMore ? `${next.phase}:${next.offset}` : null, hasMore, provider: 'audius' };
    ({ phase, offset } = next);
  }
  const hasMore = phase <= SEARCH_PHASE && offset < 50000;
  return { tracks: [], nextCursor: hasMore ? `${phase}:${offset}` : null, hasMore, provider: 'audius' };
}

export async function resolveAudiusAudio(trackId, fetcher = fetch, apiKey = '') {
  if (!isAudiusId(trackId)) return null;
  const url = new URL(`${BASE}/tracks/${encodeURIComponent(trackId)}`);
  const data = await requestAudius(url, fetcher, apiKey);
  if (!playable(data)) return null;
  // The 'provenance' discovery preference must never be re-applied to playback.
  // A previously discovered or saved recording must remain playable when the
  // provider serves it, even if its metadata changes or the preference changes.
  const track = normalizeAudiusTrack(data, 'all', false);
  if (!track) return null;
  // First attempt uses the official Audius streaming endpoint directly.
  const stream = new URL(`${BASE}/tracks/${encodeURIComponent(trackId)}/stream`);
  stream.searchParams.set(apiKey ? 'api_key' : 'app_name', apiKey || 'aftertone');
  return { url: stream.href, fallbackUrl: `/api/audius-stream?id=${encodeURIComponent(trackId)}`, license: track.license, attribution: track.artist, page: track.link };
}
