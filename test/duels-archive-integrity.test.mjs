/** Saved bracket integrity: fixture-only tests, no live music requests. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTournament, voteDuel, nextDuelMatch, loadDuelStore,
  saveDuelStore, DUEL_STORAGE_KEY, hallOfFame,
} from '../app/src/duels.mjs';
import {createProgressBackup,restoreProgressBackup} from '../app/src/progress-backup.mjs';

const tracks=Array.from({length:16},(_,i)=>({
  id:`deezer:${700+i}`,source:'deezer',title:`Example song ${i+1}`,
  artist:`Example artist ${i+1}`,artwork:null,
}));
function storage() {
  const values=new Map();
  return {
    getItem:key=>values.has(key)?values.get(key):null,
    setItem:(key,value)=>values.set(key,value),
    removeItem:key=>values.delete(key),
    entries:()=>Object.fromEntries(values),
  };
}
function next(t) {
  const match=nextDuelMatch(t);
  assert.ok(match,'An active tournament must offer a valid next match');
  return voteDuel(t,match.id,match.a,1763900000000);
}
function finished(size=4,kind='open') {
  let t=createTournament({
    id:'duel_integrity_'+size,kind,tracks:tracks.slice(0,size),
    name:'Fixture Integrity Cup',
  });
  while(t.status!=='complete')t=next(t);
  return t;
}
function reload(t) {
  const store=storage();
  assert.equal(saveDuelStore(store,[t]),true);
  return loadDuelStore(store);
}
function tamper(t,mutate) {
  const copy=structuredClone(t);
  mutate(copy);
  return copy;
}

test('normal in-progress, semifinal, bronze and completed brackets always survive reload',()=>{
  for(const size of [4,8,16]) {
    let t=createTournament({id:'duel_normal_'+size,tracks:tracks.slice(0,size)});
    assert.equal(reload(t).length,1);
    const total=size;
    for(let i=0;i<total;i++) {
      t=next(t);
      const saved=reload(t);
      assert.equal(saved.length,1,`Size ${size} should survive after vote ${i+1}`);
      assert.deepEqual(saved[0],t);
    }
    assert.equal(t.status,'complete');
    assert.equal(hallOfFame([reload(t)[0]])[0].gold,1);
  }
  let cup=createTournament({
    id:'duel_champions_two',kind:'champions',tracks:tracks.slice(0,2),
  });
  assert.equal(reload(cup).length,1);
  cup=next(cup);
  assert.equal(cup.podium.third,null);
  assert.equal(reload(cup).length,1);
});

test('reject malformed tournament progression instead of displaying a forged champion',()=>{
  const complete=finished();
  const semifinal=(()=>{
    let t=createTournament({id:'duel_semifinal',tracks:tracks.slice(0,4)});
    t=next(t);
    return t;
  })();
  const invalid=[
    ['inconsistent finalists',tamper(complete,t=>{t.rounds[1][0].a=tracks[1].id;})],
    ['forged podium',tamper(complete,t=>{t.podium.first=tracks[1].id;})],
    ['forged bronze pairing',tamper(complete,t=>{t.thirdPlace.a=tracks[0].id;})],
    ['unfinished championship marked complete',tamper(complete,t=>{t.rounds[1][0].winner=null;})],
    ['decided championship marked active',tamper(complete,t=>{t.status='active';t.podium=null;})],
    ['later match voted before earlier',tamper(semifinal,t=>{
      t.rounds[0][0].winner=null;
      t.rounds[0][1].winner=t.rounds[0][1].a;
    })],
    ['fabricated later round',tamper(semifinal,t=>{
      t.rounds.push([{id:'r1m0',a:tracks[0].id,b:tracks[2].id,winner:null}]);
    })],
    ['extra final round',tamper(complete,t=>{
      t.rounds.push([{id:'r2m0',a:tracks[0].id,b:tracks[2].id,winner:null}]);
    })],
  ];
  for(const [reason,broken] of invalid) {
    const saved=reload(broken);
    assert.equal(saved.length,0,reason);
    assert.deepEqual(hallOfFame(saved),[],reason+' must not award points');
  }
});

test('backup restore rejects forged Duels results without modifying existing progress',()=>{
  const source=storage();
  const forged=tamper(finished(),t=>{t.podium.first=tracks[1].id;});
  source.setItem(DUEL_STORAGE_KEY,JSON.stringify({version:1,tournaments:[forged]}));
  assert.throws(()=>createProgressBackup(source),/Music Duels data .* damaged/);

  // An imported JSON backup has the same integrity gate, before any writes.
  const legitimate=storage();
  assert.equal(saveDuelStore(legitimate,[finished()]),true);
  const backup=JSON.parse(createProgressBackup(legitimate));
  backup.tournaments[0].podium.first=tracks[1].id;
  const target=storage();
  assert.equal(saveDuelStore(target,[finished(8)]),true);
  const before=target.entries();
  assert.throws(()=>restoreProgressBackup(target,JSON.stringify(backup)),
    /damaged or unsupported tournament/);
  assert.deepEqual(target.entries(),before);
});
