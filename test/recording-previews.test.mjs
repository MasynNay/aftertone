import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState } from '../app/src/taste.mjs';
import { sanitizeState } from '../app/src/persistence.mjs';
import { validDeezerPreview, resolveDeezerPreview, normalizeDeezerTrack } from '../app/src/deezer.mjs';
import { createServer } from '../app/server.mjs';
import { createViews } from '../app/public/views.js';

const preview='https://cdnt-preview.dzcdn.net/api/1/1/12345.mp3?exp=1';
test('Old recording checkbox preference disappears during migration and is never re-saved',()=>{
  const old={...createInitialState(),originalsOnly:false};
  const now=sanitizeState(old);
  assert.equal(Object.hasOwn(now,'originalsOnly'),false);
  assert.equal(Object.hasOwn(createInitialState(),'originalsOnly'),false);
  const controls=createViews({state:now,catalog:[],current:null,allGenres:['all'],challengeIds:[],challengeResponses:[],feed:{}}).renderSidebarPreferences();
  assert.doesNotMatch(controls,/original recordings only|original tracks only|toggle-originals/i);
  const js=readFileSync(new URL('../app/public/main.js',import.meta.url),'utf8');
  assert.doesNotMatch(js,/state\.originalsOnly|toggle-originals|originals:/);
});
test('Only Deezer CDN HTTPS preview links may be played, not arbitrary user URLs',()=>{
  assert.equal(validDeezerPreview(preview),preview);
  assert.equal(validDeezerPreview('http://cdnt-preview.dzcdn.net/test.mp3'),null);
  assert.equal(validDeezerPreview('https://dzcdn.net.evil.example/audio.mp3'),null);
  assert.equal(validDeezerPreview('https://example.com/file.mp3'),null);
});
test('Deezer audio resolver returns a short-lived URL without proxying or storing audio',async()=>{
 const fetcher=async(url)=>{
  assert.match(String(url),/api\.deezer\.com\/track\/12345/);
  return {ok:true,json:async()=>({id:12345,preview})};
 };
 const result=await resolveDeezerPreview('12345',fetcher);
 assert.equal(result.url,preview); assert.equal(result.ttlSeconds,480);
 await assert.rejects(()=>resolveDeezerPreview('../secret',fetcher),/Invalid/);
});
test('Deezer preview resolver is reachable from the local server without a personal API key',async()=>{
 const server=createServer({fetcher:async()=>({ok:true,json:async()=>({id:12345,preview})})});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 try {
 const response=await fetch(`http://127.0.0.1:${server.address().port}/api/audio?id=deezer:12345`);
 assert.equal(response.status,200); const data=await response.json();
 assert.equal(data.url,preview); assert.ok(!data.fallbackUrl);
 }finally{await new Promise(ok=>server.close(ok));}
});
test('Search excludes tracks without a usable provider preview instead of showing dead Play buttons',()=>{
 const base={id:12345,title:'bad guy',artist:{name:'Billie Eilish'},readable:true,duration:194,album:{cover_medium:'https://e-cdns-images.dzcdn.net/cover.jpg'}};
 assert.equal(normalizeDeezerTrack(base),null);
 assert.equal(normalizeDeezerTrack({...base,preview}).title,'bad guy');
});

test('Continuous listening may advance Deezer songs without opening a provider iframe',()=>{
 const js=readFileSync(new URL('../app/public/main.js',import.meta.url),'utf8');
 assert.match(js,/function maybeResumeContinuous\(\)/);
 assert.match(js,/if \(current\.source === 'youtube'\)/);
 assert.doesNotMatch(js,/\['youtube','deezer'\]\.includes\(current\.source\)/);
 assert.match(js,/maybeResumeContinuous\(\);/);
 assert.match(js,/if \(event\.code === 'Space'\)/);
});
