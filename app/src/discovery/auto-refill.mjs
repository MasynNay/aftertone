/** Adaptive catalog prefetch. A 3-second *check* is not a request storm.
 * It only fetches while the upcoming pool is below target and a provider is
 * still offering pages. Explicit upper bound protects long-running sessions.
 */
export const REFILL_INTERVAL_MS = 3000;
export const REFILL_TARGET = 160;
export const MAX_SESSION_TRACKS = 1200;
export function shouldRefill({ ready=0, loaded=0, loading=false, hasMore=true, visible=true, active=true, challenge=false }={}) {
  return Boolean(active && visible && !challenge && !loading && hasMore &&
    Number.isFinite(ready) && ready < REFILL_TARGET && loaded < MAX_SESSION_TRACKS);
}

/** Count only distinct eligible recordings after the active card, never
 * the currently displayed preview or a provider-wide catalog total. */
export function countUpcoming(tracks=[],currentId=null) {
  return new Set(tracks.filter(t=>t?.id&&t.id!==currentId).map(t=>t.id)).size;
}

/** A shared presentation model for the initial render and cheap DOM updates.
 * The 1,200-track bound is for automatic refills, not a permanent listening
 * limit: explicit requests and immediate empty-queue recovery can continue. */
export function queueStatus({ready=0,loaded=0,loading=false,hasMore=true,retryAt=0,
  searching=false,visible=true,active=true,now=Date.now(),sourceLabel='Music provider'}={}) {
  const safeCount=n=>Number.isSafeInteger(n)&&n>=0?n:0;
  ready=safeCount(ready);loaded=safeCount(loaded);
  let state='ready',message='Automatic refill is ready when the queue runs low.';
  if(loading){state='loading';message='Finding more matching songs…';}
  else if(!hasMore){state='exhausted';message='No more matching pages found. Try another search, path, or refill.';}
  else if(retryAt>now){state='cooldown';message='Automatic discovery is waiting before retrying. You can retry manually.';}
  else if(!active||!visible){state='paused';message='Automatic background refill is paused.';}
  else if(searching){state='search';message='Manual search · refill when you need more results.';}
  else if(loaded>=MAX_SESSION_TRACKS){state='bounded';message='Background queue limit reached. You can still find more songs manually.';}
  else if(ready<REFILL_TARGET){state='refill';message='Automatically looks for more matching songs.';}
  return {ready,loaded,state,message,loadedLabel:loaded+' loaded for this '+(searching?'search':'path')+' · '+sourceLabel};
}
