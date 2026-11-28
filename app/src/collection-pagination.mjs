/** Pure, bounded saved-music browsing and faceting.
 *
 * Search, genre, mood and sort apply to the ENTIRE Collection before paging.
 * Facet menus are derived from all saved tracks, not just the current 40 cards.
 * No UI state is persisted; exports and backups still include every song.
 */
export const COLLECTION_PAGE_SIZE = 40;

/** Matching must not split "Rock", " rock " and "ROCK" into separate groups.
 * Fold common combining accents for forgiving artist/title searches too.
 * Labels are displayed unchanged (and HTML-escaped in the view); saved data
 * and exports are never rewritten.
 */
export function collectionSearchKey(value) {
  return String(value ?? '').trim().normalize('NFKD')
    .replace(/\p{M}/gu,'').toLocaleLowerCase();
}

/** Generic provider tags are not meaningful facet choices. */
function facetLabel(value) {
  const label=typeof value==='string'?value.trim():'';
  return label && !['all','unknown','fresh'].includes(collectionSearchKey(label))
    ? label : '';
}
const rankedFacets=count=>[...count.values()]
  .sort((a,b)=>b.count-a.count || a.value.localeCompare(b.value));

function countFacet(count,label) {
  if(!label)return;
  const key=collectionSearchKey(label);
  const existing=count.get(key);
  if(existing)existing.count++;
  else count.set(key,{value:label,count:1});
}

export function collectionFacets(tracks=[],history=[]) {
  // Last meaningful saved Tune Lab mood wins. Unset, unknown and default
  // "Fresh" decisions must not hide a useful mood supplied by the source.
  const eventById=new Map();
  for(const event of history)if(event?.id)eventById.set(event.id,event);
  const genres=new Map(),moods=new Map(),moodById=new Map();
  for(const track of tracks) {
    if(!track?.id)continue;
    const genre=facetLabel(track.genre);
    const mood=facetLabel(eventById.get(track.id)?.mood) || facetLabel(track.mood);
    countFacet(genres,genre);
    countFacet(moods,mood);
    if(mood)moodById.set(track.id,mood);
  }
  return {genres:rankedFacets(genres),moods:rankedFacets(moods),moodById,eventById};
}

export function collectionPageModel(tracks=[],favoriteIds=[],{
  query='',sort='recent',page=1,genre='all',mood='all',moodById=null,
}={}) {
  const normalizedQuery=collectionSearchKey(query);
  const genreKey=genre==='all'?'':collectionSearchKey(genre);
  const moodKey=mood==='all'?'':collectionSearchKey(mood);
  const order=new Map(favoriteIds.map((id,index)=>[id,index]));
  const filtered=tracks.filter(track=>{
    if(!track?.id)return false;
    const trackMood=moodById?.get(track.id) || facetLabel(track.mood);
    if(genreKey && collectionSearchKey(facetLabel(track.genre))!==genreKey)return false;
    if(moodKey && collectionSearchKey(trackMood)!==moodKey)return false;
    return !normalizedQuery || collectionSearchKey(
      [track.title||'',track.artist||'',track.genre||'',trackMood||''].join(' ')
    ).includes(normalizedQuery);
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
