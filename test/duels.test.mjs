import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTournament,voteDuel,nextDuelMatch,duelProgress,availableChampions,podiumTracks,podiumCsv,loadDuelStore,saveDuelStore,DUEL_STORAGE_KEY} from '../app/src/duels.mjs';
import {renderDuels} from '../app/public/duels-view.js';

const songs=Array.from({length:16},(_,i)=>({id:`deezer:${i+1}`,title:`Track ${i+1}`,artist:`Artist ${i+1}`,source:'deezer',artwork:null,genre:'pop'}));
const create = (size,kind='open',id='duel_t12345')=>createTournament({id,name:'Friday Night',kind,tracks:songs.slice(0,size),createdAt:100});
const playToFinish=(t)=>{
  let result=t;
  let limit=24;
  while(result.status!=='complete' && limit-->0){
    const next=nextDuelMatch(result);
    assert.ok(next,'there must be another match until the final');
    result=voteDuel(result,next.id,next.a,101);
  }
  assert.ok(limit>0);
  return result;
};

test('4-, 8-, 16-entry brackets finish with three distinct podium songs',()=>{
  for(const size of [4,8,16]) {
    const t=create(size);
    assert.equal(t.rounds[0].length,size/2);
    assert.equal(nextDuelMatch(t).stage,'round');
    const completed=playToFinish(t);
    assert.equal(completed.status,'complete');
    assert.deepEqual(duelProgress(completed),{done:size,total:size,remaining:0});
    assert.equal(podiumTracks(completed).length,3);
    assert.equal(new Set(Object.values(completed.podium)).size,3);
    assert.equal(nextDuelMatch(completed),null);
    assert.equal(t.status,'active','pure vote does not mutate input');
  }
});

test('semifinal losers play for third before the grand final',()=>{
  let t=create(4);
  t=voteDuel(t,'r0m0',songs[0].id);
  t=voteDuel(t,'r0m1',songs[2].id);
  assert.equal(nextDuelMatch(t).id,'bronze');
  assert.equal(nextDuelMatch(t).stage,'third');
  t=voteDuel(t,'bronze',songs[3].id);
  assert.equal(nextDuelMatch(t).stage,'final');
  t=voteDuel(t,'r1m0',songs[2].id);
  assert.deepEqual(t.podium,{first:songs[2].id,second:songs[0].id,third:songs[3].id});
});

test('stale votes and invalid winners cannot alter an active match',()=>{
  const t=create(4);
  assert.throws(()=>voteDuel(t,'r0m1',songs[2].id),/no longer active/);
  assert.throws(()=>voteDuel(t,'r0m0',songs[3].id),/no longer active/);
  const voted=voteDuel(t,'r0m0',songs[0].id);
  assert.throws(()=>voteDuel(voted,'r0m0',songs[0].id),/no longer active/);
  assert.equal(t.rounds[0][0].winner,null);
});

test('Champions Cup begins with two distinct winners and does not recursively re-seed itself',()=>{
  const first=playToFinish(create(4,'open','duel_one123'));
  const shifted=songs.slice(4,8);
  const second=playToFinish(createTournament({id:'duel_two123',kind:'open',tracks:shifted}));
  const champs=availableChampions([first,second]);
  assert.equal(champs.length,2);
  assert.equal(champs[0].id,first.podium.first);
  const cup=playToFinish(createTournament({id:'duel_cup123',kind:'champions',tracks:champs}));
  assert.equal(cup.status,'complete');
  assert.equal(cup.podium.third,null);
  assert.equal(podiumTracks(cup).length,2);
  assert.equal(availableChampions([first,second,cup]).length,2);
});

test('duplicate tracks, malformed size and unsupported track IDs are rejected',()=>{
  assert.throws(()=>createTournament({id:'duel_dup123',tracks:[songs[0],songs[0],songs[1],songs[2]]}),/only once/);
  assert.throws(()=>createTournament({id:'duel_bad123',tracks:songs.slice(0,3)}),/4, 8 or 16/);
  assert.throws(()=>createTournament({id:'duel_bad123',tracks:[...songs.slice(0,3),{...songs[3],id:'https://attacker'}]}),/4, 8 or 16/);
});

test('tournaments survive local-storage reload and reject invalid backups',()=>{
  const values=new Map();
  const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
  const active=create(8);
  const completed=playToFinish(create(4,'open','duel_done123'));
  assert.equal(saveDuelStore(storage,[active,completed]),true);
  const decoded=loadDuelStore(storage);
  assert.equal(decoded.length,2);
  assert.deepEqual(decoded[1].podium,completed.podium);
  assert.match(values.get(DUEL_STORAGE_KEY),/Friday Night/);
  values.set(DUEL_STORAGE_KEY,JSON.stringify({version:1,tournaments:[{id:'duel_fake123',status:'complete',entries:[]}]}));
  assert.deepEqual(loadDuelStore(storage),[]);
  values.set(DUEL_STORAGE_KEY,'not JSON');
  assert.deepEqual(loadDuelStore(storage),[]);
});

test('podium playlist CSV escapes metadata and contains only ranked podium, not unrelated tracks',()=>{
  let t=createTournament({id:'duel_csv123',name:'A, "special" cup',tracks:[{...songs[0],title:'A "great" song'},...songs.slice(1,4)]});
  t=playToFinish(t);
  const csv=podiumCsv(t);
  assert.match(csv,/"Rank",.*"Track Name".*"Artist Name"/);
  assert.match(csv,/"A, ""special"" cup"/);
  assert.match(csv,/"A ""great"" song"/);
  assert.equal(csv.trim().split('\r\n').length,4);
});

test('duel page renders live matchup, results, champions cup and preview actions',()=>{
  const t=create(4);
  let page=renderDuels({tournaments:[t],selectedId:t.id,catalog:songs,favorites:[]});
  assert.match(page,/data-duel-action="create"/);
  assert.match(page,/data-duel-play="deezer:1"/);
  assert.match(page,/data-duel-vote="deezer:2"/);
  assert.match(page,/Need 2 Champions/);
  const completed=playToFinish(t);
  page=renderDuels({tournaments:[completed],selectedId:completed.id,catalog:songs,favorites:[]});
  assert.match(page,/data-duel-action="save-podium"/);
  assert.match(page,/data-duel-action="export-podium"/);
  assert.match(page,/Third place/);
});

test('navigation includes Duels and player controls use the shared audio engine',()=>{
  const html=readFileSync(new URL('../app/public/index.html',import.meta.url),'utf8');
  const js=readFileSync(new URL('../app/public/main.js',import.meta.url),'utf8');
  assert.match(html,/data-view="duels"/);
  assert.match(js,/case 'duels': main.innerHTML = renderDuels/);
  assert.match(js,/duelPreview.*data-duel-play/);
  assert.match(js,/return togglePlayback\(duelTrack\(duelPreview.dataset.duelPlay\)\)/);
  assert.match(js,/voteActiveDuel/);
  assert.match(js,/state\.favorites\.push\(track\.id\)/);
});
