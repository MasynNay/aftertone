/**
 * Zero-credential similar-artist discovery through Deezer's own artist graph.
 * This is a metadata API; it does not license streaming or game use.
 * Everything is bounded (input, timeouts, cache and results). On failure it
 * returns a clear empty relation so the client can play broader chart music.
 */
const API='https://api.deezer.com';
const cache=new Map();
const pending=new Map();
const CACHE_MS=6*60*60*1000;
const MAX_CACHE=180;
const short = value => String(value || '').trim().replace(/\s+/g,' ').slice(0,85);
const key = value => short(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').toLowerCase().trim();

async function fetchJson(path, params={}, fetcher=fetch) {
  const url=new URL(`${API}/${path}`);
  for(const [field,value] of Object.entries(params)) url.searchParams.set(field,String(value));
  const response=await fetcher(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(7000)});
  if(!response.ok) throw new Error(`Deezer related artists: HTTP ${response.status}`);
  const body=await response.json();
  if(body?.error) throw new Error(`Deezer related artists: ${String(body.error.message || 'unavailable').slice(0,120)}`);
  return body;
}

export function parseDeezerRelated(body, seed, limit=15) {
  const ids=new Set([key(seed)]);
  const neighbors=[];
  for (const entry of Array.isArray(body?.data) ? body.data : []) {
    const artist=short(entry?.name);
    const norm=key(artist);
    if (!artist || !norm || ids.has(norm) || /^(various artists|unknown artist)$/i.test(artist)) continue;
    if (!/^\d{1,20}$/.test(String(entry.id || ''))) continue;
    neighbors.push({artist,because:seed,deezerId:String(entry.id),fans:Math.max(0,Number(entry.nb_fan)||0),source:'Deezer related artists'});
    ids.add(norm);
    if(neighbors.length >= limit) break;
  }
  return neighbors;
}

async function requestRelated(artist, fetcher) {
  const search=await fetchJson('search/artist',{q:artist,limit:12},fetcher);
  const match=(search.data || []).find(item => key(item?.name) === key(artist));
  // No fuzzy "close enough" matches. A wrong artist creates an irrelevant feed.
  if(!match?.id) return {seed:artist,related:[],matched:false,source:'Deezer artist graph'};
  const response=await fetchJson(`artist/${encodeURIComponent(String(match.id))}/related`,{limit:24},fetcher);
  return {seed:artist,related:parseDeezerRelated(response,artist),matched:true,source:'Deezer artist graph'};
}

export async function fetchDeezerRelatedArtists(raw,fetcher=fetch) {
  const artist=short(raw);
  if(artist.length<2 || /[<>\u0000-\u001f]/.test(artist) || /^https?:\/\//i.test(artist)) throw new Error('Choose a valid artist name.');
  const norm=key(artist);
  const cached=cache.get(norm);
  if(cached && cached.expires>Date.now()) return cached.result;
  if(pending.has(norm)) return pending.get(norm);
  const promise=requestRelated(artist,fetcher).then(result=>{
    if(cache.size>=MAX_CACHE) cache.delete(cache.keys().next().value);
    cache.set(norm,{result,expires:Date.now()+CACHE_MS});
    return result;
  }).finally(()=>pending.delete(norm));
  pending.set(norm,promise);
  return promise;
}
