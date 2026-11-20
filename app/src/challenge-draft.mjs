import {isPublicDeezerChallengeId} from './challenge.mjs';

export const MAX_CHALLENGE_TRACKS = 5;
export const CHALLENGE_SEARCH_PAGE_SIZE = 40;

/**
 * Only explicitly saved, currently loaded, valid Deezer recordings qualify.
 * Newest saved first. The draft/link never includes preview URLs or personal data.
 */
export function eligibleChallengeTracks(favorites=[],catalog=[]) {
  const available=new Map(catalog
    .filter(track=>track?.source==='deezer' && isPublicDeezerChallengeId(track.id))
    .map(track=>[track.id,track]));
  return [...new Set([...favorites].reverse())]
    .map(id=>available.get(id)).filter(Boolean);
}

export function defaultChallengeDraft(eligible=[]) {
  return eligible.slice(0,MAX_CHALLENGE_TRACKS).map(track=>track.id);
}

export function reconcileChallengeDraft(draft=[],eligible=[]) {
  const allowed=new Set(eligible.map(track=>track.id));
  return [...new Set(draft)]
    .filter(id=>allowed.has(id)).slice(0,MAX_CHALLENGE_TRACKS);
}

export function toggleChallengeDraft(draft,id,eligible) {
  const selected=reconcileChallengeDraft(draft,eligible);
  if(selected.includes(id))return selected.filter(entry=>entry!==id);
  if(!eligible.some(track=>track.id===id) ||
     selected.length>=MAX_CHALLENGE_TRACKS)return selected;
  return [...selected,id];
}

export function moveChallengeDraft(draft,id,direction,eligible) {
  const selected=reconcileChallengeDraft(draft,eligible);
  const index=selected.indexOf(id);
  const next=index+direction;
  if(index<0 || ![-1,1].includes(direction) ||
      next<0 || next>=selected.length)return selected;
  [selected[index],selected[next]]=[selected[next],selected[index]];
  return selected;
}

export function matchingChallengeTracks(eligible,query='',limit=CHALLENGE_SEARCH_PAGE_SIZE) {
  const term=String(query).trim().toLocaleLowerCase();
  const matching=term
    ? eligible.filter(track=>(track.artist+' '+track.title).toLocaleLowerCase().includes(term))
    : eligible;
  return {tracks:matching.slice(0,limit),total:matching.length};
}
