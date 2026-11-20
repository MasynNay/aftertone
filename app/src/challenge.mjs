/** Public challenges contain only provider song IDs, never personal taste data.
 * Preserve compatibility with existing v1 Commons/Jamendo/Audius links.
 */
const LEGACY_ID=/^(commons|jamendo|audius):[\w-]{1,120}$/;
const DEEZER_ID=/^deezer:[1-9]\d{0,19}$/;
export const isShareableChallengeId=id=>typeof id==='string' && (DEEZER_ID.test(id)||LEGACY_ID.test(id));
export const isPublicDeezerChallengeId=id=>typeof id==='string' && DEEZER_ID.test(id);

export function encodeChallenge(ids) {
  if(!Array.isArray(ids))return '';
  const cleaned=[...new Set(ids)].filter(isShareableChallengeId).slice(0,5);
  return cleaned.length ? 'v1.'+cleaned.join('~') : '';
}
export function decodeChallenge(value) {
  if(typeof value!=='string' || value.length>256 || !value.startsWith('v1.'))return [];
  const ids=value.slice(3).split('~');
  if(ids.length<1 || ids.length>5 || ids.some(id=>!isShareableChallengeId(id)))return [];
  return [...new Set(ids)];
}
/** Bound direct Deezer metadata lookup to five distinct numeric IDs. */
export function parseDeezerChallengeIds(raw) {
  if(typeof raw!=='string' || raw.length>130)throw new Error('Invalid shared track IDs.');
  const ids=raw.split(',');
  if(!ids.length || ids.length>5 || ids.some(id=>!isPublicDeezerChallengeId(id)) ||
      new Set(ids).size!==ids.length)throw new Error('Invalid shared track IDs.');
  return ids;
}
