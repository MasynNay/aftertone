/** Deezer catalog metadata and short-lived public preview links.
 * Preview URLs are not stored or proxied. Permission for music-game deployment
 * must be obtained from Deezer before public release.
 */
import { validGenre } from './live-commons.mjs';
import { displayTitle, looksLikeCoverOrEdit, likelyMusicRecording, canonicalArtist } from './recording-quality.mjs';
import { seedLanes } from './youtube.mjs';

const API='https://api.deezer.com';
const PAGE_SIZE=25;
const CHART_PAGES=3;
const LANES_LIMIT=240;
const safeCursor = (v) => /^(0|[1-9]\d{0,3})$/.test(String(v)) && Number(v)<500 ? Number(v) : 0;
const validLanguage = new Set(['all','en','en-strict','es','fr','pt','de','it','ja','ko','zh','hi','ar','ru']);
const forbiddenWords = /\b(?:karaoke|tribute|cover|remix|instrumental version|re-recorded|sped up|slowed|nightcore|concert|live recording|piano version|parody)\b/i;

export function normalizeDeezerTrack(item, { genre='all', language='unknown', era='any', artist='' }={}) {
  const id=String(item?.id || '');
  const who=String(item?.artist?.name || '').trim();
  const title=displayTitle(item?.title || item?.title_short || '');
  if (!/^\d{1,20}$/.test(id) || !title || !who || item.readable === false ||
      !likelyMusicRecording({title,duration:item.duration}) || forbiddenWords.test(title) ||
      looksLikeCoverOrEdit(title) || (artist && canonicalArtist(who)!==canonicalArtist(artist))) return null;
  // The provider's artist/album ID is considerably stronger provenance than an
  // uploader's filename, but doesn't certify that every version is the master.
  const preview = validDeezerPreview(item.preview);
  if (!preview) return null; // Never place an unplayable song in discovery.
  const link = /^https:\/\/www\.deezer\.com\//.test(item.link || '') ? item.link : `https://www.deezer.com/track/${id}`;
  const art=item.album?.cover_xl || item.album?.cover_big || item.album?.cover_medium || null;
  // Some Deezer endpoints include an album release date; most search pages do
  // not. Only explicit ISO dates count for decade-specific tournaments.
  const date=String(item.album?.release_date || item.release_date || '');
  const providerGenre=String(item.genre?.name || item.album?.genre?.name || '').toLowerCase();
  const genreVerified=['pop','rock'].includes(providerGenre);
  const releaseYear=/^\d{4}-\d{2}-\d{2}$/.test(date) ? Number(date.slice(0,4)) : null;
  return { id:`deezer:${id}`, source:'deezer', deezerId:id, title, artist:who,
    // 'all genres' is NOT 'pop'. Deezer chart/search doesn't provide a
    // dependable per-track genre; unknown is more truthful than a fake pop tag.
    uploader:who, genre:genreVerified ? providerGenre : genre==='all' ? 'unknown' : genre, genreVerified, mood:'Fresh', tags:[],
    language:'unknown', inferredLanguage:language,
    era, releaseYear, duration:Number(item.duration || 0), artwork: art && /^https:\/\//.test(art) ? art : null,
    link, rank:Number(item.rank || 0),
    license:'Deezer catalog metadata and 30-second public preview. Public game use requires provider authorization.' };
}


// Signed Deezer preview URLs are temporary; never cache or persist them.
export function validDeezerPreview(raw) {
  try {
    const u = new URL(String(raw || ''));
    return u.protocol === 'https:' && (u.hostname === 'dzcdn.net' || u.hostname.endsWith('.dzcdn.net')) ? u.href : null;
  } catch { return null; }
}

export async function resolveDeezerPreview(id, fetcher = fetch) {
  if (!/^[1-9]\d{0,19}$/.test(String(id))) throw new Error('Invalid Deezer track ID');
  const response = await fetcher(`${API}/track/${id}`, {headers:{Accept:'application/json'},signal:AbortSignal.timeout(9000)});
  if (!response.ok) throw new Error(`Deezer preview returned HTTP ${response.status}`);
  const item = await response.json();
  const url = validDeezerPreview(item.preview);
  if (!url) throw new Error('Deezer has no playable preview for this track');
  return {url, ttlSeconds:480, license:'Preview served from Deezer CDN; obtain game-use authorization before publishing', page:`https://www.deezer.com/track/${id}`};
}

async function deezerGet(path, params, fetcher) {
  const url = new URL(`${API}/${path}`);
  for (const [k,v] of Object.entries(params)) if(v!==undefined && v!==null) url.searchParams.set(k,String(v));
  const response=await fetcher(url, {headers:{Accept:'application/json'},signal:AbortSignal.timeout(9000)});
  if(!response.ok) throw new Error(`Deezer returned HTTP ${response.status}. The public catalog may be unavailable in your region or network.`);
  const result=await response.json();
  if(result?.error) throw new Error(`Deezer catalog rejected this request: ${result.error.message || result.error.code || 'unavailable'}`);
  if(!Array.isArray(result?.data)) throw new Error('Deezer returned no catalog data.');
  return result;
}

/**
 * Artist identity lookup. Deezer's `artist:"Name"` free-text syntax can return
 * zero records for popular performers; resolve a verified artist ID first and
 * request the provider's own /artist/:id/top listing instead.
 *
 * Cache only real fetch calls. Mocked fetchers must remain test-isolated.
 */
const ARTIST_CACHE_TTL = 10 * 60 * 1000;
const artistCache = new Map();
async function findExactArtist(name, fetcher) {
  const key=canonicalArtist(name);
  if (!key) return null;
  const cached=fetcher === fetch ? artistCache.get(key) : null;
  if(cached && cached.until>Date.now()) return cached.promise;
  const promise=(async()=>{
    const result=await deezerGet('search/artist',{q:name,limit:12},fetcher);
    const match=result.data.find(row=>/^\d+$/.test(String(row?.id||'')) && canonicalArtist(row?.name)===key);
    return match ? {id:String(match.id),name:String(match.name)} : null;
  })();
  if(fetcher===fetch) {
    if(artistCache.size>=128) artistCache.delete(artistCache.keys().next().value);
    artistCache.set(key,{until:Date.now()+ARTIST_CACHE_TTL,promise});
    promise.catch(()=>artistCache.delete(key));
  }
  return promise;
}

/**
 * Resolve an artist into ranked tracks, not a fuzzy free-text result set.
 * If the artist index is unavailable, fall back to plain search and KEEP ONLY
 * exact artist matches (never a misleading similarly named performer).
 */
async function fetchArtistTracks(name,page,fetcher,knownArtist=null) {
  const offset=page*PAGE_SIZE;
  let direct=null;
  try {
    const artist=knownArtist || await findExactArtist(name,fetcher);
    if(artist) direct=await deezerGet(`artist/${artist.id}/top`,{limit:PAGE_SIZE,index:offset},fetcher);
  } catch { /* Fallback to a ranked plain query below. */ }
  // An artist's top list can have no previews in a particular market. Don't
  // leave the listener staring at an empty route when ranked search works.
  if(direct?.data.some(row=>validDeezerPreview(row?.preview) && canonicalArtist(row?.artist?.name)===canonicalArtist(name)))
    return {result:direct,verified:true};
  return {result:await deezerGet('search',{q:name,limit:PAGE_SIZE,index:offset},fetcher),verified:false};
}

/**
 * Zero-credential discovery. Global charts lead; artist-based ranked searches
 * replenish the catalog after the initial chart pages. Artist and language
 * choices are search SEEDS, not a claim that vocals were linguistically verified.
 */
export async function fetchDeezerPage(genre='all', cursor='0', fetcher=fetch, query='', language='all', era='any', seedArtist='') {
  genre=validGenre(genre);
  language=validLanguage.has(language) ? language : 'all';
  const page=safeCursor(cursor);
  const search=String(query || '').trim().slice(0,90);
  const artistSeed=String(seedArtist || '').trim().slice(0,75);
  const useChart = !search && !artistSeed && genre==='all' && language==='all' && era==='any' && page<CHART_PAGES;
  let result, laneArtist='', laneLang='unknown', selectedGenre=genre, artistPage=false;
  let cursorPage=page;
  if(useChart) {
    result=await deezerGet('chart/0/tracks',{limit:PAGE_SIZE,index:page*PAGE_SIZE},fetcher);
  } else if(search) {
    // An exact artist name should return that artist's top tracks immediately.
    // Song-title searches still use ranked Deezer track search.
    const eligible=/^[\p{L}\p{N} .&'’_-]{2,75}$/u.test(search);
    const artist=eligible ? await findExactArtist(search,fetcher).catch(()=>null) : null;
    if(artist) {
      laneArtist=artist.name;
      ({result}=await fetchArtistTracks(artist.name,page,fetcher,artist));
      artistPage=true;
    } else result=await deezerGet('search',{q:search,limit:PAGE_SIZE,index:page*PAGE_SIZE,order:'RANKING'},fetcher);
  } else {
    // Curated real-artist lanes rather than loosely matching song filenames.
    const lanes=seedLanes(genre,language,era).filter(l=>l.artist);
    if(!artistSeed && !lanes.length) return {tracks:[],provider:'deezer',hasMore:false,nextCursor:null,note:'No artist seeds for this combination. Try All languages.'};
    const basePage=artistSeed ? page : genre==='all'&&language==='all'&&era==='any' ? Math.max(0,page-CHART_PAGES) : page;
    const chosen=artistSeed ? {artist:artistSeed,language:'unknown',genre} : lanes[Math.floor(basePage / 2) % lanes.length];
    laneArtist=chosen.artist;
    laneLang=chosen.language || 'unknown';
    selectedGenre=chosen.genre || genre;
    cursorPage=basePage%2;
    ({result}=await fetchArtistTracks(laneArtist,cursorPage,fetcher));
    artistPage=true;
  }
  const tracks=result.data.map(t=>normalizeDeezerTrack(t,{genre:selectedGenre,language:laneLang,era,artist:laneArtist})).filter(Boolean);
  // Some catalog endpoints advertise a larger `total` even for sparse pages.
  // Trust an explicit next link or a full page before requesting another one.
  const pageHasNext=Boolean(result.next) || result.data.length===PAGE_SIZE;
  const next=page+1;
  const hasMore = search ? pageHasNext && result.data.length>0 : artistSeed ? page<3 && pageHasNext && result.data.length>0 : next < (genre==='all'&&language==='all'&&era==='any' ? CHART_PAGES+LANES_LIMIT : LANES_LIMIT);
  return {tracks,provider:'deezer',hasMore,nextCursor:hasMore?String(next):null,
    total:Number.isFinite(result.total)?result.total:null,
    note:useChart ? 'Popular Deezer charts. Track previews are loaded on demand from Deezer’s public catalog.' : artistPage ? 'Artist-matched Deezer tracks from its artist catalog. Short previews require permission for public game use.' : 'Ranked Deezer track search. Short previews require permission for public game use.'};
}
