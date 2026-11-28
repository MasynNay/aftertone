import test from 'node:test';
import assert from 'node:assert/strict';
import {listeningJournal} from '../app/src/listening-journal.mjs';
import {createInitialState,recordChoice} from '../app/src/taste.mjs';
import {sanitizeState} from '../app/src/persistence.mjs';
import {getPassportProgress} from '../app/src/discovery/passport.mjs';
import {createViews} from '../app/public/views.js';
test('journal pages are newest-first, bounded, filterable and preserve old history',()=>{
  const history=Array.from({length:53},(_,i)=>({id:'deezer:'+i,title:'Song '+i,artist:'Artist',action:i%2?'pass':'like',route:'balanced',at:i+1}));
  const first=listeningJournal(history,[]);
  assert.deepEqual(first.counts,{all:53,like:27,pass:26});
  assert.equal(first.entries.length,20);assert.equal(first.entries[0].title,'Song 52');
  assert.equal(first.entries.at(-1).title,'Song 33');
  const last=listeningJournal(history,[],{page:99});
  assert.equal(last.page,3);assert.equal(last.entries.length,13);assert.equal(last.entries.at(-1).title,'Song 0');
  const pass=listeningJournal(history,[],{filter:'pass',page:2});
  assert.equal(pass.total,26);assert.equal(pass.entries.length,6);
  assert.ok(pass.entries.every(e=>e.action==='pass'));
  assert.equal(history[0].title,'Song 0');
});
test('path counts distinguish manual search and historical unspecified paths; missing names are honest',()=>{
  const h=[{id:'deezer:1',action:'pass',context:'search',route:'familiar'},{id:'deezer:2',action:'like',route:null},{id:'deezer:3',action:'like',route:'explore',at:-1}];
  const journal=listeningJournal(h,[{id:'deezer:1',title:'Known title',artist:'Known artist'}]);
  assert.deepEqual(journal.paths.map(p=>p.id),['explore','search','legacy']);
  assert.equal(journal.entries[0].at,null);assert.equal(journal.entries[0].title,null);
  assert.equal(journal.entries[2].title,'Known title');
});
test('new decisions retain title metadata but older saves do not fabricate it',()=>{
  const old=createInitialState();
  const next=recordChoice(old,{id:'deezer:1',action:'pass',title:'  Fixture song  ',artist:'Fixture artist'});
  assert.equal(sanitizeState(next).history[0].title,'Fixture song');
  assert.equal(Object.hasOwn(recordChoice(old,{id:'deezer:2',action:'like'}).history[0],'title'),false);
});
test('taste map exposes truthful Tune Lab accuracy and escapes journal metadata',()=>{
  const state={...createInitialState(),history:[{id:'deezer:1',action:'pass',title:'<script>fake</script>',artist:'Fixture',route:'explore'}]};
  const markup=createViews({state,catalog:[],current:null,allGenres:['all'],challengeIds:[],challengeResponses:[],quizStats:{answered:4,correct:3}}).renderTaste();
  assert.match(markup,/75%<\/strong><span>Tune Lab accuracy/);
  assert.match(markup,/data-filter="pass" aria-pressed="false">Passed \(1\)/);
  assert.match(markup,/&lt;script&gt;fake&lt;\/script&gt;/);
  assert.doesNotMatch(markup,/<script>/);
});

test('new shared challenge votes are not attributed to a discovery path or Wild Card quest',()=>{
  const next=recordChoice(createInitialState(),{id:'deezer:1',action:'pass',context:'challenge',route:'explore'});
  const history=sanitizeState(next).history;
  assert.equal(history[0].context,'challenge');
  assert.deepEqual(listeningJournal(history,[]).paths.map(p=>p.id),['challenge']);
  assert.equal(getPassportProgress(history).quests.find(q=>q.id==='orbit').progress,0);
});

test('journal combines accent-insensitive search, path and action across all pages without changing history',()=>{
  const history=Array.from({length:65},(_,i)=>({id:'deezer:'+i,title:'Café '+i,artist:'Beyoncé',action:i%2?'pass':'like',route:i%3?'balanced':'explore',...(i===64?{context:'challenge'}:{})}));
  const before=JSON.stringify(history);
  const result=listeningJournal(history,[],{query:'beyonce',filter:'like',path:'balanced',page:99});
  assert.equal(result.total,21);assert.equal(result.page,2);assert.equal(result.entries.length,1);
  assert.equal(result.counts.all,65);assert.equal(result.path,'balanced');
  assert.equal(listeningJournal(history,[],{path:'challenge',query:'cafe 64'}).total,1);
  assert.equal(listeningJournal(history,[],{query:'absent'}).total,0);
  assert.equal(listeningJournal(history,[],{path:'invalid'}).path,'all');
  assert.equal(JSON.stringify(history),before);
});
test('journal search uses actual historical or recovered names, never missing metadata placeholders',()=>{
  const history=[{id:'a',action:'like',title:'Original'},{id:'b',action:'pass'},{id:'c',action:'pass'}];
  const catalog=[{id:'a',title:'Replacement'},{id:'b',artist:'José'}];
  assert.equal(listeningJournal(history,catalog,{query:'jose'}).total,1);
  assert.equal(listeningJournal(history,catalog,{query:'replacement'}).total,0);
  assert.equal(listeningJournal(history,catalog,{query:'unavailable'}).total,0);
});
test('Taste Map renders real genre coverage and accessible journal controls',()=>{
  const state={...createInitialState(),history:[{id:'a',action:'like',genre:'rock',title:'<unsafe>'},{id:'b',action:'pass'}]};
  const html=createViews({state,catalog:[],current:null,allGenres:['all'],challengeIds:[],challengeResponses:[],journalQuery:'<unsafe>',journalPath:'legacy'}).renderTaste();
  assert.match(html,/1 of 2 choices have known genre information/);
  assert.doesNotMatch(html,/undefined of undefined/);
  assert.match(html,/id="journal-search"/);assert.match(html,/value="&lt;unsafe&gt;"/);
  assert.match(html,/data-path="legacy" aria-pressed="true"/);
  assert.match(html,/data-action="journal-clear"/);
});
