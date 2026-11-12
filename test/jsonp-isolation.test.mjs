/** Regression: concurrent identical Deezer requests must not share abort fate.
 * Uses synthetic JSONP callbacks; does not contact Deezer or verify playback.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deezerJSONP} from '../app/src/static-adapter.mjs';

test('aborting one identical request does not cancel the other', async()=>{
  const scripts=[];
  const previousDocument=globalThis.document;
  const previousWindow=globalThis.window;
  globalThis.window=globalThis;
  globalThis.document={
    createElement:()=>({remove(){this.removed=true;}}),
    head:{append(script){scripts.push(script);}},
  };
  try{
    const firstAbort=new AbortController();
    const first=deezerJSONP('/search?q=ambient',{signal:firstAbort.signal,timeoutMs:500});
    const second=deezerJSONP('/search?q=ambient',{timeoutMs:500});
    assert.equal(scripts.length,2,'each caller must own its script and callback');
    const firstCallback=new URL(scripts[0].src).searchParams.get('callback');
    const secondCallback=new URL(scripts[1].src).searchParams.get('callback');
    assert.notEqual(firstCallback,secondCallback);
    firstAbort.abort();
    await assert.rejects(first,{name:'AbortError'});
    assert.equal(globalThis[firstCallback],undefined);
    assert.equal(scripts[0].removed,true);
    assert.equal(scripts[1].removed,undefined);
    globalThis[secondCallback]({data:[{id:42}]});
    assert.deepEqual(await second,{data:[{id:42}]});
    assert.equal(globalThis[secondCallback],undefined);
    assert.equal(scripts[1].removed,true);
  }finally{
    globalThis.document=previousDocument;
    globalThis.window=previousWindow;
  }
});
