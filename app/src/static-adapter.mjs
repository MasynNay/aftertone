/**
 * Static-site adapter for AFTERTONE's original API contract.
 *
 * GitHub Pages has no server-side code. Deezer's public metadata API exposes
 * JSONP; we request that API directly (only api.deezer.com is allowed), and
 * leave playback on Deezer's CDN without caching/redistribution.
 *
 * JSONP executes code served by Deezer. Do not use this adapter with third-
 * party/untrusted hosts or authenticated requests. For a fully server-backed
 * deployment prefer the original Node.js server and provider authorization.
 */
import {fetchDeezerPage,resolveDeezerPreview} from './deezer.mjs';
import {fetchRelatedArtists as fetchDeezerRelatedArtists} from './related-artists.mjs';
import {importPlaylistLink} from './playlist-links.mjs';
import {lookupLyrics} from './lyrics.mjs';
import {STARTER_TRACKS,GENRES} from './catalog.mjs';

const HOST='https://api.deezer.com';
let requestSerial=0;
const TIMEOUT_MS=10000;

/**
 * Call only the public Deezer API, never a caller-supplied script domain.
 * Callback names are generated internally, not taken from URL parameters.
 */
export function deezerJSONP(input,{signal,timeoutMs=TIMEOUT_MS}={}){
  const u=new URL(String(input),HOST);
  if(u.origin!==HOST || u.username || u.password || u.port || !/^\/[a-z0-9/_.%-]+$/i.test(u.pathname)){
    return Promise.reject(new Error('Blocked an unexpected Deezer API URL'));
  }
  if(signal?.aborted) return Promise.reject(new DOMException('Request canceled','AbortError'));
  const callback=`__aftertoneDeezer_${++requestSerial}`;
  u.searchParams.set('output','jsonp');u.searchParams.set('callback',callback);
  // Each caller owns its own callback, timeout and abort lifecycle.
  // Sharing a Promise lets one listener abort another identical request.
  const promise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    let completed=false,timer;
    function finish(error,payload){
      if(completed)return;
      completed=true;
      clearTimeout(timer);
      signal?.removeEventListener('abort',abort);
      script.remove();
      try{delete window[callback];}catch{window[callback]=undefined;}
      if(error)reject(error);else resolve(payload);
    }
    const abort=()=>finish(new DOMException('Request canceled','AbortError'));
    window[callback]=payload=>finish(null,payload);
    script.onerror=()=>finish(new Error('Deezer catalog was unreachable. Please try again.'));
    timer=setTimeout(()=>finish(new Error('Deezer did not respond. Try again.')),timeoutMs);
    signal?.addEventListener('abort',abort,{once:true});
    script.async=true;
    script.referrerPolicy='no-referrer';
    script.src=u.href;
    document.head.append(script);
  });
  return promise;
}

async function deezerFetch(url,options={}){
  const data=await deezerJSONP(url,options);
  return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
}
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});

async function routeApi(url){
  const p=url.searchParams;
  try{
    if(url.pathname==='/api/health')return json({status:'ok',name:'AFTERTONE',version:'0.10.1',mode:'static-deezer'});
    if(url.pathname==='/api/catalog')return json({tracks:STARTER_TRACKS,count:STARTER_TRACKS.length,live:true,genres:GENRES,provider:'deezer',providers:['deezer'],expandable:true,youtubeConfigured:false,featuredCount:0,note:'Live Deezer catalog metadata; on-demand preview audio from Deezer. No music files are hosted by AFTERTONE.'});
    if(url.pathname==='/api/discover'){
      if((p.get('source')||'deezer')!=='deezer')return json({error:'Only Deezer discovery is configured on this public site.'},400);
      const result=await fetchDeezerPage(p.get('genre')||'all',p.get('cursor')||'0',deezerFetch,p.get('q')||'',p.get('language')||'all',p.get('era')||'any',p.get('seed_artist')||'');
      return json(result);
    }
    if(url.pathname==='/api/audio'){
      const id=p.get('id')||'';
      if(!/^deezer:[1-9]\d{0,19}$/.test(id))return json({error:'Preview unavailable for this track.'},404);
      return json(await resolveDeezerPreview(id.slice(7),deezerFetch));
    }
    if(url.pathname==='/api/related-artists')return json(await fetchDeezerRelatedArtists(p.get('artist')||'',deezerFetch));
    if(url.pathname==='/api/playlist-link')return json(await importPlaylistLink(p.get('url')||'',deezerFetch));
    if(url.pathname==='/api/lyrics'){
      // Browser-safe public LRCLIB calls, no embedded key or restricted headers.
      const fetcher=(link,options={})=>fetch(link,{headers:{Accept:'application/json','Lrclib-Client':'AFTERTONE/0.10'},signal:options.signal});
      return json(await lookupLyrics({artist:p.get('artist')||'',title:p.get('title')||'',duration:Number(p.get('duration'))||0},fetcher));
    }
    return json({error:'Endpoint unavailable on static hosting.'},404);
  }catch(error){
    const code=error?.code==='SPOTIFY_AUTH_REQUIRED'?422:502;
    return json({error:String(error?.message||'Music service unavailable').slice(0,260)},code);
  }
}

/** Fetch original API routes. Local Node development still uses the server. */
export function apiFetch(input,options){
  const url=new URL(typeof input==='string'?input:input.url,location.href);
  if(!url.pathname.startsWith('/api/'))return fetch(input,options);
  if(['localhost','127.0.0.1'].includes(location.hostname)&&location.port==='4173')return fetch(input,options);
  return routeApi(url);
}
