import {isPublicDeezerChallengeId} from './challenge.mjs';
import {addCollectionTracks} from './collection-capacity.mjs';
export const RECOVERY_BATCH_SIZE=5;
const valid=track=>Boolean(track?.id&&typeof track.title==='string'&&track.title.trim()&&typeof track.artist==='string'&&track.artist.trim());
/** Work from exact saved IDs, including songs that appear in the session
 * catalog but are not yet durable. Never turn a search match into a favorite. */
export function collectionRecoveryPlan(state,catalog=[],attempted=new Set()) {
  const durable=new Set(state.savedTracks.filter(valid).map(t=>t.id));
  const local=new Map(catalog.filter(valid).map(t=>[t.id,t]));
  const missing=[...new Set(state.favorites)].filter(id=>!durable.has(id));
  const recoverable=missing.filter(id=>local.has(id)||isPublicDeezerChallengeId(id));
  let pending=recoverable.filter(id=>!attempted.has(id));
  const retry=Boolean(recoverable.length&&!pending.length);
  if(retry)pending=recoverable;
  const ids=pending.slice(0,RECOVERY_BATCH_SIZE);
  return {missing:missing.length,recoverable:recoverable.length,unsupported:missing.length-recoverable.length,
    ids,local:ids.map(id=>local.get(id)).filter(Boolean),remote:ids.filter(id=>!local.has(id)),retry};
}
/** Only explicitly requested, still-favorited identities may be repaired.
 * A canceled or removed favorite cannot be resurrected by a late reply. */
export function prepareRecoveredFavorites(state,ids,tracks) {
  const requested=new Set(ids),favoriteIds=new Set(state.favorites);
  const seen=new Set(state.savedTracks.filter(valid).map(t=>t.id));
  const recovered=[];
  for(const track of tracks||[]) {
    if(!valid(track)||!requested.has(track.id)||!favoriteIds.has(track.id)||seen.has(track.id))continue;
    seen.add(track.id);recovered.push(track);
  }
  if(!recovered.length)return {next:state,tracks:[]};
  return {next:addCollectionTracks(state,recovered),tracks:recovered};
}
