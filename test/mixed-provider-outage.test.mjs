import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {eligibleProviders} from '../app/src/discovery/provider-availability.mjs';

const controller=readFileSync(new URL('../app/public/main.js',import.meta.url),'utf8');

test('temporary failures skip a source only for the active mixed-provider batch',()=>{
  const configured=['audius','jellyfin','jamendo','commons'];
  const exhausted=new Set(['commons']); // genuine successful end-of-catalog response
  const failedThisBatch=new Set();
  assert.deepEqual(eligibleProviders(configured,exhausted,failedThisBatch),
    ['audius','jellyfin','jamendo']);

  // A timeout at Audius should not be retried 5 times in one refill.
  failedThisBatch.add('audius');
  assert.deepEqual(eligibleProviders(configured,exhausted,failedThisBatch),
    ['jellyfin','jamendo']);
  // A Jellyfin outage must not prevent the remaining provider from loading.
  failedThisBatch.add('jellyfin');
  assert.deepEqual(eligibleProviders(configured,exhausted,failedThisBatch),
    ['jamendo']);
  failedThisBatch.add('jamendo');
  assert.deepEqual(eligibleProviders(configured,exhausted,failedThisBatch),[]);
  // Running out of working providers *this time* is not permanent exhaustion.
  assert.deepEqual([...exhausted],['commons']);
  assert.deepEqual(eligibleProviders(configured,exhausted,new Set()),
    ['audius','jellyfin','jamendo'],
    'Next user retry or refill must consider temporarily failing sources again');
});

test('explicit Retry Discovery remains possible after all sources have a transient outage',()=>{
  const configured=['audius','jamendo'];
  const exhausted=new Set();
  const failedThisBatch=new Set(configured);
  assert.deepEqual(eligibleProviders(configured,exhausted,failedThisBatch),[]);
  assert.equal(configured.some(source=>!exhausted.has(source)),true,
    'A transient outage must not set the lasting hasMore flag to false');
  assert.deepEqual(eligibleProviders(configured,exhausted,new Set()),configured);
});

test('actual app uses batch-local failure exclusion rather than poisoning permanent exhaustion',()=>{
  assert.match(controller,/import \{ eligibleProviders \} from '\/src\/discovery\/provider-availability\.mjs'/);
  const loadMore=controller.slice(controller.indexOf('async function loadMore('),
    controller.indexOf('function autoRefillTick()'));
  assert.match(loadMore,/const failedThisBatch = new Set\(\)/);
  assert.match(loadMore,/eligibleProviders\(sourceOrder\(\), feed\.exhausted, failedThisBatch\)/);
  assert.match(loadMore,/failedThisBatch\.add\(source\)/);
  assert.doesNotMatch(loadMore,/feed\.exhausted\.add\(source\)/,
    'Temporary HTTP failures must not permanently exhaust the entire source');
  assert.match(loadMore,/feed\.exhausted\.add\(cursorKey\)/,
    'Successfully confirmed end-of-catalog must still stop pagination');
  assert.match(loadMore,/feed\.retryAt=Date\.now\(\)\+20000/,
    'Bounded retry backoff must remain active on upstream failures');
  assert.match(loadMore,/if \(!showStatus && Date\.now\(\)<feed\.retryAt\) return/,
    'User-initiated retries should still override a background cooldown');
});
