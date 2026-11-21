import {isPublicDeezerChallengeId} from './challenge.mjs';
import {MAX_CHALLENGE_TRACKS} from './challenge-draft.mjs';

export const CHALLENGE_DRAFT_KEY='aftertone:shared-challenge-draft:v1';
const FORMAT_VERSION=1;
const MAX_STORED_BYTES=384;

/** Draft storage is intentionally session-scoped, not part of the user
 * profile/backup or the public URL. Only up to five validated public Deezer IDs
 * are ever serialized; no previews, names, source tokens or history.
 */
function validIds(ids) {
  return Array.isArray(ids) && ids.length<=MAX_CHALLENGE_TRACKS &&
    ids.every(isPublicDeezerChallengeId) && new Set(ids).size===ids.length;
}

export function readChallengeDraft(storage) {
  try {
    const raw=storage?.getItem(CHALLENGE_DRAFT_KEY);
    if(raw==null || typeof raw!=='string' || raw.length>MAX_STORED_BYTES)return null;
    const parsed=JSON.parse(raw);
    if(!parsed || typeof parsed!=='object' || Array.isArray(parsed) ||
       parsed.version!==FORMAT_VERSION || !validIds(parsed.ids))return null;
    return [...parsed.ids]; // [] means the listener intentionally cleared all.
  }catch{return null;} // Blocked/disabled storage must not block discovery.
}

export function saveChallengeDraft(storage,ids) {
  if(!validIds(ids))return false;
  try {
    storage?.setItem(CHALLENGE_DRAFT_KEY,JSON.stringify({
      version:FORMAT_VERSION,ids:[...ids]
    }));
    return Boolean(storage);
  }catch{return false;}
}

export function clearChallengeDraft(storage) {
  try{ storage?.removeItem(CHALLENGE_DRAFT_KEY);return Boolean(storage); }
  catch{return false;}
}
