import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState} from '../app/src/taste.mjs';
import {STORAGE_KEY,loadState,saveState} from '../app/src/persistence.mjs';
import {createTournament,DUEL_STORAGE_KEY,loadDuelStore,saveDuelStore} from '../app/src/duels.mjs';
import {BACKUP_FORMAT,BACKUP_MAX_BYTES,createProgressBackup,inspectProgressBackup,restoreProgressBackup} from '../app/src/progress-backup.mjs';
import {createViews} from '../app/public/views.js';

function storage(initial={}) {
  const values=new Map(Object.entries(initial));
  return {
    getItem:key=>values.has(key)?values.get(key):null,
    setItem:(key,value)=>values.set(key,value),
    removeItem:key=>values.delete(key),
    entries:()=>Object.fromEntries(values),
  };
}
const songs=Array.from({length:4},(_,i)=>({
  id:'deezer:'+(200+i),title:'Fixture '+i,artist:'Test Artist '+i,genre:'unknown',source:'deezer'
}));
function populated() {
  const s=storage();
  const original={...createInitialState(),theme:'night',discoveryMix:'explore',
    favorites:[songs[0].id],
    savedTracks:[songs[0]],
    history:[{id:songs[0].id,action:'like',artist:songs[0].artist,genre:'unknown',context:'discovery',
      route:'explore',recognized:true,correct:true,mood:'Bright',at:1730000000000}]};
  assert.equal(saveState(s,original),true);
  assert.equal(saveDuelStore(s,[createTournament({id:'duel_backup123',name:'Backup Cup',tracks:songs})]),true);
  s.setItem('aftertone:tune-lab:v1',JSON.stringify({answered:4,correct:3}));
  s.setItem('aftertone:favorite-artists:v1',JSON.stringify(['Test Artist','Another Artist']));
  return s;
}
test('backup round trip preserves favorites, history, volume, themes, music duels and quiz',()=>{
  const from=populated();
  const exported=createProgressBackup(from,'2026-11-11T00:00:00.000Z');
  const parsed=JSON.parse(exported);
  assert.equal(parsed.format,BACKUP_FORMAT);
  assert.equal(parsed.version,1);
  assert.equal(parsed.tournaments.length,1);
  assert.equal(parsed.artists.length,2);
  const to=storage();
  const info=restoreProgressBackup(to,exported);
  assert.deepEqual(info,{favorites:1,decisions:1,tournaments:1,artists:2});
  assert.equal(loadState(to).discoveryMix,'explore');
  assert.deepEqual(loadState(to).favorites,[songs[0].id]);
  assert.equal(loadState(to).history[0].mood,'Bright');
  assert.equal(loadDuelStore(to).length,1);
  assert.equal(JSON.parse(to.getItem('aftertone:tune-lab:v1')).correct,3);
  assert.deepEqual(JSON.parse(to.getItem('aftertone:favorite-artists:v1')),['Test Artist','Another Artist']);
});
test('invalid JSON, wrong versions, oversized files and corrupt track IDs do not mutate storage',()=>{
  const s=populated();
  const backup=createProgressBackup(s);
  const before=s.entries();
  for (const invalid of [
    '{',
    JSON.stringify({format:'some-other-app',version:1}),
    JSON.stringify({...JSON.parse(backup),version:777}),
    JSON.stringify({...JSON.parse(backup),session:{version:1,history:[],favorites:[]}}),
    JSON.stringify({...JSON.parse(backup),session:{...JSON.parse(backup).session,favorites:['bad:id']}}),
    JSON.stringify({...JSON.parse(backup),artists:['same','same']}),
    JSON.stringify({...JSON.parse(backup),tournaments:[{id:'duel_bad',entries:[]}]}),
    'x'.repeat(BACKUP_MAX_BYTES+1),
  ]) {
    assert.throws(()=>restoreProgressBackup(s,invalid));
    assert.deepEqual(s.entries(),before);
  }
});
test('storage write error rolls back all modified keys without partial import',()=>{
  const current=populated();
  const source=populated();
  const newState=loadState(source);
  newState.theme='day';
  newState.history=[];
  newState.favorites=[];
  source.setItem(STORAGE_KEY,JSON.stringify(newState));
  const backup=createProgressBackup(source);
  const saved=current.entries();
  let writes=0;
  const flaky={
    getItem:key=>current.getItem(key),
    setItem:(key,value)=>{if(++writes===3)throw new Error('quota exceeded');current.setItem(key,value);},
    removeItem:key=>current.removeItem(key),
  };
  assert.throws(()=>restoreProgressBackup(flaky,backup),/previous data was restored/);
  assert.deepEqual(current.entries(),saved);
});
test('imported extra fields cannot become persistent history script/data values',()=>{
  const raw=JSON.parse(createProgressBackup(populated()));
  raw.session.history[0].unexpected={html:'<img src=x onerror=alert(1)>'};
  raw.session.history[0].mood='<b>dangerous</b>';
  const dest=storage();
  restoreProgressBackup(dest,JSON.stringify(raw));
  const event=loadState(dest).history[0];
  assert.equal(event.unexpected,undefined);
  assert.equal(event.mood,'<b>dangerous</b>'); // Escaped by the existing html() renderer.
});
test('Collection backup and restore actions appear even with an empty collection',()=>{
  const state=createInitialState();
  const markup=createViews({state,catalog:[],current:null,allGenres:['all'],
    challengeIds:[],challengeResponses:[],catalogWarning:'',catalogLive:true,
    collectionQuery:'',collectionSort:'recent'}).renderCollection();
  assert.match(markup,/data-action="backup-progress"/);
  assert.match(markup,/data-action="restore-progress"/);
  assert.match(markup,/id="progress-backup-file"/);
});
test('inspection previews counts without modifying storage',()=>{
  const current=populated();
  const original=current.entries();
  const preview=inspectProgressBackup(createProgressBackup(current));
  assert.equal(preview.summary.tournaments,1);
  assert.equal(preview.writes.length,4);
  assert.deepEqual(current.entries(),original);
  assert.match(current.getItem(DUEL_STORAGE_KEY),/Backup Cup/);
});
