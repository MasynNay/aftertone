import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getPassportProgress } from '../app/src/discovery/passport.mjs';
import { createViews } from '../app/public/views.js';
import { createInitialState, recordChoice, restoreLastChoice } from '../app/src/taste.mjs';
import { sanitizeState } from '../app/src/persistence.mjs';
import { THEMES } from '../app/src/themes.mjs';

const track = {
  id: 'deezer:12345', title: 'Somewhere', artist: 'Singer One',
  genre: 'unknown', mood: 'Fresh', artwork: null, source: 'deezer',
};
function page(state = createInitialState(), quizStats={answered:0,correct:0}) {
  return createViews({state, catalog:[track],current:track,allGenres:['all'],
    challengeIds:[],challengeResponses:[],feed:{available:1},
    availableSources:['deezer'],collectionQuery:'',collectionSort:'recent',quizStats});
}

test('Passport starts empty; autoplay without a decision earns nothing',()=>{
 const p=getPassportProgress([],{});
 assert.equal(p.earned,0);
 assert.deepEqual(p.quests.map(q=>q.progress),[0,0,0,0]);
});

test('Passport rewards verified choices, distinct artists, wild card choices and Tune Lab answers',()=>{
 let state=createInitialState();
 const records=Array.from({length:7},(_,i)=>({ id:`deezer:${i+1}`,action:i<5?'like':'pass',artist:`Artist ${i+1}`,route:i>=2?'explore':'balanced',context:'discovery' }));
 for (const record of records) state=recordChoice(state,record);
 const p=getPassportProgress(state.history,{answered:5});
 assert.equal(p.quests[0].progress,3);
 assert.equal(p.quests[1].progress,5);
 assert.equal(p.quests[2].progress,5); // only five decisions occurred in Wild Card
 assert.equal(p.quests[2].completed,false);
 assert.equal(p.quests[3].completed,true);
 assert.equal(p.earned,3);
 // No hidden reset: all three real paths persist through storage hydration.
 assert.equal(sanitizeState(state).history[6].route,'explore');
});

test('Passport does not count temporary artist-search choices as Wild Card progress',()=>{
 const progress=getPassportProgress([
   {id:'deezer:1',action:'like',artist:'A',route:'explore',context:'search'},
   {id:'deezer:2',action:'pass',artist:'B',route:'explore',context:'discovery'},
   {id:'deezer:3',action:'pass',artist:'C',context:'discovery'},
 ]);
 assert.equal(progress.quests[2].progress,1);
});

test('Undo truly reverses a Passport choice and does not break older saved history',()=>{
 let state=recordChoice(createInitialState(),{id:'deezer:1',action:'like',artist:'A',route:'explore'});
 assert.equal(getPassportProgress(state.history).quests[0].value,1);
 state=restoreLastChoice(state);
 assert.equal(getPassportProgress(state.history).quests[0].value,0);
 const old=sanitizeState({...createInitialState(),history:[{id:'deezer:44',action:'pass',artist:'X'}]});
 assert.equal(old.history[0].route,null);
 assert.equal(getPassportProgress(old.history).quests[2].value,0);
});

test('Blind control is inside the playable card next to Undo, not in the filter panel',()=>{
 const card=page({...createInitialState(),blind:true}).renderDiscovery();
 const sequence=card.match(/class="decision-row decision-row-in-card"[^]*?<\/div>/)?.[0] || '';
 assert.match(sequence,/data-action="pass"[^]*data-action="undo"[^]*data-action="toggle-blind"[^]*data-action="like"/);
 assert.match(sequence,/aria-pressed="true"/);
 assert.doesNotMatch(page().renderSidebarPreferences(),/data-action="toggle-blind"/);
});

test('Passport has four real interactive goals and they are computed from the saved record',()=>{
 const html=page().renderDiscovery();
 assert.match(html,/YOUR DISCOVERY PASSPORT/);
 assert.match(html,/First sparks/);
 assert.match(html,/New voices/);
 assert.match(html,/Off the map/);
 assert.match(html,/Sharp ears/);
 assert.match(html,/data-action="passport-route"/);
 assert.match(html,/role="progressbar"/);
});

test('Theme popup lives in top navbar and all 20 palettes appear in its generated menu',()=>{
 const markup=readFileSync(new URL('../app/public/index.html',import.meta.url),'utf8');
 const app=readFileSync(new URL('../app/public/main.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../app/public/styles.css',import.meta.url),'utf8');
 assert.equal(THEMES.length,20);
 assert.match(markup,/<div class="topbar-actions">[^]*id="theme-menu-toggle"[^]*id="theme-menu"/);
 assert.match(markup,/aria-expanded="false"/);
 assert.doesNotMatch(markup,/id="theme-quick"|id="theme-browse"/);
 assert.match(app,/THEMES\.map\(t => `<button type="button" class="theme-menu-option"/);
 assert.match(app,/setThemeMenuOpen\(false, true\)/);
 assert.match(css,/\.theme-menu\[hidden\]/);
});
