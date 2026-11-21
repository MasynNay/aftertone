import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  nextDiscoveryRetry, DISCOVERY_RETRY_BASE_MS,
  DISCOVERY_RETRY_MAX_MS, DISCOVERY_RETRY_MAX_FAILURES
} from '../app/src/discovery/retry-policy.mjs';
import {createViews} from '../app/public/views.js';
import {createInitialState} from '../app/src/taste.mjs';

test('repeated background failures pause 20s, 40s, 80s, 160s and cap at three minutes',()=>{
  assert.equal(DISCOVERY_RETRY_BASE_MS,20_000);
  assert.equal(DISCOVERY_RETRY_MAX_MS,180_000);
  assert.equal(DISCOVERY_RETRY_MAX_FAILURES,8);
  const expected=[20_000,40_000,80_000,160_000,180_000,180_000,180_000,180_000];
  let failures=0;
  for(const [index,delayMs] of expected.entries()) {
    const now=1000+(index*200_000);
    const next=nextDiscoveryRetry(failures,now);
    assert.equal(next.failures,index+1);
    assert.equal(next.delayMs,delayMs);
    assert.equal(next.retryAt,now+delayMs);
    failures=next.failures;
  }
  const capped=nextDiscoveryRetry(failures,2000);
  assert.equal(capped.failures,8);
  assert.equal(capped.delayMs,180_000);
});
test('invalid/legacy failure counts never produce NaN, negative or unbounded delays',()=>{
  for(const x of [-100,-1,NaN,Infinity,-Infinity,undefined,2.4]) {
    const next=nextDiscoveryRetry(x,10_000);
    assert.ok(next.failures>=1&&next.failures<=DISCOVERY_RETRY_MAX_FAILURES);
    assert.ok(next.delayMs>=20_000&&next.delayMs<=180_000);
    assert.equal(next.retryAt,10_000+next.delayMs);
  }
  assert.equal(nextDiscoveryRetry(0,500).delayMs,20_000);
});
test('browser controller keeps retries scoped per feed and resets on successful page or manual retry',()=>{
  const src=readFileSync(new URL('../app/public/main.js',import.meta.url),'utf8');
  assert.match(src,/emptyRefills:0, retryAt:0, retryFailures:0/);
  assert.match(src,/if\(!showStatus && Date\.now\(\)<feed\.retryAt\) return/);
  assert.match(src,/if\(showStatus\) \{feed\.emptyRefills=0;feed\.retryFailures=0;\}/);
  assert.match(src,/nextDiscoveryRetry\(feed\.retryFailures,Date\.now\(\)\)/);
  assert.match(src,/feed\.retryFailures=retry\.failures/);
  assert.match(src,/feed\.retryAt=retry\.retryAt/);
  assert.match(src,/if \(successes\) \{[\s\S]{0,300}feed\.retryFailures=0;[\s\S]{0,90}feed\.retryAt=0/);
  assert.match(src,/if\(!getFeed\(\)\.hasMore\) \{ getFeed\(\)\.exhausted\.clear\(\); getFeed\(\)\.hasMore = true; \}/);
  assert.doesNotMatch(src,/feed\.retryAt=Date\.now\(\)\+20000/);
});
test('error state explains slower automatic retries while keeping explicit Retry button active',()=>{
  const pages=createViews({
    state:createInitialState(),catalog:[],current:null,allGenres:['all'],
    challengeIds:[],challengeResponses:[],catalogWarning:'',catalogLive:true,
    collectionQuery:'',collectionSort:'recent',
    feed:{loading:false,hasMore:true,primed:true,
      error:'Requests are temporarily limited. Wait a moment, then retry.',
      retryFailures:3,available:0}
  });
  const markup=pages.renderDiscovery();
  assert.match(markup,/Automatic discovery retries slow down/);
  assert.match(markup,/up to three minutes/);
  assert.match(markup,/data-action="load-more"/);
  assert.match(markup,/Retry Discovery/);
  assert.doesNotMatch(markup,/data-action="load-more" disabled/);
});
