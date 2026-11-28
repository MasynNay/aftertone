import test from 'node:test';
import assert from 'node:assert/strict';
import {createTournament,nextDuelMatch,voteDuel,duelProgress,loadDuelStore,saveDuelStore,availableChampions,hallOfFame} from '../app/src/duels.mjs';
import {leagueSchedule,leagueStandings} from '../app/src/duel-league.mjs';
import {createProgressBackup,restoreProgressBackup} from '../app/src/progress-backup.mjs';
import {renderDuels} from '../app/public/duels-view.js';
const tracks=Array.from({length:16},(_,i)=>({id:'deezer:'+i,source:'deezer',title:'Song '+i,artist:'Artist '+i}));
const create=(n=4,themeId='open')=>createTournament({id:'duel_league123',tracks:tracks.slice(0,n),format:'league',themeId,createdAt:1});
const store=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}};
const finish=t=>{let next;while((next=nextDuelMatch(t)))t=voteDuel(t,next.id,next.a,2);return t;};
test('4, 8 and 16 song leagues have each unique pair once, one match per song per matchday',()=>{
  for(const n of [4,8,16]){
    const ids=tracks.slice(0,n).map(t=>t.id),rounds=leagueSchedule(ids);
    assert.equal(rounds.length,n-1);assert.equal(rounds.flat().length,n*(n-1)/2);
    const seen=new Set();
    for(const round of rounds){
      assert.equal(new Set(round.flatMap(m=>[m.a,m.b])).size,n);
      for(const m of round){const key=[m.a,m.b].sort().join('|');assert.ok(!seen.has(key));seen.add(key);}
    }
  }
});
test('league votes are immutable, sequential and resumable, with complete podium and Hall integration',()=>{
  for(const n of [4,8,16]){
    const start=create(n),s=store();let t=start;
    assert.throws(()=>voteDuel(t,t.rounds[0][1].id,t.rounds[0][1].a),/no longer active/);
    while(t.status==='active'){
      const m=nextDuelMatch(t);assert.equal(m.stage,'league');
      t=voteDuel(t,m.id,m.a,2);assert.ok(saveDuelStore(s,[t]));assert.deepEqual(loadDuelStore(s),[t]);
    }
    const total=n*(n-1)/2;
    assert.deepEqual(duelProgress(t),{done:total,total,remaining:0});
    assert.equal(start.rounds[0][0].winner,null);
    assert.equal(new Set(Object.values(t.podium)).size,3);
    assert.equal(leagueStandings(t).reduce((sum,r)=>sum+r.wins,0),total);
    assert.ok(leagueStandings(t).every(r=>r.played===n-1));
    assert.equal(availableChampions([t])[0].id,t.podium.first);
    assert.equal(hallOfFame([t])[0].id,t.podium.first);
  }
});
test('ties use tied-group wins then deterministic draw order',()=>{
  const t=create(4);
  const a='deezer:0',b='deezer:1',c='deezer:2',d='deezer:3';
  const wins=new Map([[a+'|'+b,a],[b+'|'+c,b],[a+'|'+c,c],[a+'|'+d,a],[b+'|'+d,b],[c+'|'+d,c]]);
  let current=t,m;while((m=nextDuelMatch(current)))current=voteDuel(current,m.id,wins.get([m.a,m.b].sort().join('|')),2);
  assert.deepEqual(leagueStandings(current).map(r=>r.id),[a,b,c,d]);
  assert.deepEqual(leagueStandings(current).slice(0,3).map(r=>r.tiebreakWins),[1,1,1]);
});
test('league archives reject schedule tampering, out-of-order votes and forged podiums; backups round-trip',()=>{
  const s=store(),valid=finish(create());
  saveDuelStore(s,[valid]);const data=createProgressBackup(s),target=store();
  restoreProgressBackup(target,data);assert.deepEqual(loadDuelStore(target),[valid]);
  for(const mutate of [t=>t.rounds[0][0].a=t.rounds[0][1].a,t=>t.rounds[0][0].winner=null,t=>t.podium.first=t.podium.second,t=>t.format='bogus']){
    const forged=structuredClone(valid);mutate(forged);saveDuelStore(s,[forged]);assert.deepEqual(loadDuelStore(s),[]);
    const backup=JSON.parse(data);backup.tournaments=[forged];
    assert.throws(()=>restoreProgressBackup(target,JSON.stringify(backup)),/damaged or unsupported/);
    assert.deepEqual(loadDuelStore(target),[valid]);
  }
});
test('league standings and matchday are visible but mystery metadata stays hidden until completion',()=>{
  const t=create(4,'mystery');
  const args={catalog:tracks,tournaments:[t],selectedId:t.id};
  const html=renderDuels(args);
  assert.match(html,/League Standings/);assert.match(html,/Matchday 1/);
  assert.match(html,/Mystery track 1/);assert.doesNotMatch(html,/Song 0|Artist 0/);
  assert.match(renderDuels({...args,tournaments:[finish(t)]}),/Song 0/);
});
