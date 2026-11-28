import test from 'node:test';
import assert from 'node:assert/strict';
import {computeTaste,createInitialState,setSavedTrackMood} from '../app/src/taste.mjs';
import {makeRecognitionQuiz} from '../app/src/quiz.mjs';
import {collectionFacets} from '../app/src/collection-pagination.mjs';
import {saveState,loadState} from '../app/src/persistence.mjs';
import {createProgressBackup,restoreProgressBackup} from '../app/src/progress-backup.mjs';
test('missing metadata never erases genuine listening or recognition counts',()=>{
  const history=[
    {id:'deezer:1',action:'like',recognized:true,correct:true},
    {id:'deezer:2',action:'pass',correct:false},
    {id:'deezer:3',action:'like',genre:'rock',mood:'Warm',correct:'true'},
    {id:'deezer:4',action:'like',genre:'pop',mood:'Fresh',context:'search'},
    {id:'deezer:5',action:'unknown',correct:true},null
  ];
  const taste=computeTaste(history,[{id:'deezer:3',genre:'unknown'},{id:'deezer:4',genre:'all',mood:'Dreamy'}]);
  assert.equal(taste.total,4);assert.equal(taste.liked,3);assert.equal(taste.recognized,1);
  assert.equal(taste.answered,2);assert.equal(taste.correct,1);assert.equal(taste.accuracy,50);
  assert.equal(taste.identifiedGenres,2);assert.equal(taste.identifiedMoods,2);
  assert.deepEqual(taste.genres,[['rock',3],['pop',1.5]]);
  assert.deepEqual(taste.moods,[['Warm',3],['Dreamy',1.5]]);
});
const track={id:'deezer:42',title:'Fixture',artist:'Fixture Artist',genre:'rock',mood:'Fresh'};
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}};
test('mood for a favorite without decisions persists through restart and backup without inventing a vote',()=>{
  const state={...createInitialState(),favorites:[track.id]};
  const next=setSavedTrackMood(state,track,'Warm');
  assert.deepEqual(next.history,[]);assert.deepEqual(next.favorites,state.favorites);
  assert.equal(next.savedTracks[0].mood,'Warm');assert.equal(state.savedTracks.length,0);
  const s=storage(),target=storage();assert.ok(saveState(s,next));
  restoreProgressBackup(target,createProgressBackup(s));
  const restored=loadState(target);
  assert.equal(restored.savedTracks[0].mood,'Warm');
  assert.equal(collectionFacets(restored.savedTracks,restored.history).moodById.get(track.id),'Warm');
  assert.deepEqual(restored.history,[]);
});
test('mood synchronizes existing vote and durable track without changing favorite identity or count',()=>{
  const state={...createInitialState(),favorites:[track.id],savedTracks:[track],history:[{id:track.id,action:'like',at:42,mood:'Bright'}]};
  const next=setSavedTrackMood(state,track,'Dreamy');
  assert.deepEqual(next.history,[{...state.history[0],mood:'Dreamy'}]);
  assert.equal(next.savedTracks[0].mood,'Dreamy');assert.equal(track.mood,'Fresh');
  assert.equal(setSavedTrackMood(state,track,'Unknown'),state);
  assert.equal(setSavedTrackMood(createInitialState(),track,'Warm').favorites.length,0);
});
test('recognition decoys exclude missing metadata and case-equivalent correct answers',()=>{
  const quiz=makeRecognitionQuiz(track,[track,{id:'deezer:2'},{id:'deezer:3',artist:'fixture artist'},{id:'deezer:4',artist:'Other Artist'}],()=>.1);
  assert.deepEqual(new Set(quiz.options),new Set(['Fixture Artist','Other Artist']));
});
