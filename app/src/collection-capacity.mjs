/** Shared session/backup limits. Existing favorites are never evicted to make
 * room for a newly saved track. Old unreferenced metadata may be reclaimed. */
export const MAX_FAVORITE_IDS=5000;
export const MAX_SAVED_TRACKS=1500;
export const MAX_HISTORY=5000;

/** Prepare an atomic Collection addition or metadata repair. Returns a new
 * session or throws before storage/UI mutation. Existing favorites can be
 * restored from legacy backups even when some titles are unavailable. */
export function addCollectionTracks(state,tracks=[]) {
  const favorites=[...new Set(state.favorites)];
  const ids=new Set(favorites);
  const metadata=new Map(state.savedTracks.map(t=>[t.id,t]));
  for(const track of tracks) {
    if(!track?.id || typeof track.title!=='string' || !track.title.trim() ||
      typeof track.artist!=='string'||!track.artist.trim())
      throw new Error('Song metadata is unavailable; your Collection has not changed.');
    if(!ids.has(track.id)){ids.add(track.id);favorites.push(track.id);}
    if(!metadata.has(track.id))metadata.set(track.id,track);
  }
  if(favorites.length>MAX_FAVORITE_IDS)
    throw new Error('Collection is full (5,000 saved song IDs). Export a backup or remove a song before adding more.');
  if(metadata.size>MAX_SAVED_TRACKS) {
    for(const id of metadata.keys()) {
      if(metadata.size<=MAX_SAVED_TRACKS)break;
      if(!ids.has(id))metadata.delete(id);
    }
  }
  if(metadata.size>MAX_SAVED_TRACKS)
    throw new Error('Collection metadata is full (1,500 songs). Remove a saved song before adding another. No existing favorites were removed.');
  return {...state,favorites,savedTracks:[...metadata.values()]};
}
