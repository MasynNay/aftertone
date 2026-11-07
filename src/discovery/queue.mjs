/**
 * Pick an honest, playable queue when a strict discovery path has no tracks.
 *
 * Why this exists: v0.9.1 could exhaust a user's provider searches even
 * while dozens of playable, not-yet-heard Deezer songs were already loaded.
 * First use the path's strict artist policy; when it yields zero, prefer a
 * narrow fallback rather than strand the player. The UI displays the reason.
 * Explicit searches are handled by the caller and bypass this policy.
 */
import { filterPoolForPath, familiarArtistKeys } from './mode-engine.mjs';
import { artistKey } from './rotation.mjs';

export function selectAvailablePath(pool, mode='balanced', context={}) {
  const all=Array.isArray(pool)?pool:[];
  const ideal=filterPoolForPath(all,mode,context);
  if (!all.length) return {tracks:[],broadened:false,reason:null};

  const familiar=familiarArtistKeys(context);
  const isFamiliar=track=>{
    const key=artistKey(track.artist);
    return familiar.saved.has(key)||familiar.seeds.has(key)||familiar.related.has(key);
  };
  // Fallback is always derived from already playable results, never an
  // invented artist graph or an unrelated outside provider.
  const novel=all.filter(track=>!isFamiliar(track));
  const near=all.filter(isFamiliar);
  // The legacy Comfort policy falls back to the entire pool internally.
  // Detect that fallback explicitly so listeners see an accurate explanation.
  if(ideal.length && (mode!=='familiar' || near.length))
    return {tracks:ideal,broadened:false,reason:null};
  if (mode==='familiar') return {
    tracks: near.length?near:all, broadened:true,
    reason:'Your saved artists are still being found. Playing other available songs while we search nearby artists.',
  };
  if(mode==='balanced') return {
    tracks:novel.length?novel:all, broadened:true,
    reason:'Related-artist results are still loading. Showing available Deezer discoveries in the meantime.',
  };
  return {
    tracks:novel.length?novel:all, broadened:true,
    reason:'Wild Card is looking for new performers. Playing available tracks until a new lane arrives.',
  };
}

/**
 * Shared discovery IDs contain provider results loaded in any non-search path.
 * A manual query is always scoped to that query's IDs; no search leakage.
 */
export function belongsToDiscoveryFeed(id,activeIds,sharedIds,searching=false) {
  return Boolean(activeIds?.has(id) || (!searching && sharedIds?.has(id)));
}
