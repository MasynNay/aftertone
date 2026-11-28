import test from 'node:test';
import assert from 'node:assert/strict';
import {addCollectionTracks,MAX_FAVORITE_IDS,MAX_SAVED_TRACKS} from '../app/src/collection-capacity.mjs';
import {createInitialState,recordChoice,restoreLastChoice,removeFavorite} from '../app/src/taste.mjs';
import {saveState,loadState} from '../app/src/persistence.mjs';
import {createProgressBackup,restoreProgressBackup} from '../app/src/progress-backup.mjs';
const song=i=>({id:'deezer:'+i,title:'Fixture song '+i,artist:'Fixture artist'});
function full() {
  const savedTracks=Array.from({length:MAX_SAVED_TRACKS},(_,i)=>song(i));
  return {...createInitialState(),savedTracks,favorites:savedTracks.map(t=>t.id)};
}
test('a new save or entire podium cannot evict existing favorite metadata',()=>{
  const state=full(),old=JSON.stringify(state);
  assert.throws(()=>addCollectionTracks(state,[song(2000)]),/metadata is full/);
  assert.throws(()=>addCollectionTracks(state,[song(1),song(2000),song(2001)]),/metadata is full/);
  assert.equal(JSON.stringify(state),old);
  assert.equal(addCollectionTracks(state,[song(1)]).savedTracks.length,MAX_SAVED_TRACKS);
});
test('removed metadata is reclaimed only when necessary; existing favorites remain intact',()=>{
  const state=removeFavorite(full(),'deezer:5');
  const result=addCollectionTracks(state,[song(2000)]);
  assert.equal(result.savedTracks.length,MAX_SAVED_TRACKS);
  assert.equal(result.savedTracks.some(t=>t.id==='deezer:5'),false);
  assert.ok(state.favorites.every(id=>result.favorites.includes(id)));
  assert.ok(result.favorites.includes('deezer:2000'));
  assert.equal(state.savedTracks.length,MAX_SAVED_TRACKS);
});
test('legacy favorite ID capacity is explicit and adding a duplicate never overflows',()=>{
  const state={...createInitialState(),favorites:Array.from({length:MAX_FAVORITE_IDS},(_,i)=>'deezer:'+i)};
  assert.throws(()=>addCollectionTracks(state,[song(6000)]),/5,000/);
  assert.equal(addCollectionTracks(state,[song(2)]).favorites.length,MAX_FAVORITE_IDS);
});
test('rating an already saved song does not duplicate it; Undo preserves the prior favorite through backup',()=>{
  const state=addCollectionTracks(createInitialState(),[song(1)]);
  const voted=recordChoice(state,{id:'deezer:1',action:'like',title:song(1).title});
  assert.deepEqual(voted.favorites,state.favorites);
  assert.equal(voted.history.at(-1).alreadySaved,true);
  const local=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}};
  const s=local(),target=local();assert.ok(saveState(s,voted));
  restoreProgressBackup(target,createProgressBackup(s));
  assert.deepEqual(restoreLastChoice(loadState(target)).favorites,state.favorites);
  const ordinary=recordChoice(createInitialState(),{id:'deezer:2',action:'like'});
  assert.deepEqual(restoreLastChoice(ordinary).favorites,[]);
});
