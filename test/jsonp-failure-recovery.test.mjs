/** JSONP failure recovery contract: callback and script cleanup on errors.
 * Mocked DOM only; does not verify Deezer availability or media rights.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deezerJSONP} from '../app/src/static-adapter.mjs';

test('network error releases callback/script and leaves later requests usable',async()=>{
  const oldDocument=globalThis.document;
  const oldWindow=globalThis.window;
  const scripts=[];
  globalThis.window=globalThis;
  globalThis.document={
    createElement:()=>({remove(){this.removed=true;}}),
    head:{append(script){scripts.push(script);}},
  };
  try{
    const failed=deezerJSONP('/search?q=ambient',{timeoutMs:1000});
    const first=scripts.at(-1);
    const callback=new URL(first.src).searchParams.get('callback');
    first.onerror();
    await assert.rejects(failed,/unreachable/i);
    assert.equal(first.removed,true);
    assert.equal(globalThis[callback],undefined);

    const recovered=deezerJSONP('/search?q=ambient',{timeoutMs:1000});
    const second=scripts.at(-1);
    const nextCallback=new URL(second.src).searchParams.get('callback');
    assert.notEqual(nextCallback,callback);
    globalThis[nextCallback]({data:[{id:42}]});
    assert.deepEqual(await recovered,{data:[{id:42}]});
    assert.equal(second.removed,true);
    assert.equal(globalThis[nextCallback],undefined);
  }finally{
    globalThis.document=oldDocument;
    globalThis.window=oldWindow;
  }
});

test('timed out JSONP requests clean up and ignore late script errors',async()=>{
  const oldDocument=globalThis.document;
  const oldWindow=globalThis.window;
  let script;
  globalThis.window=globalThis;
  globalThis.document={
    createElement:()=>({remove(){this.removed=true;}}),
    head:{append(value){script=value;}},
  };
  try{
    const pending=deezerJSONP('/chart/0/tracks',{timeoutMs:5});
    const callback=new URL(script.src).searchParams.get('callback');
    await assert.rejects(pending,/did not respond/i);
    assert.equal(script.removed,true);
    assert.equal(globalThis[callback],undefined);
    assert.doesNotThrow(()=>script.onerror());
  }finally{
    globalThis.document=oldDocument;
    globalThis.window=oldWindow;
  }
});
