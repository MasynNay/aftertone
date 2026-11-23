import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState} from '../app/src/taste.mjs';
import {STORAGE_KEY,loadState} from '../app/src/persistence.mjs';
import {createTournament,DUEL_STORAGE_KEY} from '../app/src/duels.mjs';
import {createProgressBackup,restoreProgressBackup} from '../app/src/progress-backup.mjs';

const QUIZ_KEY='aftertone:tune-lab:v1';
const PLAYLIST_KEY='aftertone:optional-playlist:v1';

function profile() {
  const values=new Map();
  const storage={
    getItem:key=>values.has(key)?values.get(key):null,
    setItem:(key,value)=>values.set(key,value),
    removeItem:key=>values.delete(key),
    entries:()=>Object.fromEntries(values),
  };
  const tracks=Array.from({length:4},(_,index)=>({
    id:'deezer:'+(200+index),title:'Fixture '+index,
    artist:'Test Artist '+index,source:'deezer',
  }));
  storage.setItem(STORAGE_KEY,JSON.stringify({
    ...createInitialState(),favorites:[tracks[0].id],savedTracks:[tracks[0]],
    history:[{id:tracks[0].id,action:'like',context:'discovery',at:1730000000000}],
  }));
  storage.setItem(DUEL_STORAGE_KEY,JSON.stringify({version:1,tournaments:[
    createTournament({id:'duel_verified123',name:'Verification Cup',tracks}),
  ]}));
  storage.setItem(QUIZ_KEY,JSON.stringify({answered:4,correct:3}));
  storage.setItem(PLAYLIST_KEY,JSON.stringify({
    tracks:[{artist:'Test Artist',title:'Saved Playlist Song'}],
  }));
  return storage;
}

test('a silently ignored storage write causes a verified rollback, not a false success',()=>{
  const target=profile();
  const before=target.entries();
  const source=profile();
  const session=loadState(source);
  session.favorites=[];
  session.savedTracks=[];
  session.history=[];
  source.setItem(STORAGE_KEY,JSON.stringify(session));
  source.setItem(QUIZ_KEY,JSON.stringify({answered:1,correct:1}));
  let attempts=0;
  const silent={
    getItem:key=>target.getItem(key),
    setItem:(key,value)=>{
      if(++attempts===3)return; // The changed Tune Lab write is silently lost.
      target.setItem(key,value);
    },
    removeItem:key=>target.removeItem(key),
  };
  assert.throws(()=>restoreProgressBackup(silent,createProgressBackup(source)),
    /previous data was restored/);
  assert.deepEqual(target.entries(),before);
});

test('a silently ignored playlist removal is detected and all prior writes are rolled back',()=>{
  const target=profile();
  const before=target.entries();
  const source=profile();
  source.removeItem(PLAYLIST_KEY);
  const silent={
    getItem:key=>target.getItem(key),
    setItem:(key,value)=>target.setItem(key,value),
    removeItem:key=>{if(key!==PLAYLIST_KEY)target.removeItem(key);},
  };
  assert.throws(()=>restoreProgressBackup(silent,createProgressBackup(source)),
    /previous data was restored/);
  assert.deepEqual(target.entries(),before);
});

test('a rollback that silently loses its own write is accurately reported as incomplete',()=>{
  const target=profile();
  const source=profile();
  const session=loadState(source);
  session.history=[];
  source.setItem(STORAGE_KEY,JSON.stringify(session));
  let rollback=false;
  let writes=0;
  const broken={
    getItem:key=>target.getItem(key),
    setItem:(key,value)=>{
      writes++;
      if(writes===2){rollback=true;throw new Error('quota exceeded');}
      if(rollback && key===STORAGE_KEY)return;
      target.setItem(key,value);
    },
    removeItem:key=>target.removeItem(key),
  };
  assert.throws(()=>restoreProgressBackup(broken,createProgressBackup(source)),
    /rollback was incomplete/);
  assert.equal(loadState(target).history.length,0);
});

test('a null tournament entry is rejected with a readable error without changing progress',()=>{
  const target=profile();
  const before=target.entries();
  const invalid=JSON.parse(createProgressBackup(profile()));
  invalid.tournaments[0].entries[0]=null;
  assert.throws(()=>restoreProgressBackup(target,JSON.stringify(invalid)),
    /invalid tournament metadata/);
  assert.deepEqual(target.entries(),before);
});
