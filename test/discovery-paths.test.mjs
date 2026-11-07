import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  planDiscoveryRequest, filterPoolForPath, chooseWildcardGenre,
  familiarArtistKeys, explainDiscovery, DISCOVERY_SCHEDULES, PATH_DESCRIPTIONS,
} from '../src/discovery/mode-engine.mjs';

const seeds=[{artist:'Harry Styles'},{artist:'Kacey Musgraves'}];
const related=[{artist:'Niall Horan',because:'Harry Styles'},{artist:'Maren Morris',because:'Kacey Musgraves'}];
const liked=[{artist:'Paramore'}];
const history=[{action:'like',artist:'Paramore',genre:'rock'},{action:'pass',artist:'Harry Styles',genre:'pop'}];
const pool=[
  {id:'deezer:1',artist:'Harry Styles',genre:'pop'},
  {id:'deezer:2',artist:'Kacey Musgraves',genre:'country'},
  {id:'deezer:3',artist:'Paramore',genre:'rock'},
  {id:'deezer:4',artist:'Niall Horan',genre:'pop'},
  {id:'deezer:5',artist:'Maren Morris',genre:'country'},
  {id:'deezer:6',artist:'Rina Sawayama',genre:'indie'},
  {id:'deezer:7',artist:'FKA twigs',genre:'electronic'},
];

const request = mode => planDiscoveryRequest({mode,requestNumber:0,seeds,related,liked,history});

test('the three paths request materially different discovery sources',()=>{
  assert.equal(request('familiar').kind,'liked');
  assert.equal(request('familiar').lane.artist,'Paramore');
  assert.equal(request('balanced').kind,'related');
  assert.equal(request('balanced').lane.artist,'Niall Horan');
  assert.equal(request('explore').kind,'wild');
  assert.notEqual(request('explore').genre,'rock');
});

test('wild card rotates across different genre-backed catalog requests',()=>{
  const genres=Array.from({length:8},(_,i)=>chooseWildcardGenre(i,history));
  assert.equal(new Set(genres).size,8);
  assert.ok(!genres.includes('rock'));
  assert.equal(chooseWildcardGenre(1,history,'pop'),'pop', 'an explicit genre choice is respected');
});

test('mode schedules do not reserve initial seed repeats for balanced or wild card',()=>{
  assert.ok(!DISCOVERY_SCHEDULES.balanced.includes('favorite'));
  assert.ok(!DISCOVERY_SCHEDULES.explore.includes('favorite'));
  assert.ok(DISCOVERY_SCHEDULES.familiar.includes('favorite'));
  assert.equal(DISCOVERY_SCHEDULES.explore.filter(x=>x==='wild').length,8);
});

test('Comfort Zone selects known performers and their graph neighbors',()=>{
  const artists=filterPoolForPath(pool,'familiar',{history,seeds,related}).map(t=>t.artist);
  assert.deepEqual(artists,['Harry Styles','Kacey Musgraves','Paramore','Niall Horan','Maren Morris']);
});

test('New Territory does not silently recycle starting or saved performers',()=>{
  const artists=filterPoolForPath(pool,'balanced',{history,seeds,related}).map(t=>t.artist);
  assert.deepEqual(artists,['Niall Horan','Maren Morris','Rina Sawayama','FKA twigs']);
  assert.deepEqual(filterPoolForPath(pool.slice(0,3),'balanced',{history,seeds,related}),[],
    'When no new artist is available, fetch again rather than claim familiarity is new');
});

test('Wild Card excludes saved performers, starters AND related-artist neighbors',()=>{
  const artists=filterPoolForPath(pool,'explore',{history,seeds,related}).map(t=>t.artist);
  assert.deepEqual(artists,['Rina Sawayama','FKA twigs']);
});

test('a search bypasses hard path exclusions and is isolated in its own feed',async()=>{
  const main=await readFile(new URL('../public/main.js',import.meta.url),'utf8');
  assert.match(main,/selectRouteQueue\(\{pool:available,feedIds:feed.ids/);
  assert.match(main,/const key = `\$\{genre\}:\$\{state.source\}:\$\{searchQuery\}/);
});

test('artist-lane lookups do not turn into broad artist-name search requests',async()=>{
  const main=await readFile(new URL('../public/main.js',import.meta.url),'utf8');
  assert.match(main,/if \(requestSearch\) query\.set\('q', requestSearch\)/);
  assert.match(main,/if \(lane\) query\.set\('seed_artist', lane\.artist\)/);
  assert.doesNotMatch(main,/if \(searchQuery \|\| lane\) query\.set\('q'/);
});

test('path explanations do not invent genre verification or subjective audio traits',()=>{
  assert.match(explainDiscovery({kind:'related',lane:{artist:'Niall Horan',because:'Harry Styles'}}),/Harry Styles/);
  assert.match(explainDiscovery({kind:'wild',genre:'jazz'}),/jazz/);
  assert.ok(Object.values(PATH_DESCRIPTIONS).every(value=>value.length>20));
});

test('disliked/familiar artist keys normalize unicode consistently',()=>{
  const result=familiarArtistKeys({history,seeds,related});
  assert.ok(result.saved.has('paramore'));
  assert.ok(result.seeds.has('harry styles'));
  assert.ok(result.related.has('niall horan'));
});

test('Music Duels uses the same monochrome glyph structure as the other sidebar items',async()=>{
  const page=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  assert.match(page, /data-view="duels"><span class="nav-icon"[^>]*>♕<\/span> Music Duels/);
  assert.doesNotMatch(page,/data-view="duels"[^\n]*<svg/);
});


test('New Territory alternates related and broad performers when both are available',()=>{
  const context={history,seeds,related};
  assert.deepEqual(filterPoolForPath(pool,'balanced',{...context,position:0}).map(x=>x.artist),['Niall Horan','Maren Morris']);
  assert.deepEqual(filterPoolForPath(pool,'balanced',{...context,position:1}).map(x=>x.artist),['Rina Sawayama','FKA twigs']);
});
