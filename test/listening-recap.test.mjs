import test from 'node:test';
import assert from 'node:assert/strict';
import {listeningRecap} from '../app/src/listening-recap.mjs';
import {createInitialState} from '../app/src/taste.mjs';
import {createViews} from '../app/public/views.js';
const now=Date.UTC(2026,10,28,12);
const history=[
  {id:'a',action:'like',artist:'Beyoncé',genre:'Pop',at:Date.UTC(2026,10,22)},
  {id:'b',action:'pass',artist:'Beyonce',genre:'pop',at:now},
  {id:'c',action:'like',artist:'Old Artist',genre:'Rock',at:Date.UTC(2026,10,21,23,59)},
  {id:'d',action:'like',at:null},
  {id:'e',action:'pass',at:now+1},
  {id:'f',action:'skip',at:now}
];
test('recap applies UTC calendar windows and preserves undated decisions in all history',()=>{
  const week=listeningRecap(history,[],{period:'7',now});
  assert.equal(week.total,2);assert.equal(week.kept,1);assert.equal(week.keepRate,50);
  assert.equal(week.artists,1);assert.equal(week.activity.length,7);
  assert.equal(week.activity[0].date,'2026-11-22');assert.equal(week.activity[0].kept,1);
  assert.equal(week.activity.at(-1).passed,1);assert.equal(week.activeDays,2);
  assert.equal(week.undated,2);
  const month=listeningRecap(history,[],{period:'30',now});
  assert.equal(month.total,3);assert.equal(month.activity.length,30);
  const all=listeningRecap(history,[],{now});
  assert.equal(all.total,5);assert.equal(all.kept,3);assert.equal(all.keepRate,60);
  assert.equal(all.activity.length,14);assert.equal(all.dated,3);
  assert.equal(all.unknownArtist,2);assert.equal(all.topArtists[0].total,2);
});
test('recap uses genuine recovered metadata and excludes placeholders from identified artists',()=>{
  const h=[{id:'a',action:'like',artist:'Unknown artist'},{id:'b',action:'pass',artist:'Various Artists'}];
  const snapshot=JSON.stringify(h);
  const r=listeningRecap(h,[{id:'a',artist:'Recovered',genre:'Jazz'}],{now});
  assert.equal(r.artists,1);assert.equal(r.unknownArtist,1);
  assert.equal(r.topArtists[0].label,'Recovered');assert.equal(r.topGenres[0].label,'Jazz');
  assert.equal(JSON.stringify(h),snapshot);
});
test('empty recap has no invented rate or activity and artist rankings remain bounded',()=>{
  const empty=listeningRecap([],[],{period:'bad',now});
  assert.equal(empty.period,'all');assert.equal(empty.keepRate,null);assert.equal(empty.activeDays,0);
  const h=Array.from({length:200},(_,i)=>({id:'id'+i,artist:'Artist '+i,action:'like',at:now}));
  const r=listeningRecap(h,[],{period:'7',now});
  assert.equal(r.artists,200);assert.equal(r.topArtists.length,6);
  assert.equal(r.activity.at(-1).kept,200);
});
test('Taste Map renders accessible recap ranges, chart data and escaped artist drilldown',()=>{
  const state={...createInitialState(),history:[{id:'a',action:'like',artist:'<unsafe>',at:Date.now()}]};
  const html=createViews({state,catalog:[],current:null,allGenres:['all'],challengeIds:[],challengeResponses:[],recapPeriod:'7'}).renderTaste();
  assert.match(html,/Listening Recap/);assert.match(html,/data-period="7" aria-pressed="true"/);
  assert.equal((html.match(/class="recap-day"/g)||[]).length,7);
  assert.match(html,/Daily activity data/);assert.match(html,/data-artist="&lt;unsafe&gt;"/);
  assert.doesNotMatch(html,/<unsafe>/);
});
