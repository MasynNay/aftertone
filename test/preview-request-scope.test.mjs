import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPreviewRequestScope} from '../app/src/discovery/preview-request-scope.mjs';

test('concurrent Play requests for the same song share one provider operation',async()=>{
  const scope=createPreviewRequestScope();
  let calls=0;
  let complete;
  const task=async signal=>{
    calls++;
    assert.equal(signal.aborted,false);
    return new Promise(resolve=>{complete=resolve;});
  };
  const first=scope.run('deezer:901',task);
  const second=scope.run('deezer:901',task);
  assert.strictEqual(first,second,'A duplicate Play must not double the provider requests');
  assert.equal(scope.size(),1);
  await Promise.resolve();
  assert.equal(calls,1);
  complete({url:'https://fixture.invalid/preview.mp3'});
  assert.deepEqual(await first,await second);
  assert.equal(scope.size(),0);
});

test('Stop aborts pending preview metadata and a fresh Play may retry',async()=>{
  const scope=createPreviewRequestScope();
  let started;
  const ready=new Promise(resolve=>{started=resolve;});
  const waiting=scope.run('deezer:902',signal=>{
    started(signal);
    return new Promise((_resolve,reject)=>{
      signal.addEventListener('abort',()=>reject(new DOMException('Canceled','AbortError')),{once:true});
    });
  });
  const signal=await ready;
  assert.equal(signal.aborted,false);
  scope.cancelAll();
  assert.equal(signal.aborted,true);
  assert.equal(scope.size(),0);
  await assert.rejects(waiting,error=>error?.name==='AbortError');
  let calls=0;
  const retry=await scope.run('deezer:902',async freshSignal=>{
    calls++;
    assert.equal(freshSignal.aborted,false);
    return {url:'https://fixture.invalid/fresh.mp3'};
  });
  assert.equal(calls,1);
  assert.equal(retry.url,'https://fixture.invalid/fresh.mp3');
  assert.equal(scope.size(),0);
});

test('an old canceled request cannot delete a later in-flight retry',async()=>{
  const scope=createPreviewRequestScope();
  let finishOld,finishNew;
  const stale=scope.run('deezer:903',signal=>new Promise(resolve=>{
    finishOld=()=>resolve({aborted:signal.aborted});
  }));
  await Promise.resolve();
  scope.cancelAll();
  const fresh=scope.run('deezer:903',signal=>new Promise(resolve=>{
    finishNew=()=>resolve({aborted:signal.aborted});
  }));
  await Promise.resolve();
  assert.equal(scope.size(),1);
  finishOld();
  assert.deepEqual(await stale,{aborted:true});
  assert.equal(scope.size(),1,'Old finally must not remove the new request');
  finishNew();
  assert.deepEqual(await fresh,{aborted:false});
  assert.equal(scope.size(),0);
});

test('canceled work must never run if Stop happens before the request microtask',async()=>{
  const scope=createPreviewRequestScope();
  let providerCalls=0;
  const old=scope.run('deezer:904',()=>{providerCalls++;return {url:'no'};});
  scope.cancelAll();
  await assert.rejects(old,error=>error?.name==='AbortError');
  assert.equal(providerCalls,0);
});

test('browser player passes cancellation to adapter and does not cache canceled previews',()=>{
  const main=readFileSync(new URL('../app/public/main.js',import.meta.url),'utf8');
  assert.match(main,/import \{ createPreviewRequestScope \} from '\/src\/discovery\/preview-request-scope\.mjs'/);
  const stop=main.slice(main.indexOf('function stopAudio()'),main.indexOf('async function resolveAudio'));
  assert.match(stop,/previewRequestScope\.cancelAll\(\)/);
  const resolve=main.slice(main.indexOf('async function resolveAudio'),main.indexOf('function prewarm'));
  assert.match(resolve,/previewRequestScope\.run\(track\.id, async signal => \{/);
  assert.match(resolve,/apiFetch\(\`\/api\/audio\?id=\$\{encodeURIComponent\(track\.id\)\}\`,\{signal\}\)/);
  assert.match(resolve,/signal\.throwIfAborted\(\)[\s\S]*?resolved\.set\(track\.id, payload\)/);
});
