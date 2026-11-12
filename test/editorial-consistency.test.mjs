/** Keep public-facing product language consistent with the live app. */
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {test} from 'node:test';
import assert from 'node:assert/strict';

const root=resolve(import.meta.dirname,'..');
const source=path=>readFileSync(resolve(root,path),'utf8');
const site=source('site/index.html');
const app=source('app/public/index.html');
const discovery=source('app/public/views.js');
const duels=source('app/public/duels-view.js');

test('homepage advertises the app clearly without pitching an engineering portfolio',()=>{
  assert.match(site,/Tune in<\/a>/);
  assert.match(site,/>Music Duels<\/a>/);
  assert.match(site,/>Launch the app <span/);
  assert.match(site,/Comfort Zone/);
  assert.match(site,/New Territory/);
  assert.match(site,/Wild Card/);
  assert.match(site,/Open Music Duels/);
  assert.doesNotMatch(site,/portfolio|engineering case study/i);
});

test('AFTERTONE app navigation and discovery paths use canonical names',()=>{
  assert.match(app,/ Taste Map<\/button>/);
  assert.match(app,/Discover Your Sound<\/title>/);
  for(const name of ['Comfort Zone','New Territory','Wild Card']){
    assert.ok(discovery.includes("'"+name+"'"),name+' should be capitalized consistently');
  }
});

test('Music Duels headings and standings use correct spelling',()=>{
  assert.match(duels,/Runners-up earn three/);
  assert.match(duels,/What Kind of Battle\?/);
  assert.match(duels,/Make a Little/);
  assert.match(duels,/Tournament History/);
  assert.doesNotMatch(duels,/Runner-ups/);
});