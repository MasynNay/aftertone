/** Regression: Deezer's JSONP may deliver an API error inside HTTP 200. 
 * Fictional fixtures only: no real provider or media authorization asserted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveDeezerPreview} from '../app/src/deezer.mjs';
import {apiFetch} from '../app/src/static-adapter.mjs';
import {createServer} from '../app/server.mjs';

const validPreview='https://cdnt-preview.dzcdn.net/preview/test123.mp3';
const providerError={error:{code:429,message:'Temporary provider quota reached'}};
const successful={id:41,preview:validPreview};

test('HTTP 200 Deezer error envelopes differ from missing, malformed and working previews', async()=>{
  const fetcher=data=>async()=>({ok:true,status:200,json:async()=>data});
  await assert.rejects(resolveDeezerPreview('41',fetcher(providerError)),
    /Deezer rejected the preview request: Temporary provider quota reached/);
  await assert.rejects(resolveDeezerPreview('41',fetcher({error:{code:800}})),
    /Deezer rejected the preview request: 800/);
  await assert.rejects(resolveDeezerPreview('41',fetcher(null)),
    /Deezer returned invalid preview metadata/);
  await assert.rejects(resolveDeezerPreview('41',fetcher({id:41,preview:''})),
    /Deezer has no playable preview/);
  const result=await resolveDeezerPreview('41',fetcher(successful));
  assert.equal(result.url,validPreview);
  assert.equal(result.ttlSeconds,480);
});

test('local Node preview endpoint exposes a retryable provider rejection then recovers', async()=>{
  let fail=true;
  const fetcher=async()=>({ok:true,status:200,json:async()=>fail?providerError:successful});
  const server=createServer({fetcher});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}/api/audio?id=deezer%3A41`;
  try {
    let response=await fetch(url);
    assert.equal(response.status,502);
    let payload=await response.json();
    assert.match(payload.detail,/Deezer rejected the preview request/);
    assert.equal(payload.url,undefined);
    fail=false;
    response=await fetch(url);
    assert.equal(response.status,200);
    payload=await response.json();
    assert.equal(payload.url,validPreview);
  } finally { await new Promise(resolve=>server.close(resolve)); }
});

test('GitHub Pages JSONP preview preserves provider quota status 429 and succeeds on retry', async()=>{
  const previous={window:globalThis.window,document:globalThis.document,location:globalThis.location};
  let fail=true;
  const requests=[];
  globalThis.window=globalThis;
  globalThis.location={hostname:'aftertone.masynnay.com',port:'',href:'https://aftertone.masynnay.com/demo/'};
  globalThis.document={
    createElement:()=>({remove(){this.removed=true;}}),
    head:{append(script){
      requests.push(script);
      const callback=new URL(script.src).searchParams.get('callback');
      queueMicrotask(()=>globalThis[callback]?.(fail?providerError:successful));
    }},
  };
  try {
    let response=await apiFetch('/api/audio?id=deezer%3A41');
    assert.equal(response.status,429);
    const error=await response.json();
    assert.match(error.error,/Deezer rejected the preview request: Temporary provider quota reached/);
    assert.match(error.error,/Requests are temporarily limited.*Wait a moment, then retry/);
    assert.equal(error.url,undefined);
    assert.equal(requests[0].removed,true);
    fail=false;
    response=await apiFetch('/api/audio?id=deezer%3A41');
    assert.equal(response.status,200);
    assert.equal((await response.json()).url,validPreview);
    assert.equal(requests[1].removed,true);
    assert.equal(requests.length,2);
  } finally {
    globalThis.window=previous.window;
    globalThis.document=previous.document;
    globalThis.location=previous.location;
  }
});
