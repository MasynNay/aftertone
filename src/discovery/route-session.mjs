/**
 * Session-scoped music routing. Avoid the v0.9.2 bug where newly selected paths
 * immediately showed tracks from a globally shared queue before their own
 * Deezer requests had even finished.
 *
 * Route fetch results are authoritative. Shared discoveries are a last-resort
 * fallback only after the route has had a chance to fetch its own first page.
 * User-entered searches are always isolated to that search's returned IDs.
 */
import { selectAvailablePath } from './queue.mjs';

export function selectRouteQueue({pool=[],feedIds=new Set(),primed=false,loading=false,mode='balanced',context={},searching=false}={}) {
  const loaded=Array.isArray(pool)?pool:[];
  const native=loaded.filter(track=>feedIds.has(track.id));
  if(searching) return {tracks:native,broadened:false,reason:null,origin:'search'};
  if((!primed || loading) && !native.length) return {tracks:[],broadened:false,reason:null,origin:'loading'};
  if(native.length) {
    const chosen=selectAvailablePath(native,mode,context);
    if(chosen.tracks.length) return {...chosen,origin:'path'};
  }
  if(!primed) return {tracks:[],broadened:false,reason:null,origin:'loading'};
  const backup=selectAvailablePath(loaded,mode,context);
  return {
    ...backup,origin:'fallback',broadened:Boolean(backup.tracks.length),
    reason:backup.tracks.length
      ? 'That path needs more matching tracks. Playing other unheard Deezer songs while it searches.'
      : backup.reason,
  };
}

/** Only the active request may modify what the listener is seeing. */
export function isActiveRequest(requestFeed,currentFeed) {
  return requestFeed===currentFeed;
}
