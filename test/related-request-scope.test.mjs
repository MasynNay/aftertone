/** Related graph cancellation is per taste-profile generation, not per
 * individual like or view render. Fixture-only tests; no Deezer network.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRelatedRequestScope} from '../app/src/discovery/related-request-scope.mjs';

test('switching taste profiles cancels old lookups but keeps new requests alive',async()=>{
  const scope=createRelatedRequestScope();
  const original=scope.signal;
  assert.equal(original.aborted,false);
  let canceled=0;
  original.addEventListener('abort',()=>canceled++,{once:true});
  const interrupted=new Promise((resolve,reject)=>{
    original.addEventListener('abort',()=>reject(new DOMException('Canceled','AbortError')),{once:true});
  });
  const next=scope.advance();
  assert.equal(original.aborted,true);
  assert.equal(canceled,1);
  assert.equal(next.aborted,false);
  assert.equal(scope.signal,next);
  await assert.rejects(interrupted,error=>error?.name==='AbortError');

  // Another transition must not re-fire the original listener, and must
  // abort only the previous generation (not this new third generation).
  const third=scope.advance();
  assert.equal(canceled,1);
  assert.equal(next.aborted,true);
  assert.equal(third.aborted,false);
  assert.notEqual(third,next);
});

test('all artist graph routes forward the current profile signal',()=>{
  const src=readFileSync(new URL('../app/public/main.js',import.meta.url),'utf8');
  assert.match(src,/import \{ createRelatedRequestScope \} from '\/src\/discovery\/related-request-scope\.mjs'/);
  assert.match(src,/function advanceSeedVersion\(\) \{[\s\S]*?relatedRequestScope\.advance\(\);[\s\S]*?return \+\+seedVersion;/);
  assert.equal((src.match(/advanceSeedVersion\(\)/g)||[]).length,7,
    'Six profile transitions must invalidate old related lookups');
  assert.equal((src.match(/seedVersion\+\+/g)||[]).length,0,
    'Never increment the profile generation without canceling its requests');
  assert.equal((src.match(/const signal=relatedRequestScope\.signal;/g)||[]).length,3);
  assert.equal((src.match(/await apiFetch\(`\/api\/related-artists\?artist=\$\{encodeURIComponent\([^)]*\)\}\`,\{signal\}\)/g)||[]).length,3);
  for(const fn of ['findRelatedForPlaylist','warmRelatedFromSaved','expandRelatedFromLike']) {
    const start=src.indexOf('async function '+fn+'(');
    assert.ok(start>=0,fn+' must remain present');
    const next=src.indexOf('\nasync function ',start+1);
    const part=src.slice(start,next>=0?next:start+2300);
    assert.match(part,/signal\.aborted/,fn+' must ignore canceled work');
    assert.match(part,/version!==seedVersion/,fn+' must reject old generations');
  }
});
