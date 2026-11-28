/** Dynamic mixes derive only from saved metadata and explicit listening choices.
 * No inferred audio traits, hidden tracking, or persisted duplicate playlists. */
import {collectionFacets,collectionSearchKey} from './collection-pagination.mjs';
export function smartPlaylists(favorites=[],catalog=[],history=[]){
  const byId=new Map(catalog.filter(t=>t?.id).map(t=>[t.id,t]));
  const tracks=[...new Set(favorites)].reverse().map(id=>byId.get(id)).filter(Boolean);
  const facets=collectionFacets(tracks,history);
  const mixes=[];
  function add(id,name,description,items){
    if(items.length)mixes.push({id,name,description,trackIds:items.map(t=>t.id)});
  }
  add('recent','Recently kept','Your newest 30 saved songs with song details.',tracks.slice(0,30));
  add('new-to-you','New to you','Saved songs explicitly marked unfamiliar in your listening decisions.',tracks.filter(t=>facets.eventById.get(t.id)?.recognized===false));
  add('recognized','Recognized favorites','Saved songs explicitly marked familiar in your listening decisions.',tracks.filter(t=>facets.eventById.get(t.id)?.recognized===true));
  for(const [kind,values] of [['genre',facets.genres],['mood',facets.moods]]){
    for(const facet of values.slice(0,8)){
      const key=collectionSearchKey(facet.value);
      const items=tracks.filter(t=>collectionSearchKey(kind==='genre'?t.genre:facets.moodById.get(t.id))===key);
      add(kind+':'+key,facet.value,kind==='genre'?'Saved songs with this recorded genre.':'Saved songs with this recorded mood or your mood rating.',items);
    }
  }
  return mixes;
}
