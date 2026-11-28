/** Read-only Collection insight model.
 *
 * All counts reflect the full saved library, not just 40 visible tiles.
 * Never infer unknown genre/mood metadata, and never mutate storage.
 */
import {collectionFacets,collectionSearchKey} from './collection-pagination.mjs';

export function collectionInsights(tracks=[],favoriteIds=[],history=[],facets=collectionFacets(tracks,history)) {
  const artists=new Set();
  for(const track of tracks) {
    const label=typeof track?.artist==='string'?track.artist.trim():'';
    if(label && !['unknown','various artists'].includes(collectionSearchKey(label)))
      artists.add(collectionSearchKey(label));
  }
  const savedIds=new Set(tracks.map(t=>t?.id).filter(Boolean));
  return {
    saved:favoriteIds.length,
    available:savedIds.size,
    missing:favoriteIds.filter(id=>!savedIds.has(id)).length,
    artists:artists.size,
    genres:facets.genres.length,
    moods:facets.moods.length,
    topGenres:facets.genres.slice(0,4),
    topMoods:facets.moods.slice(0,4),
  };
}
