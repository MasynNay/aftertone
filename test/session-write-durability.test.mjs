import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInitialState,recordChoice,removeFavorite,restoreRemovedFavorite,restoreLastChoice} from '../app/src/taste.mjs';
import {STORAGE_KEY,loadState,saveState} from '../app/src/persistence.mjs';

const track={id:'deezer:9100001',title:'Fixture Song',artist:'Fixture Artist',source:'deezer'};
const initial=createInitialState();
function memory() {
  const values=new Map();
  return {
    getItem:key=>values.get(key)??null,
    setItem:(key,val)=>values.set(key,val),
    removeItem:key=>values.delete(key),
  };
}

test('normal saved sessions round-trip exactly on verified local storage',()=>{
  const storage=memory();
  const next={...initial,favorites:[track.id],savedTracks:[track]};
  assert.equal(saveState(storage,next),true);
  assert.deepEqual(loadState(storage).favorites,[track.id]);
  assert.equal(storage.getItem(STORAGE_KEY),JSON.stringify(next));
});

test('silently dropped and ignored writes never report success or overwrite the old session',()=>{
  const storage=memory();
  assert.equal(saveState(storage,initial),true);
  const old=storage.getItem(STORAGE_KEY);
  const next=recordChoice(initial,{id:track.id,action:'like',artist:track.artist});
  const ignored={...storage,setItem:()=>undefined};
  assert.equal(saveState(ignored,next),false);
  assert.equal(storage.getItem(STORAGE_KEY),old);
  const blocked={...storage,setItem:()=>{throw new Error('QuotaExceededError');}};
  assert.equal(saveState(blocked,next),false);
  assert.equal(storage.getItem(STORAGE_KEY),old);
  const unreadable={...storage,getItem:()=>{throw new Error('read denied');}};
  assert.equal(saveState(unreadable,next),false);
});

test('a failed write stays retryable and never needs to fabricate a recovered favorite',()=>{
  const storage=memory();
  saveState(storage,initial);
  let block=true;
  const flaky={...storage,setItem:(key,payload)=>{
    if(!block)storage.setItem(key,payload);
  }};
  const candidate=recordChoice(initial,{id:track.id,action:'like',artist:track.artist});
  const withMetadata={...candidate,savedTracks:[track]};
  assert.equal(saveState(flaky,withMetadata),false);
  assert.deepEqual(loadState(storage).history,[]);
  block=false;
  assert.equal(saveState(flaky,withMetadata),true);
  assert.deepEqual(loadState(storage).favorites,[track.id]);
  const removed=removeFavorite(withMetadata,track.id);
  assert.equal(saveState(flaky,removed),true);
  assert.deepEqual(loadState(storage).favorites,[]);
  assert.equal(saveState(flaky,restoreRemovedFavorite(removed,track.id,0)),true);
  assert.equal(loadState(storage).favorites.length,1);
  assert.equal(saveState(flaky,restoreLastChoice(withMetadata)),true);
  assert.deepEqual(loadState(storage).history,[]);
  assert.deepEqual(loadState(storage).favorites,[]);
});

test('swipe, Undo and Collection changes are committed only after verified persistence',()=>{
  const source=readFileSync(new URL('../app/public/main.js',import.meta.url),'utf8');
  const commit=source.slice(source.indexOf('function commitSessionChange('),
    source.indexOf('const currentTheme = '));
  assert.match(commit,/if\(!saveState\(localStorage,next\)\)/);
  assert.match(commit,/return false;/);
  assert.match(commit,/state=next;\s*return true;/);
  const record=source.slice(source.indexOf('function recordDecision('),
    source.indexOf('function closeModal()'));
  assert.match(record,/if\(!commitSessionChange\(next\)\)/);
  assert.match(record,/if\(challengeIds.length\)challengeResponses.push/);
  assert.ok(record.indexOf('commitSessionChange(next)')<record.indexOf('challengeResponses.push'),
    'Shared challenge votes must follow verified storage');
  assert.ok(record.indexOf('commitSessionChange(next)')<record.indexOf('chooseNext();'),
    'A blocked Keep/Pass must never advance the queue');
  assert.doesNotMatch(record,/\bpersist\(\)/,'Do not double-save after committing');

  const ui=source.slice(source.indexOf("case 'undo': {"),
    source.indexOf("nav.addEventListener('click'"));
  assert.match(ui,/if\(!commitSessionChange\(restoreLastChoice\(state\)\)\)return;/);
  assert.match(ui,/if\(!commitSessionChange\(removeFavorite\(state,id\)\)\)return;/);
  assert.match(ui,/if\(restored!==state && !commitSessionChange\(restored\)\)return;/);
});

test('Music Duels collection saves and destructive resets never announce false success',()=>{
  const source=readFileSync(new URL('../app/public/main.js',import.meta.url),'utf8');
  const duels=source.slice(source.indexOf("if(action==='save-champions')"),
    source.indexOf('function voteActiveDuel('));
  assert.match(duels,/if\(!commitSessionChange\(next\)\)return;/);
  assert.match(duels,/return toast\(added\?/);
  assert.match(duels,/if\(action==='save-podium'\)/);
  assert.match(duels,/return toast\('The podium tracks are in your Collection.'/);
  const podium=duels.slice(duels.indexOf("if(action==='save-podium')"));
  assert.ok(podium.indexOf('commitSessionChange(next)')<podium.indexOf('addToCatalog([track])'));
  const champions=duels.slice(0,duels.indexOf("if(action==='create-cup')"));
  assert.ok(champions.indexOf('commitSessionChange(next)')<champions.indexOf('addToCatalog([track])'));
  const actions=source.slice(source.indexOf("case 'reset-listens':"),
    source.indexOf("case 'export-json':"));
  assert.match(actions,/if\(!commitSessionChange\(\{\.\.\.state,history:\[\]\}\)\)return;/);
  const quiz=source.slice(source.indexOf('const quizMood='),
    source.indexOf("const preview = event.target.closest('[data-preview]')"));
  assert.ok(quiz.indexOf('commitSessionChange(next)')<quiz.indexOf('quizSession.mood=mood;'));
});
