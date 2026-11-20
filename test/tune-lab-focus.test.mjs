import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createViews} from '../app/public/views.js';
import {createInitialState} from '../app/src/taste.mjs';

const main=readFileSync(new URL('../app/public/main.js',import.meta.url),'utf8');
const sample={id:'deezer:501',title:'Fixture Song',artist:'Fixture Artist',genre:'pop'};
function quizMarkup(answer=null,mood=null) {
  const state={...createInitialState(),favorites:[sample.id]};
  const views=createViews({state,catalog:[sample],current:null,allGenres:['all','pop'],
    challengeIds:[],challengeResponses:[],catalogWarning:'',catalogLive:true,
    collectionQuery:'',collectionSort:'recent',
    quizSession:{id:sample.id,answer,mood,
      quiz:{field:'artist',label:'Who made this track?',correct:sample.artist,
        options:[sample.artist,'Another Artist']}}});
  return views.renderQuizLab();
}

test('Tune Lab result is focusable and announces just the answer feedback',()=>{
  const markup=quizMarkup(0);
  assert.match(markup,/id="quiz-feedback" tabindex="-1" role="status" aria-live="polite"/);
  assert.match(markup,/✓ Correct!/);
  assert.match(markup,/class="quiz-answer correct"[^>]*disabled/);
});

test('mood options communicate one selected state and form a labeled group',()=>{
  const markup=quizMarkup(0,'Warm');
  assert.match(markup,/class="quiz-moods" role="group" aria-label="What feeling does this song bring\?"/);
  assert.match(markup,/data-quiz-mood="Warm"[^>]*aria-pressed="true"/);
  assert.match(markup,/data-quiz-mood="Bright"[^>]*aria-pressed="false"/);
  assert.equal((markup.match(/aria-pressed="true"/g)||[]).length,1);
});

test('question transitions replace disappearing controls with real focus targets',()=>{
  const round=main.slice(main.indexOf('function startQuizRound()'),
    main.indexOf('function playSampleChallenge()'));
  assert.match(round,/returnFocus=view==='quiz'/);
  assert.match(round,/\[data-action="quiz-start"\], \[data-action="quiz-next"\]/);
  assert.match(round,/main\.querySelector\('\[data-quiz-answer\]:not\(:disabled\)'\)/);
  assert.match(round,/main\.querySelector\('\[data-action="quiz-next"\]'\)/);
  const answer=main.slice(main.indexOf("const quizAnswer = event.target.closest('[data-quiz-answer]');"),
    main.indexOf("const quizMood=event.target.closest('[data-quiz-mood]');"));
  assert.match(answer,/const returnFocus=document\.activeElement===quizAnswer/);
  assert.match(answer,/main\.querySelector\('#quiz-feedback'\)/);
  assert.match(answer,/render\(\);/);
});

test('rerendering a selected mood retains keyboard focus on the replacement choice',()=>{
  const render=main.slice(main.indexOf('function render()'),main.indexOf('function renderModal()'));
  assert.match(render,/const focusedQuizMood=view==='quiz'/);
  assert.match(render,/focusedOldControl\?\.matches\?\.\('\[data-quiz-mood\]'\)/);
  assert.match(render,/if\(focusedQuizMood && view==='quiz'\)/);
  assert.match(render,/replacement\.focus\(\{preventScroll:true\}\)/);
});
