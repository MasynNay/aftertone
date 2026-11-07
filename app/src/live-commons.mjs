/**
 * Live audio discovery via the Wikimedia Commons MediaWiki search API.
 * No API key is needed. This is search, not a licensed commercial music catalog:
 * availability, metadata and genre accuracy vary from upload to upload.
 * We request only audio files and return original source attribution.
 */
import { GENRES } from './catalog.mjs';

export const SEARCH_LANES = Object.freeze({
  all: ['music filetype:audio', 'song filetype:audio', 'instrumental filetype:audio', 'melody filetype:audio'],
  pop: ['"pop music" filetype:audio', '"pop song" filetype:audio', '"synthpop" filetype:audio', '"indie pop" filetype:audio'],
  rock: ['"rock music" filetype:audio', '"rock song" filetype:audio', '"alternative rock" filetype:audio'],
  indie: ['"indie music" filetype:audio', '"indie rock" filetype:audio', '"indie folk" filetype:audio'],
  electronic: ['"electronic music" filetype:audio', '"techno" filetype:audio', '"synthesizer" filetype:audio', '"EDM" filetype:audio'],
  hiphop: ['"hip hop" filetype:audio', '"rap song" filetype:audio', '"hip-hop" filetype:audio'],
  ambient: ['"ambient music" filetype:audio', '"chillout" filetype:audio', '"new age music" filetype:audio'],
  jazz: ['"jazz music" filetype:audio', '"jazz composition" filetype:audio', '"swing music" filetype:audio'],
  funk: ['"funk music" filetype:audio', '"funky" filetype:audio', '"soul music" filetype:audio'],
  folk: ['"folk music" filetype:audio', '"acoustic guitar" filetype:audio', '"folk song" filetype:audio'],
  cinematic: ['"soundtrack" filetype:audio', '"cinematic music" filetype:audio', '"film score" filetype:audio'],
  classical: ['"classical music" filetype:audio', '"piano sonata" filetype:audio', '"symphony" filetype:audio'],
});
const MIME = new Set(['audio/mpeg', 'audio/ogg', 'audio/opus', 'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/flac', 'audio/x-flac', 'application/ogg']);
const MAX_FILE_BYTES = 36 * 1024 * 1024;
export function validGenre(value) { return GENRES.includes(value) ? value : 'all'; }
export function parseCursor(value) {
  if (typeof value !== 'string' || !/^\d{1,2}:\d{1,5}$/.test(value)) return { lane: 0, offset: 0 };
  const [lane, offset] = value.split(':').map(Number);
  if (lane > 20 || offset > 9500) return { lane: 0, offset: 0 };
  return { lane, offset };
}
export function encodeCursor({ lane, offset }) { return `${lane}:${offset}`; }
const safeText = (value) => String(value ?? '')
  .replace(/<[^>]*>/g, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'").replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);

export function normalizeCommonsFile(page, genre) {
  const info = page?.imageinfo?.[0];
  if (!Number.isInteger(page?.pageid) || page.pageid <= 0 || !info?.url || !MIME.has(info.mime) ||
      (Number(info.size) > MAX_FILE_BYTES) || !/^https:\/\/upload\.wikimedia\.org\//.test(info.url)) return null;
  const rawName = String(page.title || '').replace(/^File:/i, '');
  const title = safeText(rawName.replace(/\.(mp3|ogg|oga|opus|wav|flac|webm)$/i, '')
    .replace(/_/g, ' ').replace(/\s*\(\s*(?:audio|music|recording)\s*\)$/i, ''));
  if (title.length < 3) return null;
  const artist = safeText(info.extmetadata?.Artist?.value) || 'Wikimedia Commons contributor';
  const license = safeText(info.extmetadata?.LicenseShortName?.value) || 'See source for license';
  return {
    id: `commons:file-${page.pageid}`, title, artist, genre, mood: 'Fresh', tags: [genre],
    source: 'commons', artwork: null, license,
    link: `https://commons.wikimedia.org/wiki/${encodeURIComponent(String(page.title || '').replaceAll(' ', '_'))}`,
  };
}

/** Fetch a bounded page of playable files. Cursors are provider-specific and opaque to the UI. */
export async function fetchCommonsDiscovery(genre, cursor = '0:0', fetcher = fetch) {
  genre = validGenre(genre);
  const lanes = SEARCH_LANES[genre];
  let { lane, offset } = parseCursor(cursor);
  if (lane >= lanes.length) return { tracks: [], nextCursor: null, hasMore: false, provider: 'commons' };
  // Search up to 3 lanes in one call if a particular search yields no usable audio.
  for (let attempts = 0; attempts < 3 && lane < lanes.length; attempts++) {
    const url = new URL('https://commons.wikimedia.org/w/api.php');
    url.search = new URLSearchParams({
      action: 'query', format: 'json', formatversion: '2', generator: 'search',
      gsrsearch: lanes[lane], gsrnamespace: '6', gsrlimit: '40', gsroffset: String(offset),
      prop: 'imageinfo', iiprop: 'url|mime|size|extmetadata',
    }).toString();
    const response = await fetcher(url, {
      headers: { 'User-Agent': 'Aftertone/0.2 (open-source attribution-aware music discovery demo)', Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Wikimedia Commons HTTP ${response.status}`);
    const payload = await response.json();
    if (payload.error) throw new Error(`Commons search: ${payload.error.info || payload.error.code || 'request rejected'}`);
    const pages = payload.query?.pages ?? [];
    const tracks = [...new Map(pages.map((page) => normalizeCommonsFile(page, genre)).filter(Boolean).map((t) => [t.id, t])).values()];
    const continuation = payload.continue?.gsroffset;
    const next = Number.isInteger(continuation) && continuation <= 9500 ? { lane, offset: continuation } : { lane: lane + 1, offset: 0 };
    if (tracks.length) return { tracks, nextCursor: next.lane < lanes.length ? encodeCursor(next) : null, hasMore: next.lane < lanes.length, provider: 'commons' };
    ({ lane, offset } = next);
  }
  return { tracks: [], nextCursor: lane < lanes.length ? encodeCursor({ lane, offset }) : null, hasMore: lane < lanes.length, provider: 'commons' };
}
