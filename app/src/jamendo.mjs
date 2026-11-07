/** Jamendo search provider. Requires the developer's own API client ID. */
import { validGenre } from './live-commons.mjs';
import { parsedCredit, candidateOriginalFromUpload, readable, likelyMusicRecording, trackLanguage } from './recording-quality.mjs';
const genreTags = { all: '', hiphop: 'hiphop', cinematic: 'soundtrack', ambient: 'ambient', indie: 'indie', electronic: 'electronic', classical: 'classical' };
const genreMood = { ambient: 'Dreamy', electronic: 'Focused', classical: 'Reflective', rock: 'Bold', pop: 'Bright', jazz: 'Warm', funk: 'Bright', hiphop: 'Bold', folk: 'Warm', indie: 'Reflective', cinematic: 'Mysterious' };
const cache = new Map();
const TTL = 10 * 60 * 1000;

export function normalizeJamendoTrack(item, genre, checkProvenance = true) {
  if (!item?.id || !item.name || !item.artist_name || !/^https:\/\//.test(item.audio || '') || !likelyMusicRecording({ title:item.name, tags:item.musicinfo?.tags?.vartags, duration:item.duration })) return null;
  const originalCandidate = candidateOriginalFromUpload({ title: item.name, uploader: item.artist_name });
  if (checkProvenance && !originalCandidate) return null;
  return {
    id: `jamendo:${item.id}`, title: parsedCredit(item.name).title, artist: readable(item.artist_name),
    genre, mood: genreMood[genre] || 'Fresh', tags: [genre, ...(item.musicinfo?.tags?.vartags || []).slice(0, 2)],
    source: 'jamendo', originalCandidate, language: trackLanguage({language:item.musicinfo?.lang || item.language || item.lang, title:item.name}), vocal: item.musicinfo?.vocalinstrumental || 'unknown', artwork: /^https:\/\//.test(item.image || '') ? item.image : null,
    audio: item.audio, link: item.shareurl || `https://www.jamendo.com/track/${item.id}`,
    license: item.license_ccurl || 'See Jamendo for Creative Commons license',
  };
}

/** Cursors are numeric offsets; the caller owns per-genre cursor state. */
export async function fetchJamendoPage(clientId, genre, cursor = '0', fetcher = fetch, search = '', checkProvenance = true, language = 'all') {
  if (!clientId) throw new Error('A Jamendo developer client ID is required.');
  genre = validGenre(genre);
  const offset = /^\d{1,6}$/.test(String(cursor)) ? Math.min(Number(cursor), 100000) : 0;
  const url = new URL('https://api.jamendo.com/v3.0/tracks/');
  const params = {
    client_id: clientId, format: 'json', limit: '60', offset: String(offset),
    order: 'popularity_month', include: 'licenses+musicinfo', audioformat: 'mp31', imagesize: '300',
  };
  if (genre !== 'all') params.tags = genreTags[genre] ?? genre;
  if (search) params.namesearch = search.slice(0, 90);
  // Jamendo documents `lang` as a server-side lyrical language filter.
  if (language !== 'all' && language !== 'en') params.lang = language === 'en-strict' ? 'en' : language;
  url.search = new URLSearchParams(params).toString();
  const response = await fetcher(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Jamendo HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.headers?.status !== 'success') throw new Error(payload.headers?.error_message || 'Jamendo rejected the request');
  const items = payload.results || [];
  const tracks = [...new Map(items.map((t) => normalizeJamendoTrack(t, genre, checkProvenance)).filter(Boolean).map(t => {
    // The Jamendo `lang=en` filter applies to lyrical language. Preserve that
    // provider-confirmed information even when no field is present on a track.
    if ((language === 'en-strict' || (!['all','en'].includes(language))) && t.language === 'unknown') t.language = language === 'en-strict' ? 'en' : language;
    return [t.id, t];
  })).values()];
  const hasMore = items.length >= 60 && offset < 99940;
  return { tracks, nextCursor: hasMore ? String(offset + items.length) : null, hasMore, provider: 'jamendo' };
}

/** Compatibility wrapper used by the initial bundled catalog. */
export async function fetchJamendoCatalog(clientId, fetcher = fetch) {
  if (!clientId) return [];
  const cached = cache.get(clientId);
  if (cached && cached.until > Date.now()) return cached.tracks;
  const genres = ['rock', 'electronic', 'pop', 'hiphop', 'jazz', 'folk'];
  const responses = await Promise.allSettled(genres.map((genre) => fetchJamendoPage(clientId, genre, '0', fetcher)));
  const tracks = [...new Map(responses.filter((r) => r.status === 'fulfilled').flatMap((r) => r.value.tracks).map((t) => [t.id, t])).values()];
  if (!tracks.length) throw new Error('Jamendo returned no available tracks. Check JAMENDO_CLIENT_ID.');
  cache.set(clientId, { until: Date.now() + TTL, tracks });
  return tracks;
}

export async function fetchJamendoById(clientId, id, fetcher = fetch) {
  if (!clientId || !/^\d{1,15}$/.test(String(id))) return null;
  const url = new URL('https://api.jamendo.com/v3.0/tracks/');
  url.search = new URLSearchParams({ client_id: clientId, format: 'json', id: String(id), include: 'licenses' }).toString();
  const response = await fetcher(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Jamendo HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.headers?.status !== 'success') throw new Error(payload.headers?.error_message || 'Jamendo rejected the request');
  // Resolving a saved track must not impose today's discovery preference again.
  return normalizeJamendoTrack(payload.results?.[0], 'all', false);
}
