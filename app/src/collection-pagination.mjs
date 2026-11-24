/** Pure, bounded Collection browse model.
 *
 * Filter and sort the entire saved library (so match counts and exports remain
 * accurate) but render only a single page of cards on small screens. The
 * original favorites array defines the "Recently kept" order; no storage
 * migration or persisted page cursor is required.
 */
export const COLLECTION_PAGE_SIZE = 40;

export function collectionPageModel(tracks=[], favoriteIds=[], {
  query='', sort='recent', page=1,
}={}) {
  const normalizedQuery=String(query||'').trim().toLocaleLowerCase();
  const order=new Map(favoriteIds.map((id,index)=>[id,index]));
  const filtered=tracks.filter(track=>track && track.id &&
    (!normalizedQuery ||
      `${track.title||''} ${track.artist||''} ${track.genre||''}`
        .toLocaleLowerCase().includes(normalizedQuery)));
  const recent=(a,b)=>(order.get(b.id)??-1)-(order.get(a.id)??-1);
  if(sort==='title' || sort==='artist') {
    const key=sort;
    filtered.sort((a,b)=>
      String(a[key]||'').localeCompare(String(b[key]||'')) || recent(a,b));
  } else filtered.sort(recent);
  const total=filtered.length;
  const pages=Math.max(1,Math.ceil(total/COLLECTION_PAGE_SIZE));
  // Malformed or stale cursors are clamped, never an empty phantom page.
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
