import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STARTER_TRACKS, GENRES } from './src/catalog.mjs';
import { resolveCommonsAudio } from './src/commons.mjs';
import { fetchJamendoById, fetchJamendoPage } from './src/jamendo.mjs';
import { fetchCommonsDiscovery, validGenre } from './src/live-commons.mjs';
import { fetchAudiusPage, resolveAudiusAudio } from './src/audius.mjs';
import { configuredYouTubeKey, fetchYouTubePage } from './src/youtube.mjs';
import { fetchChartHitsPage } from './src/chart-hits.mjs';
import { fetchAdFreeHitsPage } from './src/library-hits.mjs';
import { fetchFeaturedPage, FEATURED_VIDEOS } from './src/featured-hits.mjs';
import { fetchDeezerPage, resolveDeezerPreview } from './src/deezer.mjs';
import { fetchRelatedArtists } from './src/related-artists.mjs';
import { importPlaylistLink } from './src/playlist-links.mjs';
import { lookupLyrics } from './src/lyrics.mjs';
import { jellyfinSettings, fetchJellyfinPage, jellyfinHeaders, jellyfinUrl, isJellyfinId } from './src/jellyfin.mjs';
import { Readable } from 'node:stream';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(ROOT, 'public');
const TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.mjs', 'text/javascript; charset=utf-8'],
  ['.svg', 'image/svg+xml'], ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'], ['.ico', 'image/x-icon'],
]);

function json(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(body));
}

const discoveryCache = new Map();
const HAS_JELLYFIN = () => Boolean(jellyfinSettings());
const HAS_YOUTUBE = () => Boolean(configuredYouTubeKey());
const DISCOVERY_TTL_MS = 8 * 60 * 1000;

function catalog() {
  const jamendo = Boolean(process.env.JAMENDO_CLIENT_ID?.trim());
  return { tracks: STARTER_TRACKS, count: STARTER_TRACKS.length, live: true, genres: GENRES,
    provider: 'deezer', youtubeConfigured: HAS_YOUTUBE(), featuredCount: new Set(FEATURED_VIDEOS.map(row => row[0])).size, providers: ['deezer', 'featured', ...(HAS_YOUTUBE() ? ['youtube', 'charts'] : []), ...(HAS_JELLYFIN() ? ['library-hits','jellyfin'] : []), 'audius', ...(jamendo ? ['jamendo'] : []), 'commons'], expandable: true,
    note: 'The supplied count is the offline fallback shelf, not the total available online.' };
}

async function discover(params, fetcher = fetch) {
  const genre = validGenre(params.get('genre') || 'all');
  const requested = params.get('source');
  const hasJamendo = Boolean(process.env.JAMENDO_CLIENT_ID?.trim());
  const hasJellyfin = HAS_JELLYFIN();
  const allowed = ['deezer', 'featured', 'audius', 'commons', ...(hasJamendo ? ['jamendo'] : []), ...(hasJellyfin ? ['library-hits', 'jellyfin'] : []), ...(HAS_YOUTUBE() ? ['youtube', 'charts'] : [])];
  if (requested && !allowed.includes(requested)) throw new Error(`Source "${requested}" is not configured.`);
  const provider = requested || 'deezer';
  const query = String(params.get('q') || '').trim().slice(0, 90);
  const strict = params.get('strict') === '1' || Boolean(query) || provider === 'jellyfin' || provider === 'library-hits';
  const language = ['en','en-strict','all','es','fr','pt','de','it','ja','ko','zh','hi','ar','ru'].includes(params.get('language')) ? params.get('language') : 'all';
  const era = ['any','1980s','1990s','2000s','2010s','2020s'].includes(params.get('era')) ? params.get('era') : 'any';
  const discovery = ['hits','variety'].includes(params.get('discovery')) ? params.get('discovery') : 'hits';
  const seedArtist = String(params.get('seed_artist') || '').trim().slice(0,75);
  const defaults = { deezer:'0', featured:'0', audius: '0:0', jamendo: '0', commons: '0:0', jellyfin: '0', 'library-hits':'0', youtube: '', charts: '0' };
  const cursor = String(params.get('cursor') || defaults[provider]).slice(0, 180);
  const key = `${provider}:${genre}:${cursor}:${query}:${strict}:${language}:${era}:${discovery}:${seedArtist}`;
  const found = discoveryCache.get(key);
  if (found?.until > Date.now()) return found.data;

  const fallback = { deezer:null, featured:null, charts: null, youtube: null, audius: hasJamendo ? 'jamendo' : 'commons', jamendo: 'commons', commons: null, jellyfin: null, 'library-hits':null };
  async function fetchPage(source, fromCursor) {
    if (source === 'deezer') return fetchDeezerPage(genre, fromCursor, fetcher, query, language, era, seedArtist);
    if (source === 'featured') return fetchFeaturedPage(genre, fromCursor, query, language, era);
    if (source === 'charts') {
      if (genre !== 'all') throw new Error('Ranked charts do not provide genre tags. Select All genres or choose YouTube official artist discovery for genre filtering.');
      return fetchChartHitsPage(fromCursor, fetcher, configuredYouTubeKey(), language, query);
    }
    if (source === 'youtube') return fetchYouTubePage(genre, fromCursor, fetcher, configuredYouTubeKey(), query, false, language, era, discovery, seedArtist);
    if (source === 'audius') return fetchAudiusPage(genre, fromCursor, fetcher, process.env.AUDIUS_API_KEY?.trim(), query, false);
    if (source === 'jamendo') return fetchJamendoPage(process.env.JAMENDO_CLIENT_ID.trim(), genre, fromCursor, fetcher, query, false, language);
    if (source === 'library-hits') {
      if (query) return fetchJellyfinPage(jellyfinSettings(), genre, fromCursor, fetcher, query, false);
      return fetchAdFreeHitsPage(jellyfinSettings(), genre, fromCursor, fetcher);
    }
    if (source === 'jellyfin') return fetchJellyfinPage(jellyfinSettings(), genre, fromCursor, fetcher, query, false);
    return fetchCommonsDiscovery(genre, fromCursor, fetcher);
  }

  let data, source = provider, fromCursor = cursor;
  let warning = '';
  for (let attempt = 0; attempt < (strict ? 1 : 3) && source; attempt++) {
    try {
      data = await fetchPage(source, fromCursor);
      if (data.tracks.length || data.hasMore || !fallback[source] || strict) break;
      warning = `${source} has no further matches for ${genre}; trying ${fallback[source]}.`;
    } catch (error) {
      if (strict || !fallback[source]) throw error;
      warning = `${source} unavailable (${error.message}); trying ${fallback[source]}.`;
    }
    source = fallback[source];
    fromCursor = defaults[source];
  }
  // English preferred is a ranking preference, not a hard block. In older
  // versions the server silently discarded foreign-language results even when
  // metadata was uncertain. Exact-language choices require supplied metadata.
  if (data && language !== 'all' && provider !== 'deezer') {
    if (language === 'en') data.tracks.sort((a, b) => Number(b.language === 'en') - Number(a.language === 'en'));
    else data.tracks = data.tracks.filter(t => t.language === (language === 'en-strict' ? 'en' : language));
  }
  if (warning && data) data.warning = warning;
  if (discoveryCache.size > 90) discoveryCache.delete(discoveryCache.keys().next().value);
  discoveryCache.set(key, { until: Date.now() + DISCOVERY_TTL_MS, data });
  return data;
}

async function proxyJellyfin(req, res, path, fetcher, mime = 'application/octet-stream') {
  const settings = jellyfinSettings();
  if (!settings) return json(res, 404, { error: 'Your Jellyfin library is not connected.' });
  const url = jellyfinUrl(settings, path);
  const controller = new AbortController();
  const headers = jellyfinHeaders(settings);
  if (req.headers.range) headers.Range = req.headers.range;
  let remote;
  try {
    remote = await fetcher(url, { headers, signal: controller.signal });
    if (!remote.ok || !remote.body) return json(res, remote.status === 404 ? 404 : 502, { error: `Jellyfin media returned HTTP ${remote.status}` });
    const responseHeaders = {
      'Content-Type': remote.headers.get('content-type') || mime,
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    };
    for (const header of ['content-range', 'accept-ranges', 'content-length']) {
      const value = remote.headers.get(header);
      if (value) responseHeaders[header] = value;
    }
    res.writeHead(remote.status, responseHeaders);
    res.once('close', () => controller.abort());
    Readable.fromWeb(remote.body).on('error', () => res.end()).pipe(res);
  } catch (error) {
    if (!res.headersSent) json(res, 502, { error: `Jellyfin media unavailable: ${error.message}` });
  }
}

/** Optional local Audius stream fallback for browsers that cannot play the provider redirect.
 * Only a validated Audius track ID is accepted; URLs are constructed server-side.
 * Streams are piped with no disk storage, conversion, or caching. */
async function proxyAudius(req, res, id, fetcher = fetch) {
  if (!/^[A-Za-z0-9_-]{2,45}$/.test(id || '')) return json(res, 400, { error: 'Invalid Audius track ID' });
  const target = new URL(`https://api.audius.co/v1/tracks/${encodeURIComponent(id)}/stream`);
  const apiKey = process.env.AUDIUS_API_KEY?.trim();
  target.searchParams.set(apiKey ? 'api_key' : 'app_name', apiKey || 'aftertone');
  const controller = new AbortController();
  const headers = { Accept: 'audio/mpeg, audio/*, application/octet-stream' };
  if (req.headers.range && /^bytes=\d*-\d*$/.test(req.headers.range)) headers.Range = req.headers.range;
  try {
    const remote = await fetcher(target, { headers, signal: controller.signal, redirect: 'follow' });
    if (!remote.ok || !remote.body) return json(res, 502, { error: `Audius could not stream this track (HTTP ${remote.status})` });
    const type = (remote.headers?.get('content-type') || 'audio/mpeg').split(';')[0];
    if (!/^(audio\/|application\/octet-stream)/i.test(type)) return json(res, 502, { error: 'Audius returned something other than an audio stream' });
    const responseHeaders = {
      'Content-Type': type, 'Cache-Control': 'no-store, private',
      'X-Content-Type-Options': 'nosniff', 'Access-Control-Allow-Origin': 'http://127.0.0.1:4173',
    };
    for (const header of ['content-range', 'accept-ranges', 'content-length']) {
      const value = remote.headers?.get(header);
      if (value) responseHeaders[header] = value;
    }
    res.writeHead(remote.status, responseHeaders);
    res.once('close', () => controller.abort());
    Readable.fromWeb(remote.body).on('error', () => res.end()).pipe(res);
  } catch (error) {
    if (!res.headersSent) json(res, 502, { error: `Audius streaming failed: ${error.message}` });
  }
}

async function route(req, res, fetcher = fetch) {
  const url = new URL(req.url || '/', 'http://localhost');
  if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Method not allowed' });
  if (url.pathname === '/api/health') return json(res, 200, { status: 'ok', name: 'Aftertone', version: '0.10.1' });
  if (url.pathname === '/api/catalog') return json(res, 200, catalog());
  if (url.pathname === '/api/playlist-link') {
    try { return json(res, 200, await importPlaylistLink(url.searchParams.get('url') || '', fetcher)); }
    catch (error) { return json(res, error.code === 'SPOTIFY_AUTH_REQUIRED' ? 422 : 400, {error:error.message, code:error.code || 'IMPORT_FAILED'}); }
  }
  // Optional synchronized lyrics. Requested only when the listener turns on
  // lyrics; never bundled or persisted. Preview-to-song offset is unknown.
  if (url.pathname === '/api/lyrics') {
    const artist=(url.searchParams.get('artist') || '').slice(0,110);
    const title=(url.searchParams.get('title') || '').slice(0,140);
    if (!artist || !title) return json(res,400,{status:'unavailable',lines:[]});
    const duration=Number(url.searchParams.get('duration')) || 0;
    return json(res,200,await lookupLyrics({artist,title,duration},fetcher));
  }
  if (url.pathname === '/api/related-artists') {
    const artist = String(url.searchParams.get('artist') || '').trim();
    try { return json(res, 200, await fetchRelatedArtists(artist, fetcher)); }
    catch (error) { return json(res, 502, { error: `Related-artist lookup unavailable: ${error.message}`, seed: artist, related: [] }); }
  }
  if (url.pathname === '/api/discover') {
    try { return json(res, 200, await discover(url.searchParams, fetcher)); }
    catch (error) { return json(res, 502, { error: `The music source did not respond: ${error.message}` }); }
  }
  if (url.pathname === '/api/audius-stream') return proxyAudius(req, res, url.searchParams.get('id') || '', fetcher);
  if (url.pathname === '/api/jellyfin-art' || url.pathname === '/api/jellyfin-stream') {
    const id = url.searchParams.get('id') || '';
    if (!isJellyfinId(id)) return json(res, 400, { error: 'Invalid media ID' });
    return proxyJellyfin(req, res,
      url.pathname === '/api/jellyfin-art' ? `Items/${id}/Images/Primary?maxWidth=600&quality=80` : `Audio/${id}/stream?static=true`,
      fetcher, url.pathname === '/api/jellyfin-art' ? 'image/jpeg' : 'audio/mpeg');
  }
  if (url.pathname === '/api/audio') {
    const id = url.searchParams.get('id') || '';
    try {
      if (/^deezer:[1-9]\d{0,19}$/.test(id)) return json(res, 200, await resolveDeezerPreview(id.slice(7), fetcher));
      if (id.startsWith('commons:')) return json(res, 200, await resolveCommonsAudio(id, fetcher));
      if (id.startsWith('audius:')) {
        const track = await resolveAudiusAudio(id.slice('audius:'.length), fetcher, process.env.AUDIUS_API_KEY?.trim());
        if (!track) return json(res, 404, { error: 'Track not available on Audius' });
        return json(res, 200, track);
      }
      if (id.startsWith('jellyfin:') && isJellyfinId(id.slice('jellyfin:'.length)) && HAS_JELLYFIN()) {
        return json(res, 200, { url: `/api/jellyfin-stream?id=${id.slice('jellyfin:'.length)}`, license: 'Your personal Jellyfin collection', attribution: '', page: '' });
      }
      if (id.startsWith('jamendo:')) {
        const track = await fetchJamendoById(process.env.JAMENDO_CLIENT_ID?.trim(), id.slice('jamendo:'.length), fetcher);
        if (!track) return json(res, 404, { error: 'Track not available' });
        return json(res, 200, { url: track.audio, license: track.license, attribution: track.artist, page: track.link });
      }
      return json(res, 404, { error: 'Unknown track' });
    } catch (error) {
      return json(res, error.status || 502, { error: 'Audio is temporarily unavailable', detail: error.message });
    }
  }
  if (url.pathname.startsWith('/api/')) return json(res, 404, { error: 'Unknown endpoint' });

  // Only the public directory and the browser-safe pure modules are web-accessible.
  let candidate;
  if (url.pathname.startsWith('/src/')) candidate = resolve(ROOT, `.${decodeURIComponent(url.pathname)}`);
  else candidate = resolve(PUBLIC, `.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`);
  const inPublic = candidate.startsWith(`${PUBLIC}${sep}`);
  const inShared = candidate.startsWith(`${resolve(ROOT, 'src')}${sep}`) && extname(candidate) === '.mjs';
  if (!inPublic && !inShared) return json(res, 403, { error: 'Forbidden' });
  try {
    const fileStats = await stat(candidate);
    if (!fileStats.isFile()) throw new Error('Not a file');
    const bytes = await readFile(candidate);
    res.writeHead(200, {
      'Content-Type': TYPES.get(extname(candidate)) || 'application/octet-stream',
      'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    });
    res.end(req.method === 'HEAD' ? undefined : bytes);
  } catch {
    json(res, 404, { error: 'Page not found' });
  }
}

export function createServer({ fetcher = fetch } = {}) {
  return http.createServer((req, res) => {
    route(req, res, fetcher).catch((error) => {
      console.error('Request failed:', error);
      if (!res.headersSent) json(res, 500, { error: 'Internal server error' });
      else res.end();
    });
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 4173;
  const host = process.env.HOST || '127.0.0.1';
  createServer().listen(port, host, () => {
    console.log(`\n  ◉ AFTERTONE  →  http://${host}:${port}\n  Press Ctrl+C to stop.\n`);
  });
}
