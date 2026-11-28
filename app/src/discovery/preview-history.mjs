/** Recent neutral preview navigation is session-only and scoped to a feed.
 * No ratings, audio files, provider requests or private metadata are stored. */
export const MAX_RECENT_PREVIEWS=20;
export function rememberUnratedPreview(ids=[],id) {
  if(typeof id!=='string'||!id)return ids.slice(-MAX_RECENT_PREVIEWS);
  return [...ids.filter(value=>value!==id),id].slice(-MAX_RECENT_PREVIEWS);
}
export function previousUnratedPreview(ids=[],eligible=()=>true) {
  for(let i=ids.length-1;i>=0;i--)if(eligible(ids[i]))return ids[i];
  return null;
}
export function removeUnratedPreview(ids=[],id) {
  return ids.filter(value=>value!==id);
}
