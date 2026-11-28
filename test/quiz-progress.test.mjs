import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadQuizStats,nextQuizStats,saveQuizStats,QUIZ_STORAGE_KEY} from '../app/src/quiz-progress.mjs';
function memory(initial=null) {
  let value=initial;
  return {getItem:key=>key===QUIZ_STORAGE_KEY?value:null,setItem:(key,next)=>{if(key===QUIZ_STORAGE_KEY)value=next;}};
}
test('quiz score is an immutable, bounded and verified update',()=>{
  const storage=memory();
  const first=loadQuizStats(storage);
  const next=nextQuizStats(first,true);
  assert.deepEqual(first,{answered:0,correct:0});
  assert.deepEqual(next,{answered:1,correct:1});
  assert.equal(saveQuizStats(storage,next),true);
  assert.deepEqual(loadQuizStats(storage),next);
  const wrong=nextQuizStats(next,false);
  assert.deepEqual(wrong,{answered:2,correct:1});
  assert.equal(saveQuizStats(storage,wrong),true);
  assert.equal(nextQuizStats({answered:1000000,correct:3},true),null);
});
test('silent drops, failed reads and blocked writes cannot report a saved score',()=>{
  const storage=memory('{"answered":4,"correct":3}');
  const stats=loadQuizStats(storage);
  const next=nextQuizStats(stats,true);
  const dropped={getItem:storage.getItem,setItem:()=>{}};
  assert.equal(saveQuizStats(dropped,next),false);
  assert.deepEqual(loadQuizStats(storage),stats);
  assert.equal(saveQuizStats({...storage,setItem:()=>{throw Error('quota');}},next),false);
  assert.equal(saveQuizStats({...storage,getItem:()=>{throw Error('blocked');}},next),false);
  assert.equal(saveQuizStats(storage,{answered:1,correct:2}),false);
});
test('legacy counters normalize without displaying an impossible score',()=>{
  assert.deepEqual(loadQuizStats(memory('{"answered":"4","correct":"3"}')),{answered:4,correct:3});
  for(const raw of ['{','{"answered":2,"correct":8}','{"answered":1.5,"correct":1}','{"answered":-1,"correct":0}'])
    assert.deepEqual(loadQuizStats(memory(raw)),{answered:0,correct:0});
});
test('the UI only reveals an answer after verified storage and retains retry controls on failure',()=>{
  const code=readFileSync(new URL('../app/public/main.js',import.meta.url),'utf8');
  const handler=code.split("const quizAnswer = event.target.closest('[data-quiz-answer]');")[1]
    .split("const quizMood=event.target.closest")[0];
  assert.ok(handler.indexOf('saveQuizStats(localStorage,nextStats)')<handler.indexOf('quizSession.answer=answer'));
  assert.match(handler,/quizSession\.saveError=true/);
  assert.match(handler,/quizSession\.saveError=false/);
  assert.match(handler,/data-quiz-answer/);
  const view=readFileSync(new URL('../app/public/views.js',import.meta.url),'utf8');
  assert.match(view,/Your answer was not confirmed as saved/);
});
