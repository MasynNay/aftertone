import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePlaylistImport,readSavedPlaylist,readSavedArtists,savePlaylist,saveFavoriteArtists,PLAYLIST_STORAGE_KEY,ARTISTS_STORAGE_KEY} from '../app/src/personalization-store.mjs';
import {createProgressBackup,inspectProgressBackup} from '../app/src/progress-backup.mjs';
function storage() {
  const data=new Map();
  return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
}
const old={tracks:[{artist:'Fixture Artist',title:'First'}]};
const next={tracks:[{artist:'Fixture Artist',title:'Second'}]};
test('imports, artist preferences and deletion verify actual browser storage',()=>{
  const s=storage();
  assert.equal(savePlaylist(s,old),true);
  assert.deepEqual(readSavedPlaylist(s),old);
  assert.equal(saveFavoriteArtists(s,['Fixture Artist']),true);
  assert.deepEqual(readSavedArtists(s),['Fixture Artist']);
  const dropped={...s,setItem:()=>{},removeItem:()=>{}};
  assert.equal(savePlaylist(dropped,next),false);
  assert.equal(savePlaylist(dropped,null),false);
  assert.equal(saveFavoriteArtists(dropped,['Other Artist']),false);
  assert.deepEqual(readSavedPlaylist(s),old);
  assert.deepEqual(readSavedArtists(s),['Fixture Artist']);
  assert.equal(savePlaylist(s,null),true);
  assert.equal(readSavedPlaylist(s),null);
  assert.equal(savePlaylist({...s,getItem:()=>{throw Error('blocked');}},next),false);
});
test('oversized and malformed imports never silently replace an existing playlist',()=>{
  const s=storage();
  savePlaylist(s,old);
  const many={tracks:Array.from({length:3001},(_,i)=>({artist:'Artist',title:'Song '+i}))};
  assert.throws(()=>preparePlaylistImport(many),/3,000 unique/);
  assert.equal(savePlaylist(s,many),false);
  assert.equal(savePlaylist(s,{tracks:[{artist:{},title:'Oops'}]}),false);
  assert.deepEqual(readSavedPlaylist(s),old);
  const normalized=preparePlaylistImport({tracks:[...old.tracks,...old.tracks]});
  assert.deepEqual(normalized,old);
});
test('personalization uses backup-compatible keys, shape and limits',()=>{
  const s=storage();
  assert.ok(savePlaylist(s,old));
  assert.ok(saveFavoriteArtists(s,['Fixture Artist']));
  const raw=JSON.parse(createProgressBackup(s));
  assert.deepEqual(raw.playlist,old);
  assert.deepEqual(raw.artists,['Fixture Artist']);
  const preview=inspectProgressBackup(JSON.stringify(raw)).summary;
  assert.equal(preview.playlistTracks,1);
  assert.equal(preview.artists,1);
  s.setItem(ARTISTS_STORAGE_KEY,JSON.stringify(['Fixture Artist',null,42]));
  assert.deepEqual(readSavedArtists(s),['Fixture Artist']);
  s.setItem(PLAYLIST_STORAGE_KEY,'{');
  assert.equal(readSavedPlaylist(s),null);
});
