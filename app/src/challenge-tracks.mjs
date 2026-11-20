/** Resolve no more than five public Deezer recordings; never return audio files.
 * Unavailable recordings are omitted while original link order is retained.
 */
import {parseDeezerChallengeIds} from './challenge.mjs';
import {fetchDeezerTrackById} from './deezer.mjs';

export async function loadDeezerChallengeTracks(raw,fetcher=fetch) {
  const ids=parseDeezerChallengeIds(raw);
  const found=new Array(ids.length).fill(null);
  const errors=[];
  let cursor=0;
  async function worker() {
    while(cursor<ids.length) {
      const index=cursor++;
      try {found[index]=await fetchDeezerTrackById(ids[index].slice(7),fetcher);}
      catch(error) {
        if(error?.name==='AbortError')throw error;
        errors.push(error);
      }
    }
  }
  await Promise.all([worker(),worker()]);
  const tracks=found.filter(Boolean);
  if(!tracks.length && errors.length===ids.length)throw errors[0];
  return {tracks,requested:ids.length,unavailable:ids.length-tracks.length};
}
