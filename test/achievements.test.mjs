import test from 'node:test';
import assert from 'node:assert/strict';
import {achievementCabinet,filterAchievements} from '../app/src/achievements.mjs';
import {createInitialState,recordChoice,restoreLastChoice} from '../app/src/taste.mjs';
import {createViews} from '../app/public/views.js';
const now=Date.UTC(2026,10,28);
const get=(c,id)=>c.cards.find(x=>x.id===id);
test('fresh cabinet has 19 distinct milestones, no autoplay or default progress',()=>{
  const c=achievementCabinet();
  assert.equal(c.total,19);assert.equal(c.earned,0);
  assert.equal(new Set(c.cards.map(x=>x.id)).size,19);
  assert.equal(filterAchievements(c,'earned').length,0);
  assert.equal(filterAchievements(c,'in-progress').length,19);
});
test('decisions are unique and verified paths exclude search/challenge, days need not be consecutive',()=>{
  const history=[
    {id:'a',action:'like',artist:'Beyoncé',genre:'Rock',route:'explore',at:now-86400000*10},
    {id:'b',action:'like',artist:'Beyonce',genre:'rock',route:'balanced',at:now},
    {id:'b',action:'like',artist:'Beyonce',genre:'rock',route:'balanced',at:now},
    {id:'c',action:'like',artist:'Unknown artist',genre:'all',route:'familiar',context:'search',at:now+1},
    {id:'d',action:'pass',route:'explore',context:'challenge',at:0},
    {id:'e',action:'skip',route:'familiar',at:now}
  ];
  const c=achievementCabinet({state:{history},now});
  assert.equal(get(c,'fifty-choices').value,4);assert.equal(get(c,'ten-artists').value,1);
  assert.equal(get(c,'five-genres').value,1);assert.equal(get(c,'wild-twenty').value,1);
  assert.equal(get(c,'all-paths').value,2);assert.equal(get(c,'seven-days').value,2);
});
test('saved tracks, nonempty playlists and mood tags reflect current collection without votes',()=>{
  const favorites=Array.from({length:10},(_,i)=>'deezer:'+i);
  const state={favorites,history:[],personalPlaylists:[{trackIds:[favorites[0]]},{trackIds:['missing']},{trackIds:[]}]};
  const catalog=favorites.map((id,i)=>({id,mood:i%2?'Dreamy':'Fresh'}));
  const c=achievementCabinet({state,catalog});
  assert.equal(get(c,'ten-saved').earned,true);assert.equal(get(c,'three-playlists').value,1);
  assert.equal(get(c,'four-moods').value,1);assert.equal(get(c,'first-choice').earned,false);
});
test('quiz and completed leagues/cups are distinct, and Undo reverses progress',()=>{
  const state=recordChoice(createInitialState(),{id:'deezer:1',action:'pass'});
  const tournaments=[{status:'active',format:'league'},{status:'complete',format:'league',podium:{first:'a'}},{status:'complete',kind:'champions',podium:{first:'b'}}];
  const c=achievementCabinet({state,tournaments,quizStats:{answered:10,correct:8}});
  assert.equal(get(c,'quiz-ten').earned,true);assert.equal(get(c,'quiz-correct').value,8);
  assert.equal(get(c,'duel-five').value,2);assert.equal(get(c,'league-first').earned,true);
  assert.equal(get(c,'champions-cup').earned,true);
  assert.equal(get(achievementCabinet({state:restoreLastChoice(state)}),'first-choice').earned,false);
});
test('cabinet filters, progress labels and discovery link are rendered without storage changes',()=>{
  const state=recordChoice(createInitialState(),{id:'deezer:1',action:'pass'});
  const before=JSON.stringify(state);
  const views=createViews({state,catalog:[],current:null,allGenres:['all'],challengeIds:[],challengeResponses:[],achievementFilter:'earned'});
  const html=views.renderTaste();
  assert.match(html,/Achievement Cabinet/);assert.match(html,/1 of 19 milestones shown/);
  assert.match(html,/data-achievement-id="first-choice"/);
  assert.doesNotMatch(html,/data-achievement-id="hundred-choices"/);
  assert.equal(JSON.stringify(state),before);
});
