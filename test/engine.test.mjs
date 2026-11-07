import test from 'node:test';import assert from 'node:assert/strict';
import {TRACKS,byId,candidatesFor,chooseNext,whyTrack,createBracket,matchFor,vote,hallOfFame,chooseDuelTracks,DEMO_VERSION} from '../src/demo-engine.mjs';

test('demo release version is semver',()=>assert.match(DEMO_VERSION,/^\d+\.\d+\.\d+$/));
test('fictional track catalog has unique IDs and defined audio note sequences',()=>{assert.equal(TRACKS.length,12);assert.equal(new Set(TRACKS.map(t=>t.id)).size,12);for(const t of TRACKS){assert.ok(t.notes.length>0);assert.equal(t.color.length,2);assert.ok(t.root>0);}});
test('three modes start with different candidate pools',()=>{const a=candidatesFor('comfort').map(t=>t.id),b=candidatesFor('territory').map(t=>t.id),c=candidatesFor('wild').map(t=>t.id);assert.notDeepEqual(a,b);assert.notDeepEqual(b,c);assert.notDeepEqual(a,c);assert.ok(a.length&&b.length&&c.length);});
test('modes differ after saving a track',()=>{const a=candidatesFor('comfort',TRACKS,['orbit']).map(t=>t.id),b=candidatesFor('territory',TRACKS,['orbit']).map(t=>t.id),c=candidatesFor('wild',TRACKS,['orbit']).map(t=>t.id);assert.ok(a.length&&b.length&&c.length);assert.notDeepEqual(a,b);assert.notDeepEqual(b,c);});
test('wild mode excludes saved artists and shared genres',()=>{const items=candidatesFor('wild',TRACKS,['orbit']);assert.ok(items.every(t=>t.artist!==byId('orbit').artist&&t.genre!=='Electronic'));});
test('new territory excludes already saved performers',()=>{const items=candidatesFor('territory',TRACKS,['orbit']);assert.ok(items.every(t=>t.artist!==byId('orbit').artist));});
test('chooseNext avoids already heard tracks',()=>{const t=chooseNext('territory',[],['amber','mirrors']);assert.ok(!['amber','mirrors'].includes(t.id));});
test('chooseNext falls back when current route has no unheard tracks',()=>{const seen=TRACKS.map(t=>t.id);const t=chooseNext('comfort',[],seen,'amber');assert.ok(t&&t.id!=='amber');});
test('recommendations explain why song appears',()=>{for(const m of ['comfort','territory','wild'])assert.ok(whyTrack(m,TRACKS[0],['amber']).length>15);});
test('tournament requires exactly four unique tracks',()=>{assert.throws(()=>createBracket(['orbit','amber','amber','mirrors']));assert.throws(()=>createBracket(['orbit']));});
test('four-match bracket awards gold silver bronze in correct order',()=>{let cup=createBracket(['orbit','amber','mirrors','south']);assert.deepEqual(matchFor(cup),{label:'Semifinal 1',left:'orbit',right:'amber'});cup=vote(cup,'orbit');cup=vote(cup,'south');assert.deepEqual(matchFor(cup),{label:'Bronze Match',left:'amber',right:'mirrors'});cup=vote(cup,'mirrors');assert.deepEqual(matchFor(cup),{label:'Grand Final',left:'orbit',right:'south'});cup=vote(cup,'south');assert.deepEqual(cup.podium,['south','orbit','mirrors']);assert.equal(matchFor(cup),null);});
test('vote rejects nonexistent contender',()=>{assert.throws(()=>vote(createBracket(['orbit','amber','mirrors','south']),'gold'));});
test('Hall of Fame combines completed tournament podium points',()=>{const cups=[{podium:['orbit','amber','mirrors']},{podium:['amber','orbit','south']}];const entries=hallOfFame(cups);assert.equal(entries[0].points,8);assert.equal(entries[0].gold,1);assert.equal(entries[0].silver,1);});
test('Hall of Fame ignores unfinished brackets',()=>assert.deepEqual(hallOfFame([{podium:null}]),[]));
test('duel candidate selection uses saved songs if enough',()=>{assert.deepEqual(chooseDuelTracks(['orbit','amber','mirrors','south'],'favorites'),['orbit','amber','mirrors','south']);});
