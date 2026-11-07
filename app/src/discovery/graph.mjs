/**
 * Extend an artist graph without looping back to the five initial favorites.
 * Group-by-parent round robin prevents the first seed's 15 neighbors from
 * crowding out all the other seed artists' connections.
 */
import {artistKey} from './rotation.mjs';

export function mergeRelatedArtists(existing=[],incoming=[],startingArtists=[],because='',max=90) {
  const blocked=new Set(startingArtists.map(artistKey));
  const result=[];
  const seen=new Set(blocked);
  // Recent deliberate likes get first claim on our bounded 90-neighbor pool.
  for(const entry of [...incoming,...existing]) {
    const artist=String(entry?.artist||'').trim().slice(0,85);
    const key=artistKey(artist);
    if(!key || seen.has(key) || /^unknown|various artists$/i.test(artist)) continue;
    const parent=String(entry.because || because || '').trim().slice(0,85);
    result.push({artist,because:parent,source:'Deezer related artists'});
    seen.add(key);
    if(result.length>=max) break;
  }
  return result;
}

export function interleaveArtistBranches(related=[],max=64) {
  const groups=new Map();
  for (const entry of related) {
    const parent=artistKey(entry.because);
    if(!groups.has(parent)) groups.set(parent,[]);
    groups.get(parent).push(entry);
  }
  const result=[];
  while(result.length<max) {
    let added=0;
    for(const entries of groups.values()) {
      if(!entries.length) continue;
      result.push(entries.shift());added++;
      if(result.length>=max) break;
    }
    if(!added) break;
  }
  return result;
}
