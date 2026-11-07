/** Guard a small set of brand, navigation, and interface naming conventions. */
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

test('portfolio navigation and section titles follow consistent title case',()=>{
  assert.match(site,/>Behind the Build<\/a>/);
  assert.match(site,/>Open App <span/);
  assert.match(site,/>Personalized Listening Paths<\/h3>/);
  assert.match(site,/>Provider-Aware Playback<\/h3>/);
  assert.match(site,/Explore the Experience/);
});

test('AFTERTONE app navigation and discovery modes use their canonical names',()=>{
  assert.match(app,/ Taste Map<\/button>/);
  assert.match(app,/Discover Your Sound<\/title>/);
  for(const name of ['Comfort Zone','New Territory','Wild Card']){
    assert.ok(discovery.includes(`'${name}'`),`${name} label should use its official capitalization`);
  }
});

test('Music Duels headings and standings use consistent spelling and capitalization',()=>{
  assert.match(duels,/Runners-up earn three/);
  assert.match(duels,/What Kind of Battle\?/);
  assert.match(duels,/Make a Little/);
  assert.match(duels,/Tournament History/);
  assert.doesNotMatch(duels,/Runner-ups/);
});