/**
 * Optional LRCLIB line-synchronized lyrics for LOCAL prototyping only.
 * This module does not bundle lyrics. A public product must obtain the
 * appropriate lyric reproduction/display rights separately.
 *
 * Important: Deezer's preview URL has NO documented absolute song offset.
 * Thus UI must explicitly ask the user to calibrate preview start position;
 * audio.currentTime is relative to the excerpt, not the complete recording.
 */
const BASE = 'https://lrclib.net/api/get';
const cache = new Map();
const CACHE_MAX = 90;
const TIMEOUT_MS = 8000;
const MIN_REQUEST_GAP_MS = 400;
let nextRequestAt = 0;
let lastRateLimitedUntil = 0;
const normalized = s => String(s || '').toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));

export function parseLrc(source) {
  const lines = [];
  for (const raw of String(source || '').slice(0,160_000).split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    const words = raw.replace(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g,'').trim();
    if (!stamps.length || !words) continue;
    for (const stamp of stamps) {
      const time = Number(stamp[1])*60 + Number(stamp[2]) + Number(`0.${String(stamp[3] || '0').padEnd(2,'0')}`);
      if (Number.isFinite(time) && time>=0 && time<=3600) lines.push({time:Math.round(time*100)/100,text:words.slice(0,250)});
    }
    if(lines.length >= 600) break;
  }
  return lines.sort((a,b)=>a.time-b.time).slice(0,600);
}

export function lineAt(lines, previewTime, offset=0) {
  const target = Math.max(0,Number(previewTime)||0) + Math.max(0,Number(offset)||0);
  if(!Array.isArray(lines)) return null;
  let match = null;
  for(const line of lines) {
    if(line.time > target) break;
    match = line;
  }
  return match;
}

export async function lookupLyrics({artist,title,duration},fetcher=fetch,now=()=>Date.now()) {
  const who = String(artist||'').trim().slice(0,110);
  const song = String(title||'').trim().slice(0,140);
  if(!who || !song) return {status:'unavailable',lines:[]};
  const key = normalized(who)+'|'+normalized(song)+'|'+String(Math.round(Number(duration)||0));
  const remembered = cache.get(key);
  if(remembered && remembered.expire>now()) return remembered.value;
  if(now()<lastRateLimitedUntil) return {status:'rate-limited',lines:[]};
  // Sequential requests and short delay respect LRCLIB's published client rules.
  const delay = Math.max(0,nextRequestAt-now());
  if(delay) await sleep(delay);
  nextRequestAt = now()+MIN_REQUEST_GAP_MS;
  const u = new URL(BASE);
  u.searchParams.set('artist_name',who);
  u.searchParams.set('track_name',song);
  if(Number.isFinite(duration) && duration>0 && duration<3601) u.searchParams.set('duration',String(Math.round(duration)));
  let value;
  try {
    const response=await fetcher(u.href, {headers:{'Accept':'application/json','User-Agent':'AFTERTONE/0.7 (local desktop prototype)','Lrclib-Client':'AFTERTONE/0.7'},signal:AbortSignal.timeout(TIMEOUT_MS)});
    if(response.status === 429) {
      const retry = Math.max(10,Math.min(3600,Number(response.headers?.get('retry-after')) || 60));
      lastRateLimitedUntil = now()+retry*1000;
      return {status:'rate-limited',lines:[]};
    }
    if(response.status === 404) value={status:'unavailable',lines:[]};
    else if(!response.ok) value={status:'error',lines:[]};
    else {
      const result=await response.json();
      const match=normalized(result.artistName) === normalized(who) && normalized(result.trackName) === normalized(song);
      const lines=match ? parseLrc(result.syncedLyrics) : [];
      value={status: lines.length ? 'available':'unavailable',lines,source:'LRCLIB',duration:Number(result.duration)||null};
    }
  } catch { value={status:'error',lines:[]}; }
  if(cache.size>=CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key,{value,expire:now()+(value.status==='available'?900_000:120_000)});
  return value;
}
