import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../app/public/main.js',import.meta.url),'utf8');
test('pending choices are invalidated on navigation, new tracks, modal opening and undo',()=>{
  for(const name of ['stopContinuous','chooseNext','openModal']) {
    const body=code.split('function '+name+'(')[1].split('\n}')[0];
    assert.match(body,/cancelPendingChoice\(\)/);
  }
  assert.match(code,/clearTimeout\(choice\.timer\)/);
  assert.match(code,/if\(pendingChoice!==choice\)return/);
  assert.match(code,/current\?\.id!==selected/);
  assert.match(code,/challengeIds!==choice\.challenge/);
  assert.match(code,/getFeed\(\)!==choice\.feed/);
  assert.match(code,/animatingChoice \|\| advancingPreview/);
});
test('late decision focus cannot steal focus from a different control',()=>{
  assert.match(code,/document\.activeElement===choice\.origin \|\| document\.activeElement===document\.body/);
});
