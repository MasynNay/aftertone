/**
 * Mainstream discovery identities (ListenBrainz and a small artist-released
 * starter lane) paired with audio the user personally hosts in Jellyfin.
 * No YouTube audio, bypasses, external playback or catalog impersonation.
 * Only Jellyfin tracks with BOTH matching title and artist are playable.
 */
import { FEATURED_VIDEOS } from './featured-hits.mjs';
import { sanitizeChartEntry } from './chart-hits.mjs';
import { jellyfinHeaders, jellyfinUrl, normalizeJellyfinTrack } from './jellyfin.mjs';
import { looksLikeCoverOrEdit } from './recording-quality.mjs';

const STATS = 'https://api.listenbrainz.org/1/stats/sitewide/recordings';
const BATCH = 16;
const MAX_OFFSET = 3200;
const normalize = (value) => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\b(feat\.?|ft\.?|featuring)\b.*$/i, '')
  .replace(/\([^)]*(?:remaster|live|version|radio edit|mono|stereo|edit|deluxe)[^)]*\)/gi, '')
  .replace(/\[[^\]]*(?:remaster|live|version|radio edit|mono|stereo|edit|deluxe)[^\]]*\]/gi, '')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase().replace(/\s+/g, ' ');

export function sameArtistAndSong(candidate, entry) {
  const wantedArtist = normalize(entry.artist), gotArtist = normalize(candidate.artist);
  const wantedTitle = normalize(entry.title), gotTitle = normalize(candidate.title);
  if (!wantedTitle || !wantedArtist || !gotTitle || !gotArtist) return false;
  const artistMatches = gotArtist === wantedArtist || gotArtist.startsWith(wantedArtist + ' ') || wantedArtist.startsWith(gotArtist + ' ');
  return artistMatches && gotTitle === wantedTitle && !looksLikeCoverOrEdit(candidate.title);
}

export function parseLibraryHitsCursor(value='0') {
  if (!/^(0|[1-9]\d{0,3})$/.test(String(value))) throw new Error('Invalid library hits cursor');
  const offset = Number(value);
  if (offset > MAX_OFFSET || offset % BATCH !== 0) throw new Error('Invalid library hits cursor');
  return offset;
}

export async function matchOwnRecording(settings, entry, fetcher = fetch, genre='all') {
  if (!settings || !entry?.artist || !entry?.title) return null;
  const url = jellyfinUrl(settings, settings.userId ? `Users/${settings.userId}/Items` : 'Items');
  url.search = new URLSearchParams({ Recursive:'true', IncludeItemTypes:'Audio', SearchTerm:String(entry.title).slice(0,90),
    Fields:'Genres,Images', Limit:'25', StartIndex:'0', EnableImages:'true' }).toString();
  const response = await fetcher(url, { headers:jellyfinHeaders(settings), signal:AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`Jellyfin search returned HTTP ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data.Items)) throw new Error('Jellyfin returned invalid search results');
  const candidates = data.Items.map(item => normalizeJellyfinTrack(item)).filter(Boolean);
  const match = candidates.find(item => sameArtistAndSong(item, entry) &&
    (genre === 'all' || (entry.genre && entry.genre === genre) || item.tags.includes(genre)));
  if (!match) return null;
  // We never pretend YouTube audio is being streamed. The only audio source is Jellyfin.
  return { ...match, genre:entry.genre || match.genre, tags:entry.genre ? [entry.genre] : match.tags, chartSource:entry.origin, chartListens:entry.listens || 0,
    discoveryReason:`${entry.origin} · playable from your library`, originalCandidate:true,
    license:'Playing your own Jellyfin recording. No YouTube ads or extraction.' };
}

export async function fetchAdFreeHitsPage(settings, genre='all', cursor='0', fetcher=fetch, query='') {
  if (!settings) throw new Error('Connect your own Jellyfin library to enable ad-free mainstream previews.');
  if (query) throw new Error('Artist searches use the standard Jellyfin catalog.');
  const offset = parseLibraryHitsCursor(cursor);
  const starters = offset === 0 ? FEATURED_VIDEOS.map(row => ({artist:row[1],title:row[2],genre:row[3],language:row[4],origin:'Curated artist-released song'})) : [];
  // Include public listening charts as song identities, not as audio sources.
  const chart = new URL(STATS);
  chart.search = new URLSearchParams({ count:String(BATCH), offset:String(offset), range:'all_time' }).toString();
  let chartRows = [];
  let rawRowCount = 0;
  let chartFailed = false;
  try {
    const response = await fetcher(chart, {headers:{Accept:'application/json','User-Agent':'AFTERTONE/0.4.2 (personal library music discovery)'}, signal:AbortSignal.timeout(12000)});
    if (!response.ok) throw new Error(`ListenBrainz charts returned HTTP ${response.status}`);
    const json = await response.json();
    if (!Array.isArray(json?.payload?.recordings)) throw new Error('Charts have no recording list');
    rawRowCount = json.payload.recordings.length;
    chartRows = json.payload.recordings.map(sanitizeChartEntry).filter(Boolean).map(row => ({...row,origin:'ListenBrainz chart'}));
  } catch { chartFailed = true; }
  const entries = [...starters.filter(row => genre === 'all' || row.genre === genre), ...chartRows];
  // Bounded concurrency. Don't download the user's library or store credentials in the browser.
  const results = [];
  const uniqueInput = [...new Map(entries.map(row => [normalize(row.artist)+'|'+normalize(row.title),row])).values()];
  let searchError = null;
  for (let i=0;i<uniqueInput.length;i+=4) {
    const group = await Promise.all(uniqueInput.slice(i,i+4).map(row =>
      matchOwnRecording(settings,row,fetcher,genre).catch(error => { searchError = error; return null; })));
    results.push(...group.filter(Boolean));
    if (searchError && !results.length && i>=8) break;
  }
  if (searchError && !results.length) throw new Error(`Your Jellyfin library could not be searched: ${searchError.message}`);
  const tracks = [...new Map(results.map(row=>[row.id,row])).values()];
  const nextCursor = !chartFailed && rawRowCount >= BATCH && offset + BATCH <= MAX_OFFSET ? String(offset+BATCH) : null;
  return { tracks, nextCursor, hasMore:Boolean(nextCursor), provider:'library-hits',
    note: chartFailed ? 'Charts are temporarily unavailable. Showing only curated songs that exist in your library.' :
    `${tracks.length} recognizable songs matched to your own audio library on this page. Only exact artist/title matches can play without ads.` };
}
