/** Personal playlists are ordered references to saved track IDs, not media.
 * Removing a favorite does not destroy its playlist membership. Re-keeping
 * it restores availability. Explicit playlist edits are atomic session writes. */
import {collectionSearchKey} from './collection-pagination.mjs';
export const MAX_PERSONAL_PLAYLISTS=30;
export const MAX_PLAYLIST_MEMBERS=500;
export const MAX_TOTAL_MEMBERS=5000;
const idPattern=/^pl-[a-zA-Z0-9-]{1,80}$/;
const songPattern=/^(commons|jamendo|audius|jellyfin|youtube|deezer):[\w-]{1,120}$/;
const cleanName=value=>typeof value==='string'?value.trim().replace(/\s+/g,' '):'';
export function validatePersonalPlaylists(value){
  if(!Array.isArray(value)||value.length>MAX_PERSONAL_PLAYLISTS)throw Error('Invalid personal playlists.');
  const ids=new Set(),names=new Set();let total=0;
  return value.map(p=>{
    const name=cleanName(p?.name),key=collectionSearchKey(name);
    if(!p||!idPattern.test(p.id)||typeof p.id!=='string'||ids.has(p.id)||!name||name.length>60||names.has(key)||
      !Array.isArray(p.trackIds)||p.trackIds.length>MAX_PLAYLIST_MEMBERS)
      throw Error('Invalid or duplicate personal playlist.');
    if(p.trackIds.some(id=>typeof id!=='string'||!songPattern.test(id))||new Set(p.trackIds).size!==p.trackIds.length)
      throw Error('Invalid or duplicate personal playlist song.');
    total+=p.trackIds.length;
    if(total>MAX_TOTAL_MEMBERS)throw Error('Personal playlist membership limit exceeded.');
    ids.add(p.id);names.add(key);
    return {id:p.id,name,trackIds:[...p.trackIds]};
  });
}
export function personalPlaylists(state){return state?.personalPlaylists??[];}
export function editPersonalPlaylist(state,{type,id,name,trackId,direction}={}){
  const lists=validatePersonalPlaylists(personalPlaylists(state));
  if(type==='create'){
    if(lists.length>=MAX_PERSONAL_PLAYLISTS)throw Error('Playlist limit reached (30). Delete a playlist first.');
    lists.push({id,name:cleanName(name),trackIds:[]});
  }else{
    const p=lists.find(x=>x.id===id);
    if(!p)throw Error('Playlist not found.');
    switch(type){
      case 'rename':p.name=cleanName(name);break;
      case 'delete':lists.splice(lists.indexOf(p),1);break;
      case 'add':
        if(!state.favorites.includes(trackId))throw Error('Save this song before adding it to a playlist.');
        if(p.trackIds.includes(trackId))return state;
        if(p.trackIds.length>=MAX_PLAYLIST_MEMBERS)throw Error('Playlist is full (500 songs).');
        p.trackIds.push(trackId);break;
      case 'remove':p.trackIds=p.trackIds.filter(x=>x!==trackId);break;
      case 'move':{
        const index=p.trackIds.indexOf(trackId),next=index+direction;
        if(![-1,1].includes(direction)||index<0||next<0||next>=p.trackIds.length)return state;
        [p.trackIds[index],p.trackIds[next]]=[p.trackIds[next],p.trackIds[index]];break;
      }
      default:throw Error('Unknown playlist action.');
    }
  }
  return {...state,personalPlaylists:validatePersonalPlaylists(lists)};
}
export function playlistAvailability(playlist,favorites=[],catalog=[]){
  const saved=new Set(favorites),byId=new Map(catalog.filter(t=>t?.id).map(t=>[t.id,t]));
  return (playlist?.trackIds||[]).map(id=>({id,saved:saved.has(id),track:byId.get(id)||null,available:saved.has(id)&&byId.has(id)}));
}
