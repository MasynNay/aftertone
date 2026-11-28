import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInitialState} from '../app/src/taste.mjs';
import {STORAGE_KEY,loadState,saveState} from '../app/src/persistence.mjs';
import {createTournament,DUEL_STORAGE_KEY,loadDuelStore,saveDuelStore} from '../app/src/duels.mjs';
import {BACKUP_FORMAT,BACKUP_VERSION,BACKUP_MAX_BYTES,createProgressBackup,inspectProgressBackup,compareProgressSummaries,restoreProgressBackup} from '../app/src/progress-backup.mjs';
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
  s.setItem('aftertone:optional-playlist:v1',JSON.stringify({tracks:[
    {artist:'Some Artist',title:'An Original Song'},
    {artist:'Different Artist',title:'Another Song'},
  ]}));
  s.setItem('aftertone:lyric-offsets:v1',JSON.stringify({'deezer:200':45,'deezer:201':84}));
  return s;
}
test('backup round trip preserves favorites, history, volume, themes, music duels and quiz',()=>{
  const from=populated();
  const exported=createProgressBackup(from,'2026-11-11T00:00:00.000Z');
  const parsed=JSON.parse(exported);
  assert.equal(parsed.format,BACKUP_FORMAT);
  assert.equal(parsed.version,BACKUP_VERSION);
  assert.equal(parsed.tournaments.length,1);
  assert.equal(parsed.artists.length,2);
  assert.equal(parsed.playlist.tracks.length,2);
  assert.equal(parsed.lyricOffsets['deezer:200'],45);
  const to=storage();
  const info=restoreProgressBackup(to,exported);
  assert.deepEqual(info,{favorites:1,decisions:1,tournaments:1,artists:2,
    quizAnswered:4,quizCorrect:3,playlistTracks:2,lyricOffsets:2,version:2});
  assert.equal(loadState(to).discoveryMix,'explore');
  assert.deepEqual(loadState(to).favorites,[songs[0].id]);
  assert.equal(loadState(to).history[0].mood,'Bright');
  assert.equal(loadDuelStore(to).length,1);
  assert.equal(JSON.parse(to.getItem('aftertone:tune-lab:v1')).correct,3);
  assert.deepEqual(JSON.parse(to.getItem('aftertone:favorite-artists:v1')),['Test Artist','Another Artist']);
  assert.equal(JSON.parse(to.getItem('aftertone:optional-playlist:v1')).tracks[1].title,'Another Song');
  assert.equal(JSON.parse(to.getItem('aftertone:lyric-offsets:v1'))['deezer:201'],84);
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
    JSON.stringify({...JSON.parse(backup),playlist:{tracks:[{artist:'A',title:'Valid'},{artist:'A',title:'Valid'}]}}),
    JSON.stringify({...JSON.parse(backup),playlist:{tracks:[{artist:'https://invalid.example',title:'Valid'}]}}),
    JSON.stringify({...JSON.parse(backup),playlist:{tracks:[{artist:'A',title:42}]}}),
    JSON.stringify({...JSON.parse(backup),lyricOffsets:{'bad-id':30}}),
    JSON.stringify({...JSON.parse(backup),lyricOffsets:{'deezer:200':-10}}),
    JSON.stringify({...JSON.parse(backup),lyricOffsets:{'deezer:200':Infinity}}),
    JSON.stringify({...JSON.parse(backup),lyricOffsets:{'deezer:200':'55'}}),
    JSON.stringify({...JSON.parse(backup),lyricOffsets:{'deezer:200':999999}}),
    JSON.stringify({...JSON.parse(backup),playlist:undefined}),
    JSON.stringify({...JSON.parse(backup),lyricOffsets:undefined}),
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
  assert.match(markup,/Restore replaces your current progress; download a backup first/);
   assert.match(markup,/Backup files are not encrypted/);
   assert.match(markup,/Version 2 backups include saved tracks, listening choices, preferences, Music Duels, imported playlist song names and manual lyric timing offsets/);
   assert.match(markup,/id="progress-backup-status"[^>]*role="status" aria-live="polite" aria-atomic="true" hidden/);
   assert.match(markup,/data-action="restore-progress" aria-describedby="collection-backup-note"/);
  assert.doesNotMatch(markup,/imported playlist files and lyric timing offsets are not included/);
  assert.match(markup,/data-action="restore-progress"/);
  assert.match(markup,/id="progress-backup-file"/);
});
test('inspection previews counts without modifying storage',()=>{
  const current=populated();
  const original=current.entries();
  const preview=inspectProgressBackup(createProgressBackup(current));
  assert.equal(preview.summary.tournaments,1);
  assert.equal(preview.summary.artists,2);
  assert.equal(preview.summary.quizAnswered,4);
  assert.equal(preview.summary.quizCorrect,3);
  assert.equal(preview.writes.length,6);
  assert.deepEqual(current.entries(),original);
  assert.match(current.getItem(DUEL_STORAGE_KEY),/Backup Cup/);
});

test('v1 legacy backups remain restorable without deleting newer optional local data',()=>{
  const original=populated();
  const legacy=JSON.parse(createProgressBackup(original));
  legacy.version=1;
  delete legacy.playlist;
  delete legacy.lyricOffsets;
  const destination=populated();
  destination.setItem('aftertone:optional-playlist:v1',JSON.stringify({tracks:[{artist:'Retained Artist',title:'Retained Song'}]}));
  destination.setItem('aftertone:lyric-offsets:v1',JSON.stringify({'deezer:222':33}));
  const optionalBefore=[
    destination.getItem('aftertone:optional-playlist:v1'),
    destination.getItem('aftertone:lyric-offsets:v1'),
  ];
  const result=restoreProgressBackup(destination,JSON.stringify(legacy));
  assert.equal(result.version,1);
  assert.equal(result.playlistTracks,null);
  assert.equal(result.lyricOffsets,null);
  assert.equal(destination.getItem('aftertone:optional-playlist:v1'),optionalBefore[0]);
  assert.equal(destination.getItem('aftertone:lyric-offsets:v1'),optionalBefore[1]);
  assert.equal(loadState(destination).favorites.length,1);
});
test('v2 null playlist clears an old playlist; empty offsets replace old timings',()=>{
  const source=populated();
  source.removeItem('aftertone:optional-playlist:v1');
  source.removeItem('aftertone:lyric-offsets:v1');
  const exportFile=createProgressBackup(source);
  const parsed=JSON.parse(exportFile);
  assert.equal(parsed.playlist,null);
  assert.deepEqual(parsed.lyricOffsets,{});
  const target=populated();
  const result=restoreProgressBackup(target,exportFile);
  assert.equal(result.playlistTracks,0);
  assert.equal(result.lyricOffsets,0);
  assert.equal(target.getItem('aftertone:optional-playlist:v1'),null);
  assert.deepEqual(JSON.parse(target.getItem('aftertone:lyric-offsets:v1')),{});
});
test('invalid local optional data fails export instead of silently losing playlist or lyric offsets',()=>{
  const source=populated();
  source.setItem('aftertone:optional-playlist:v1','{broken');
  assert.throws(()=>createProgressBackup(source),/damaged/);
  source.setItem('aftertone:optional-playlist:v1',JSON.stringify({tracks:[{artist:'Valid Artist',title:'Valid Track'}]}));
  source.setItem('aftertone:lyric-offsets:v1',JSON.stringify({'deezer:200':'bad offset'}));
  assert.throws(()=>createProgressBackup(source),/invalid lyric timing/);
});
test('writes to optional keys are rolled back after a late storage failure',()=>{
  const source=populated();
  const candidate=JSON.parse(createProgressBackup(source));
  candidate.playlist={tracks:[{artist:'Fresh Artist',title:'Fresh Song'}]};
  candidate.lyricOffsets={'deezer:888':26};
  const dest=populated();
  const previous=dest.entries();
  let count=0;
  const storage={
    getItem:key=>dest.getItem(key),
    setItem:(key,v)=>{if(++count===6)throw new Error('quota');dest.setItem(key,v);},
    removeItem:key=>dest.removeItem(key),
  };
  assert.throws(()=>restoreProgressBackup(storage,JSON.stringify(candidate)),/previous data was restored/);
  assert.deepEqual(dest.entries(),previous);
});

test('export refuses corrupt local progress instead of silently backing up an empty profile',()=>{
  const corruptions=[
    [STORAGE_KEY,'{',/Listening progress data .* damaged/],
    [STORAGE_KEY,'null',/Listening progress data .* damaged/],
    [STORAGE_KEY,JSON.stringify({...createInitialState(),favorites:['invalid:id']}),/Listening progress data .* damaged/],
    [DUEL_STORAGE_KEY,'{',/Music Duels data .* damaged/],
    [DUEL_STORAGE_KEY,JSON.stringify({version:1,tournaments:[{bad:true}]}),/Music Duels data .* damaged/],
    ['aftertone:tune-lab:v1','{',/Tune Lab data .* damaged/],
    ['aftertone:tune-lab:v1',JSON.stringify({answered:'not-a-number',correct:1}),/Tune Lab data .* damaged/],
    ['aftertone:favorite-artists:v1','{',/Favorite artists data .* damaged/],
    ['aftertone:favorite-artists:v1',JSON.stringify(['Same Artist','Same Artist']),/Favorite artists data .* damaged/],
  ];
  for(const [key,value,error] of corruptions){
    const source=populated();
    source.setItem(key,value);
    const before=source.entries();
    assert.throws(()=>createProgressBackup(source),error,
      'Backup must not substitute empty defaults for damaged '+key);
    assert.deepEqual(source.entries(),before,
      'Failed backup must not change or delete corrupt user data in '+key);
  }
});

test('fresh sessions and legacy v1 sessions without savedTracks remain exportable',()=>{
  const empty=JSON.parse(createProgressBackup(storage()));
  assert.equal(empty.version,BACKUP_VERSION);
  assert.deepEqual(empty.session.favorites,[]);
  assert.deepEqual(empty.tournaments,[]);
  assert.deepEqual(empty.quiz,{answered:0,correct:0});
  assert.deepEqual(empty.artists,[]);

  const legacy=populated();
  const raw=JSON.parse(legacy.getItem(STORAGE_KEY));
  delete raw.savedTracks; // Older legitimate local sessions lacked this field.
  legacy.setItem(STORAGE_KEY,JSON.stringify(raw));
  const previous=legacy.entries();
  const exported=JSON.parse(createProgressBackup(legacy));
  assert.equal(exported.session.history.length,1);
  assert.deepEqual(exported.session.favorites,[songs[0].id]);
  assert.deepEqual(exported.session.savedTracks,[]);
  assert.equal(exported.tournaments.length,1);
  assert.deepEqual(legacy.entries(),previous,
    'Export must not rewrite or migrate live saved records in place');
});


test('authentic older v1 backup without savedTracks restores favorite IDs without invented track details',()=>{
  const source=populated();
  const original=JSON.parse(createProgressBackup(source));
  const legacy={
    ...original,version:1,
    session:{...original.session},
  };
  delete legacy.session.savedTracks; // Genuine early app records lacked this key.
  delete legacy.playlist;
  delete legacy.lyricOffsets;
  const payload=JSON.stringify(legacy);
  const inspected=inspectProgressBackup(payload);
  assert.equal(inspected.summary.version,1);
  assert.equal(inspected.summary.missingFavoriteMetadata,1);
  assert.equal(inspected.summary.favorites,1);
  assert.equal(inspected.summary.decisions,1);
  assert.equal(inspected.writes.length,4);
  const target=populated();
  target.setItem('aftertone:optional-playlist:v1',
    JSON.stringify({tracks:[{artist:'Unrelated Existing',title:'Do Not Lose Me'}]}));
  target.setItem('aftertone:lyric-offsets:v1',JSON.stringify({'deezer:888':33}));
  const optionalBefore=[
    target.getItem('aftertone:optional-playlist:v1'),
    target.getItem('aftertone:lyric-offsets:v1'),
  ];
  const summary=restoreProgressBackup(target,payload);
  assert.equal(summary.missingFavoriteMetadata,1);
  assert.deepEqual(loadState(target).favorites,original.session.favorites);
  assert.deepEqual(loadState(target).history,original.session.history);
  assert.deepEqual(loadState(target).savedTracks,[],
    'Never invent song names or artwork for legacy favorite IDs');
  assert.deepEqual([
    target.getItem('aftertone:optional-playlist:v1'),
    target.getItem('aftertone:lyric-offsets:v1'),
  ],optionalBefore,'Old backups must preserve optional data absent from their schema');
});

test('v2 must still reject missing savedTracks and v1 must reject explicit bad savedTracks',()=>{
  const source=populated();
  const candidate=JSON.parse(createProgressBackup(source));
  const target=populated();
  const prior=target.entries();
  const invalid=[
    {...candidate,session:{...candidate.session,savedTracks:undefined}},
    {...candidate,session:{...candidate.session,savedTracks:null}},
    {...candidate,session:{...candidate.session,savedTracks:'not a collection'}},
    {...candidate,version:1,session:{...candidate.session,savedTracks:null}},
    {...candidate,version:1,session:{...candidate.session,savedTracks:{}}},
  ];
  for(const data of invalid){
    assert.throws(()=>restoreProgressBackup(target,JSON.stringify(data)),
      /unsupported or malformed listening session/);
    assert.deepEqual(target.entries(),prior,
      'Invalid current/legacy backups must not change local progress');
  }
});

test('v2 export from a genuine older local session warns when favorites lack metadata',()=>{
  const local=populated();
  const old=JSON.parse(local.getItem(STORAGE_KEY));
  delete old.savedTracks; // Legitimate old state is exportable to v2.
  local.setItem(STORAGE_KEY,JSON.stringify(old));
  const before=local.entries();
  const exported=createProgressBackup(local);
  const input=JSON.parse(exported);
  assert.equal(input.version,2);
  assert.deepEqual(input.session.favorites,[songs[0].id]);
  assert.deepEqual(input.session.savedTracks,[]);
  const preview=inspectProgressBackup(exported).summary;
  assert.equal(preview.missingFavoriteMetadata,1);
  assert.equal(preview.favorites,1);
  assert.deepEqual(local.entries(),before,
    'Checking metadata must never mutate the original browser');
});

test('normal backed-up favorites with metadata never trigger a missing-song warning',()=>{
  const backup=createProgressBackup(populated());
  const info=inspectProgressBackup(backup).summary;
  assert.equal(info.missingFavoriteMetadata,undefined);
  const code=readFileSync(new URL('../app/public/main.js',import.meta.url),'utf8');
  assert.match(code,/const missing=preview\.missingFavoriteMetadata \|\| 0/);
  assert.match(code,/no song title or artist metadata in this file/);
  assert.match(code,/favorite IDs and listening decisions can be restored/);
  assert.match(code,/const \{summary\}=inspectProgressBackup\(payload\)/);
});

test('restore preview reports changes and losses, without changing local storage',()=>{
  const browser=populated();
  const source=populated();
  const edited=loadState(source);
  edited.favorites=[];
  edited.history=[];
  source.setItem(STORAGE_KEY,JSON.stringify(edited));
  source.setItem('aftertone:tune-lab:v1',JSON.stringify({answered:1,correct:1}));
  source.removeItem('aftertone:optional-playlist:v1');
  const current=inspectProgressBackup(createProgressBackup(browser)).summary;
  const incoming=inspectProgressBackup(createProgressBackup(source)).summary;
  const snapshot=browser.entries();
  const result=compareProgressSummaries(current,incoming);
  assert.ok(result.lines.includes('Saved songs: 1 → 0 (-1)'));
  assert.ok(result.lines.includes('Listening choices: 1 → 0 (-1)'));
  assert.ok(result.lines.includes('Tune Lab answers: 4 → 1 (-3)'));
  assert.ok(result.lines.includes('Imported playlist songs: 2 → 0 (-2)'));
  assert.ok(result.reductions.includes('Saved songs'));
  assert.ok(result.reductions.includes('Imported playlist songs'));
  assert.deepEqual(browser.entries(),snapshot,'Preview must not change the browser');
});
test('legacy v1 comparison explicitly preserves optional data',()=>{
  const current=inspectProgressBackup(createProgressBackup(populated())).summary;
  const old={...current,version:1,playlistTracks:null,lyricOffsets:null};
  const result=compareProgressSummaries(current,old);
  assert.ok(result.lines.some(line=>line.startsWith('Imported playlist songs: unchanged')));
  assert.ok(result.lines.some(line=>line.startsWith('Lyric timing adjustments: unchanged')));
  assert.deepEqual(result.reductions,[]);
  assert.throws(()=>compareProgressSummaries(null,old),/required/);
  assert.throws(()=>compareProgressSummaries(current,{...old,favorites:-1}),/Invalid incoming/);
});
test('restore confirmation surfaces the comparison and warns when counts fall',()=>{
  const code=readFileSync(new URL('../app/public/main.js',import.meta.url),'utf8');
  const restore=code.split('async function importProgressBackupFile(file) {')[1]
    ?.split('// Native artwork can expire')[0] || '';
  assert.match(restore,/compareProgressSummaries\(current,preview\)/);
  assert.match(restore,/WARNING: Restoring would reduce:/);
  assert.match(restore,/Current browser progress could not be verified/);
  assert.match(restore,/if\(!window.confirm\(message\)\)/);
  assert.match(restore,/restoreProgressBackup\(localStorage,content\)/);
  assert.ok(restore.indexOf('compareProgressSummaries')<restore.indexOf('window.confirm'));
  assert.ok(restore.indexOf('window.confirm')<restore.indexOf('restoreProgressBackup(localStorage,content)'));
});
