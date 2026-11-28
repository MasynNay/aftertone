/** Local-only personalization with verified writes and consistent backup limits.
 * Return failure when persistence cannot be confirmed. Callers keep the
 * current in-memory profile and retry rather than claiming success. */
import {parsePlaylist} from './playlist-import.mjs';
import {parseFavoriteArtists} from './discovery-personalization.mjs';

export const PLAYLIST_STORAGE_KEY='aftertone:optional-playlist:v1';
export const ARTISTS_STORAGE_KEY='aftertone:favorite-artists:v1';
export const MAX_SAVED_PLAYLIST_TRACKS=3000;

export function preparePlaylistImport(data) {
  if(!Array.isArray(data?.tracks)||!data.tracks.length)
    throw new Error('No valid playlist songs were found.');
  // Both provider results and text files pass the same metadata boundary.
  if(data.tracks.length>5000)
    throw new Error('Choose a playlist with at most 5,000 input songs.');
  if(data.tracks.some(t=>!t || typeof t.artist!=='string' || typeof t.title!=='string'))
    throw new Error('Playlist contains invalid artist or song names.');
  const parsed=parsePlaylist(JSON.stringify({tracks:data.tracks}));
  if(parsed.tracks.length>MAX_SAVED_PLAYLIST_TRACKS)
    throw new Error('Aftertone can save up to 3,000 unique playlist songs. Choose a smaller playlist; your previous import has not been replaced.');
  return {tracks:parsed.tracks};
}
export function readSavedPlaylist(storage) {
  try {
    const raw=storage.getItem(PLAYLIST_STORAGE_KEY);
    return raw===null?null:preparePlaylistImport(JSON.parse(raw));
  } catch {return null;}
}
export function readSavedArtists(storage) {
  try {return parseFavoriteArtists(JSON.parse(storage.getItem(ARTISTS_STORAGE_KEY)||'[]'));}
  catch {return [];}
}
function writeVerified(storage,key,value) {
  try {
    if(value===null)storage.removeItem(key);
    else storage.setItem(key,value);
    return storage.getItem(key)===value;
  } catch {return false;}
}
export function savePlaylist(storage,playlist) {
  try {
    return writeVerified(storage,PLAYLIST_STORAGE_KEY,
      playlist===null?null:JSON.stringify(preparePlaylistImport(playlist)));
  } catch {return false;}
}
export function saveFavoriteArtists(storage,artists) {
  if(!Array.isArray(artists)||!artists.length||artists.some(a=>typeof a!=='string'))return false;
  const clean=parseFavoriteArtists(artists);
  if(clean.length!==artists.length || clean.some((a,i)=>a!==artists[i]))return false;
  return writeVerified(storage,ARTISTS_STORAGE_KEY,JSON.stringify(clean));
}
