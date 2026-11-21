import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createViews} from '../app/public/views.js';
import {createInitialState} from '../app/src/taste.mjs';
import {
  CHALLENGE_DRAFT_KEY,readChallengeDraft,saveChallengeDraft,clearChallengeDraft
} from '../app/src/challenge-draft-store.mjs';

const ids=['deezer:9100001','deezer:9100002','deezer:9100003'];
function storageFixture(){
  const data=new Map();
  return {
    data,
    getItem:key=>data.has(key)?data.get(key):null,
    setItem:(key,value)=>{data.set(key,String(value));},
    removeItem:key=>{data.delete(key);}
  };
}
test('only public ID-only five-track drafts survive same-tab reload',()=>{
  const storage=storageFixture();
  const selection=[ids[2],ids[0]];
  assert.equal(readChallengeDraft(storage),null);
  assert.equal(saveChallengeDraft(storage,selection),true);
  assert.deepEqual(readChallengeDraft(storage),selection);
  assert.equal(storage.data.size,1);
  assert.deepEqual(Object.keys(JSON.parse(storage.data.get(CHALLENGE_DRAFT_KEY))),['version','ids']);
  assert.doesNotMatch(storage.data.get(CHALLENGE_DRAFT_KEY),/artist|title|preview|history|jellyfin|audio/);
  selection.push('jellyfin:secret');
  assert.deepEqual(readChallengeDraft(storage),[ids[2],ids[0]],
    'Mutating the original selection must not alter the saved draft');
});
test('an intentional empty draft persists and disables share, rather than reselecting the five latest',()=>{
  const storage=storageFixture();
  assert.equal(saveChallengeDraft(storage,[]),true);
  assert.deepEqual(readChallengeDraft(storage),[]);
  const markup=createViews({
    state:{...createInitialState(),favorites:[ids[0]]},
    catalog:[{id:ids[0],source:'deezer',title:'Recorded Song',artist:'Fixture'}],
    current:null,allGenres:['all'],challengeIds:[],challengeResponses:[],
    challengeDraft:readChallengeDraft(storage),challengeDraftSaved:true,
    catalogWarning:'',catalogLive:true,collectionQuery:'',collectionSort:'recent'
  }).renderChallenges();
  assert.match(markup,/No songs selected/);
  assert.match(markup,/data-action="share-challenge" disabled/);
  assert.match(markup,/custom selection is saved for reloads in this tab only/);
});
test('reset clears only this one session draft and preserves unrelated storage',()=>{
  const storage=storageFixture();
  storage.setItem('aftertone:session:v1','keep my collection');
  saveChallengeDraft(storage,[ids[0]]);
  assert.equal(clearChallengeDraft(storage),true);
  assert.equal(readChallengeDraft(storage),null);
  assert.equal(storage.getItem('aftertone:session:v1'),'keep my collection');
});
test('reject malformed, private, duplicate, or oversized draft IDs without writing',()=>{
  const storage=storageFixture();
  for(const selection of [
    ['jellyfin:private'], ['youtube:video'],['deezer:0'],
    ['deezer:01'],['deezer:abc'],[ids[0],ids[0]],
    Array.from({length:6},(_,i)=>'deezer:'+(9100010+i)),
    'deezer:9100001',null,{ids:[ids[0]]},
    [ids[0],{id:ids[1]}]
  ]){
    assert.equal(saveChallengeDraft(storage,selection),false);
  }
  assert.equal(storage.data.size,0);
});
test('refuse corrupted/future/oversized session storage without parsing into shared data',()=>{
  const storage=storageFixture();
  const malformed=[
    '{this is not JSON',
    JSON.stringify({version:2,ids}),
    JSON.stringify({version:1,ids:['deezer:5','jellyfin:private']}),
    JSON.stringify({version:1,ids:[ids[0],ids[0]]}),
    JSON.stringify({version:1,ids:'deezer:9100001'}),
    JSON.stringify({version:1}),
    JSON.stringify([ids[0]]),
    ' '.repeat(1024)
  ];
  for(const raw of malformed){
    storage.setItem(CHALLENGE_DRAFT_KEY,raw);
    assert.equal(readChallengeDraft(storage),null);
  }
});
test('blocked sessionStorage never crashes challenge editing',()=>{
  const blocked={
    getItem:()=>{throw new Error('Storage blocked');},
    setItem:()=>{throw new Error('Quota exceeded');},
    removeItem:()=>{throw new Error('Permission denied');}
  };
  assert.equal(readChallengeDraft(blocked),null);
  assert.equal(saveChallengeDraft(blocked,ids),false);
  assert.equal(clearChallengeDraft(blocked),false);
  assert.equal(readChallengeDraft(null),null);
  assert.equal(saveChallengeDraft(null,ids),false);
  assert.equal(clearChallengeDraft(null),false);
});
test('browser controller restores only after the saved catalog is hydrated and saves on editing',()=>{
  const source=readFileSync(new URL('../app/public/main.js',import.meta.url),'utf8');
  assert.match(source,/readChallengeDraft\(sessionStorage\)/);
  assert.match(source,/challengeDraftCustomized = restoredChallengeDraft !== null/);
  assert.match(source,/challengeDraftIds=challengeDraftCustomized\s*\?\s*reconcileChallengeDraft/);
  assert.match(source,/challengeDraftSaved=saveChallengeDraft\(sessionStorage,challengeDraftIds\)/);
  assert.match(source,/case 'reset-challenge-draft': \{[\s\S]*?resetChallengeDraft\(\)/);
  assert.match(source,/case 'move-challenge-down': \{[\s\S]*?storeChallengeDraft\(\)/);
  assert.match(source,/clearChallengeDraft\(sessionStorage\)/);
  assert.match(source,/addToCatalog\(state\.savedTracks\)/);
  assert.doesNotMatch(source,/localStorage\.setItem\(CHALLENGE_DRAFT_KEY/);
});
