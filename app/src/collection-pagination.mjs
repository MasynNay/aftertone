/** Pure, bounded saved-music browsing and faceting.
 *
 * Search, genre, mood and sort apply to the ENTIRE Collection before paging.
 * Facet menus are derived from all saved tracks, not just the current 40 cards.
 * No UI state is persisted; exports and backups still include every song.
 */
export const COLLECTION_PAGE_SIZE = 40;

/** Music tags may be incomplete. Never invent a genre or mood to fill a facet. */
function facetLabel(value,empty='') {
  const label=typeof value==='string'?value.trim():'';
  return label && !['all','unknown'].includes(label.toLowerCase())?label:empty;
}
const rankedFacets=count=>[...count.entries()]
  .sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0]))
  .map(([value,count])=>({value,count}));

export function collectionFacets(tracks=[],history=[]) {
  // The last recorded decision carries the current Tune Lab mood, which
  // overrides the catalog mood shown on saved tiles.
  const eventById=new Map();
  for(const event of history)if(event?.id)eventById.set(event.id,event);
  const genres=new Map(),moods=new Map(),moodById=new Map();
  for(const track of tracks) {
    if(!track?.id)continue;
    const genre=facetLabel(track.genre);
    const mood=facetLabel(eventById.get(track.id)?.mood || track.mood);
    if(genre && genre.toLowerCase()!=='fresh')
      genres.set(genre,(genres.get(genre)||0)+1);
    if(mood && mood.toLowerCase()!=='fresh')
      moods.set(mood,(moods.get(mood)||0)+1);
    if(mood)moodById.set(track.id,mood);
  }
  return {genres:rankedFacets(genres),moods:rankedFacets(moods),moodById,eventById};
}

export function collectionPageModel(tracks=[],favoriteIds=[],{
  query='',sort='recent',page=1,genre='all',mood='all',moodById=null,
}={}) {
  const normalizedQuery=String(query||'').trim().toLocaleLowerCase();
  const order=new Map(favoriteIds.map((id,index)=>[id,index]));
  const filtered=tracks.filter(track=>{
    if(!track?.id)return false;
    const trackMood=moodById?.get(track.id) || facetLabel(track.mood);
    if(genre!=='all' && track.genre!==genre)return false;
    if(mood!=='all' && trackMood!==mood)return false;
    return !normalizedQuery ||
      `${track.title||''} ${track.artist||''} ${track.genre||''} ${trackMood||''}`
        .toLocaleLowerCase().includes(normalizedQuery);
  });
  const recent=(a,b)=>(order.get(b.id)??-1)-(order.get(a.id)??-1);
  if(sort==='title' || sort==='artist') {
    const key=sort;
    filtered.sort((a,b)=>
      String(a[key]||'').localeCompare(String(b[key]||'')) || recent(a,b));
  } else filtered.sort(recent);
  const total=filtered.length;
  const pages=Math.max(1,Math.ceil(total/COLLECTION_PAGE_SIZE));
  const requested=Number.isSafeInteger(page)?page:1;
  const selected=Math.min(pages,Math.max(1,requested));
  const start=(selected-1)*COLLECTION_PAGE_SIZE;
  const visible=filtered.slice(start,start+COLLECTION_PAGE_SIZE);
  return {
    page:selected,pages,total,
    start:total?start+1:0,
    end:total?start+visible.length:0,
    visible,hasPrevious:selected>1,hasNext:selected<pages,
  };
}
