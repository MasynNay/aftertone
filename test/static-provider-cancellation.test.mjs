/** Cancellation regressions for static Deezer routes beyond discovery.
 * All API records are fictional. This does not verify live playback or rights.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apiFetch} from '../app/src/static-adapter.mjs';

function useFakeDeezer() {
  const prior={
    window:globalThis.window,
    document:globalThis.document,
    location:globalThis.location,
  };
  const scripts=[];
  globalThis.window=globalThis;
  globalThis.location={
    hostname:'aftertone.masynnay.com',
    port:'',
    href:'https://aftertone.masynnay.com/demo/',
  };
  globalThis.document={
    createElement:()=>({async:false,remove(){this.removed=true;}}),
    head:{append(script){scripts.push(script);}},
  };
  return {
    scripts,
    async waitFor(count) {
      for(let attempt=0;attempt<100;attempt++) {
        if(scripts.length>=count) return scripts[count-1];
        await new Promise(resolve=>setTimeout(resolve,10));
      }
      assert.fail(`Expected ${count} Deezer requests but saw ${scripts.length}`);
    },
    respond(script,data) {
      const callback=new URL(script.src).searchParams.get('callback');
      assert.equal(typeof globalThis[callback],'function','Expected pending JSONP callback');
      globalThis[callback](data);
      return callback;
    },
    restore() {
      globalThis.window=prior.window;
      globalThis.document=prior.document;
      globalThis.location=prior.location;
    },
  };
}

test('canceling on-demand preview metadata stops its JSONP without a false provider error',async()=>{
  const fixture=useFakeDeezer();
  try {
    const controller=new AbortController();
    const pending=apiFetch('/api/audio?id=deezer%3A91234',{signal:controller.signal});
    const first=await fixture.waitFor(1);
    assert.equal(new URL(first.src).pathname,'/track/91234');
    const canceledCallback=new URL(first.src).searchParams.get('callback');
    controller.abort();
    await assert.rejects(pending,error=>error?.name==='AbortError');
    assert.equal(first.removed,true,'Cancel must remove the old script');
    assert.doesNotThrow(()=>globalThis[canceledCallback]?.({preview:'https://cdnt-preview.dzcdn.net/old.mp3'}));

    const retry=apiFetch('/api/audio?id=deezer%3A91234');
    const second=await fixture.waitFor(2);
    fixture.respond(second,{id:91234,preview:'https://cdnt-preview.dzcdn.net/fresh.mp3'});
    const response=await retry;
    assert.equal(response.status,200);
    assert.equal((await response.json()).url,'https://cdnt-preview.dzcdn.net/fresh.mp3');
    assert.equal(fixture.scripts.length,2);
  }finally{fixture.restore();}
});

test('canceling a Deezer playlist mid-pagination prevents additional pages',async()=>{
  const fixture=useFakeDeezer();
  try {
    const controller=new AbortController();
    const route='/api/playlist-link?url='+encodeURIComponent('https://www.deezer.com/playlist/54321');
    const pending=apiFetch(route,{signal:controller.signal});
    const meta=await fixture.waitFor(1);
    assert.equal(new URL(meta.src).pathname,'/playlist/54321');
    fixture.respond(meta,{title:'Example playlist',nb_tracks:200});
    const page=await fixture.waitFor(2);
    assert.equal(new URL(page.src).pathname,'/playlist/54321/tracks');
    assert.equal(new URL(page.src).searchParams.get('index'),'0');
    const canceledCallback=new URL(page.src).searchParams.get('callback');
    controller.abort();
    await assert.rejects(pending,error=>error?.name==='AbortError');
    assert.equal(page.removed,true);
    assert.doesNotThrow(()=>globalThis[canceledCallback]?.({data:[]}));
    assert.equal(fixture.scripts.length,2,'No page 2 may start after cancellation');
  }finally{fixture.restore();}
});

test('canceling one related-artist lookup does not cancel a concurrent listener',async()=>{
  const fixture=useFakeDeezer();
  try {
    const artist='Independent Test Artist 20261118';
    const route='/api/related-artists?artist='+encodeURIComponent(artist);
    const firstController=new AbortController();
    const secondController=new AbortController();
    const abandoned=apiFetch(route,{signal:firstController.signal});
    const active=apiFetch(route,{signal:secondController.signal});
    const secondSearch=await fixture.waitFor(2);
    assert.equal(new URL(fixture.scripts[0].src).pathname,'/search/artist');
    assert.equal(new URL(secondSearch.src).pathname,'/search/artist',
      'Two independent callers require separate abortable requests');
    firstController.abort();
    await assert.rejects(abandoned,error=>error?.name==='AbortError');
    assert.equal(fixture.scripts[0].removed,true);
    assert.equal(secondSearch.removed,undefined,'Cancel must not remove the other script');
    fixture.respond(secondSearch,{data:[{id:51234,name:artist}]});
    const related=await fixture.waitFor(3);
    assert.equal(new URL(related.src).pathname,'/artist/51234/related');
    fixture.respond(related,{data:[{id:51235,name:'Adjacent Example Artist',nb_fan:500}]});
    const response=await active;
    assert.equal(response.status,200);
    const result=await response.json();
    assert.equal(result.matched,true);
    assert.equal(result.related[0].artist,'Adjacent Example Artist');
    assert.equal(fixture.scripts.length,3,'Canceled request must not start follow-on lookups');
  }finally{fixture.restore();}
});
