import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeRelatedArtists, interleaveArtistBranches } from '../src/discovery/graph.mjs';
import { selectNext } from '../src/taste.mjs';
import { DISCOVERY_MIXES, chooseListeningLane } from '../src/discovery/rotation.mjs';

const neighbors=(parent,count)=>Array.from({length:count},(_,i)=>({artist:`${parent} Neighbor ${i+1}`,because:parent}));

test('related branches are interleaved across all five seeds rather than first artist only',()=>{
 const graph=mergeRelatedArtists([],['A','B','C','D','E'].flatMap(name=>neighbors(name,15)),['A','B','C','D','E']);
 const ordered=interleaveArtistBranches(graph,15);
 assert.deepEqual(ordered.slice(0,5).map(x=>x.because),['A','B','C','D','E']);
 assert.equal(new Set(ordered.map(x=>x.artist)).size,15);
});

test('a liked new artist extends the graph beyond initial neighbors',()=>{
 const initial=mergeRelatedArtists([],neighbors('Harry Styles',15),['Harry Styles']);
 const followed=mergeRelatedArtists(initial,neighbors('Conan Gray',15),['Harry Styles']);
 assert.equal(followed.length,30);
 assert.equal(interleaveArtistBranches(followed,4).filter(x=>x.because==='Conan Gray').length,2);
});

test('graph is bounded and recent likes take priority without re-adding starter artists',()=>{
 const initial=mergeRelatedArtists([],neighbors('Harry Styles',90),['Harry Styles']);
 const expanded=mergeRelatedArtists(initial,[{artist:'Harry Styles',because:'X'},...neighbors('Liked Artist',3)],['Harry Styles']);
 assert.equal(expanded.length,90);
 assert.ok(expanded.some(x=>x.artist==='Liked Artist Neighbor 1'));
 assert.ok(!expanded.some(x=>x.artist==='Harry Styles'));
});

test('double passing a performer suppresses other songs from that artist when there are alternatives',()=>{
 const pool=[1,2,3].map(n=>({id:`deezer:${n}`,artist:n===3?'Other Artist':'Artist I Passed',genre:'pop',mood:'Bright'}));
 const history=[{id:'deezer:10',action:'pass',artist:'Artist I Passed'},{id:'deezer:11',action:'pass',artist:'Artist I Passed'}];
 assert.equal(selectNext(pool,history,'all',()=>0).artist,'Other Artist');
});

test('presentation quotas favor related performers in balanced and adventurous modes',()=>{
 const available=['favorite','related','broad'];
 const balanced=Array.from({length:10},(_,n)=>chooseListeningLane(n,'balanced',available));
 const explore=Array.from({length:10},(_,n)=>chooseListeningLane(n,'explore',available));
 assert.equal(balanced.filter(x=>x==='favorite').length,0);
 assert.equal(balanced.filter(x=>x==='related').length,5);
 assert.ok(explore.filter(x=>x==='broad').length>=7);
 assert.deepEqual(chooseListeningLane(1,'balanced',['favorite','broad']),'broad');
});
