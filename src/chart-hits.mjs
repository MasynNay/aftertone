/**
 * Chart-backed discovery: ListenBrainz supplies real track/artist identities and
 * listening statistics; YouTube supplies the embedded VIDEO, when available.
 *
 * This is NOT a source of unrestricted audio files. It uses the official YouTube
 * Data API and only yields videos from artist-matched channels. It intentionally
 * returns zero tracks rather than silently switching to covers/Commons uploads.
 *
 * Search calls consume YouTube Data API quota (100 units each). Batches are small
 * and the API is guarded by a server cache; nothing is scraped or downloaded.
 */
import { normalizeYouTubeVideo, isYouTubeId, configuredYouTubeKey, fetchYouTubePage } from './youtube.mjs';
import { looksLikeCoverOrEdit, readable, uploaderMatchesArtist, likelyMusicRecording } from './recording-quality.mjs';

const STATS = 'https://api.listenbrainz.org/1/stats/sitewide/recordings';
const YOUTUBE = 'https://www.googleapis.com/youtube/v3';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BATCH = 4; // 4 YouTube searches per page, not 50; protect daily API quota.
const PAGE_CAP = 1000;
const cachesByFetcher = new WeakMap();
const ONE_HOUR = 60 * 60 * 1000;

function normalizeIdentity(value) {
  return readable(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase().replace(/\([^)]*(?:feat|remaster|mono|stereo)[^)]*\)/ig, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}
export function sameSongTitle(expected, actual) {
  const e = normalizeIdentity(expected), a = normalizeIdentity(actual);
  return Boolean(e && a && (a === e || a.startsWith(`${e} `) || a.endsWith(` ${e}`)));
}
export function sanitizeChartEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const artist = readable(entry.artist_name).slice(0, 100);
  const title = readable(entry.track_name || entry.recording_name).slice(0, 140);
  if (!artist || !title || !likelyMusicRecording({title}) || looksLikeCoverOrEdit(title) || artist.toLowerCase() === 'various artists') return null;
  const releaseId = UUID.test(entry.caa_release_mbid || '') ? entry.caa_release_mbid :
    UUID.test(entry.release_mbid || '') ? entry.release_mbid : null;
  return { artist, title, listens: Number(entry.listen_count || entry.total_listen_count || 0),
    cover: releaseId ? `https://coverartarchive.org/release/${releaseId}/front-500` : null };
}

async function json(fetcher, url, label) {
  const response = await fetcher(url, { headers: { Accept:'application/json', 'User-Agent':'AFTERTONE/0.3.8 (personal music discovery; ListenBrainz charts)' }, signal: AbortSignal.timeout(12000) });
  if (!response.ok) {
    if (response.status === 403 && label === 'YouTube') throw new Error('YouTube API quota exhausted or API access denied. No fallback to random songs.');
    throw new Error(`${label} returned HTTP ${response.status}`);
  }
  return response.json();
}

export function parseChartCursor(value = '') {
  if (!value) return 0;
  if (!/^(0|[1-9]\d{0,3})$/.test(value)) throw new Error('Invalid charts cursor');
  const num = Number(value);
  if (num > PAGE_CAP || num % BATCH) throw new Error('Invalid charts cursor');
  return num;
}

async function findOfficialVideo(chart, fetcher, apiKey, language) {
  const query = `${chart.artist} ${chart.title} official music video`;
  const search = new URL(`${YOUTUBE}/search`);
  search.search = new URLSearchParams({key:apiKey, part:'snippet', type:'video', videoCategoryId:'10',
    videoEmbeddable:'true', maxResults:'10', order:'relevance', q:query.slice(0, 120),
    ...(language === 'en' || language === 'en-strict' ? {relevanceLanguage:'en'} :
      language !== 'all' ? {relevanceLanguage:language} : {})}).toString();
  const searched = await json(fetcher, search, 'YouTube');
  const candidates = (Array.isArray(searched.items) ? searched.items : [])
    .filter(v => isYouTubeId(v?.id?.videoId) && uploaderMatchesArtist(chart.artist, v?.snippet?.channelTitle || ''))
    .slice(0, 10);
  if (!candidates.length) return null;
  const detailsUrl = new URL(`${YOUTUBE}/videos`);
  detailsUrl.search = new URLSearchParams({key:apiKey, part:'snippet,contentDetails,statistics,status',
    id:candidates.map(v=>v.id.videoId).join(',')}).toString();
  const detailRows = await json(fetcher, detailsUrl, 'YouTube');
  const details = new Map((detailRows.items || []).map(x => [x.id, x]));
  const normalized = candidates.map(item => normalizeYouTubeVideo(item, 'all', true, details.get(item.id.videoId), {
    expectedArtist:chart.artist, hitsOnly:false, explicitSearch:true,
  })).filter(v => v && sameSongTitle(chart.title, v.title) &&
    (language === 'all' || language === 'en' || v.language === (language === 'en-strict' ? 'en' : language)));
  const credible = normalized.filter(v => typeof v.views === 'number' && v.views >= 500000);
  credible.sort((a,b) => (b.views || 0)-(a.views || 0));
  const result = credible[0];
  if (!result) return null;
  return {...result, title:chart.title, artist:chart.artist, chartListens:chart.listens,
    artwork: chart.cover || result.artwork, chartArtwork: Boolean(chart.cover),
    genre:'all', mood:'Fresh', originalCandidate:true, chartSource:'ListenBrainz',
    license:'Ranked song identity: ListenBrainz. Video preview: official YouTube embed; uploads are not independently verified.'};
}

export async function fetchChartHitsPage(cursor = '', fetcher = fetch, key = '', language = 'all', search = '') {
  if (!configuredYouTubeKey({YOUTUBE_API_KEY:key})) throw new Error('YouTube Data API key required for chart video previews.');
  if (String(search || '').trim()) {
    // In chart mode, direct artist/song searches still work. Never pretend a
    // user-typed query came from the site's ranked chart.
    const result = await fetchYouTubePage('all', cursor === '0' ? '' : cursor, fetcher, key, search, true, language, 'any', 'hits');
    return {...result, provider:'charts', note:'Direct YouTube search. For ranked songs, clear the search box.'};
  }
  const offset = parseChartCursor(cursor);
  let chartCache = cachesByFetcher.get(fetcher);
  if (!chartCache) { chartCache = new Map(); cachesByFetcher.set(fetcher, chartCache); }
  const cacheKey = `${offset}:${language}`;
  const cached = chartCache.get(cacheKey);
  if (cached && cached.until > Date.now()) return cached.value;
  const stats = new URL(STATS);
  stats.search = new URLSearchParams({count:String(BATCH),offset:String(offset),range:'all_time'}).toString();
  const report = await json(fetcher, stats, 'ListenBrainz');
  const rows = report?.payload?.recordings;
  if (!Array.isArray(rows)) throw new Error('ListenBrainz chart did not include a recordings list.');
  const entries = rows.map(sanitizeChartEntry).filter(Boolean);
  let tracks = [];
  const errors = [];
  for (const entry of entries) {
    try {
      const match = await findOfficialVideo(entry, fetcher, key, language);
      if (match && !tracks.some(t => t.id === match.id)) tracks.push(match);
    } catch (error) {
      errors.push(error.message);
      if (/quota exhausted|API access denied/.test(error.message)) break;
    }
  }
  if (errors.length && !tracks.length && errors.some(msg=>/quota exhausted|API access denied/.test(msg))) throw new Error(errors.find(msg=>/quota exhausted|API access denied/.test(msg)));
  let usedArtistFallback = false;
  if (!tracks.length && rows.length) {
    // A public chart entry is metadata, not a license or a promise of an
    // embeddable original. Try an artist-focused music-video lane rather than
    // showing an unrelated cover, Commons clip, or a broken audio player.
    const artistLane = `s${Math.min(60, Math.floor(offset / BATCH))}~`;
    const alternate = await fetchYouTubePage('all', artistLane, fetcher, key, '', true, language, 'any', 'hits');
    tracks = alternate.tracks.map(track => ({...track,chartSource:'Official-artist discovery fallback'}));
    usedArtistFallback = tracks.length > 0;
  }
  // No Commons fallback: an unplayable ranked song is skipped, not swapped with
  // an unrelated track claiming the same artist/title.
  const nextCursor = rows.length === BATCH && offset + BATCH <= PAGE_CAP ? String(offset + BATCH) : null;
  const value = {tracks, nextCursor, hasMore:Boolean(nextCursor), provider:'charts',
    note: usedArtistFallback ? 'No embeddable originals matched this chart page. Showing artist-matched YouTube hits instead, never unrelated Commons uploads.' : 'ListenBrainz charts supply the song identities; the YouTube embeds provide videos. Matching is conservative and not every charted song is available.'};
  if (chartCache.size > 100) chartCache.delete(chartCache.keys().next().value);
  chartCache.set(cacheKey, {until:Date.now()+ONE_HOUR,value});
  return value;
}
