import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInitialState} from '../app/src/taste.mjs';
import {COLLECTION_PAGE_SIZE,collectionPageModel} from '../app/src/collection-pagination.mjs';
import {createViews} from '../app/public/views.js';

const tracks=Array.from({length:123},(_,i)=>({
  id:`deezer:${8100001+i}`,source:'deezer',
  title:`Fixture Melody ${String(i+1).padStart(3,'0')}`,
  artist:`Fixture Artist ${(i%5)+1}`,
  genre:i%2?'rock':'pop',artwork:null,mood:'Warm',
}));
const ids=tracks.map(t=>t.id);
const render=(page=1,query='',sort='recent')=>{
  const state={...createInitialState(),favorites:ids,savedTracks:tracks};
  return createViews({state,catalog:tracks,current:null,allGenres:[],
    collectionQuery:query,collectionSort:sort,collectionPage:page}).renderCollection();
};
const idsOf=arr=>arr.map(t=>t.id);

test('123 saved songs appear as four stable pages of at most 40 cards',()=>{
  assert.equal(COLLECTION_PAGE_SIZE,40);
  const pages=[1,2,3,4].map(page=>collectionPageModel(tracks,ids,{page}));
  assert.deepEqual(pages.map(p=>p.visible.length),[40,40,40,3]);
  assert.deepEqual(pages.map(p=>p.page),[1,2,3,4]);
  assert.equal(pages[0].start,1);
  assert.equal(pages[0].end,40);
  assert.equal(pages[3].start,121);
  assert.equal(pages[3].end,123);
  assert.equal(pages[0].visible[0].id,tracks.at(-1).id);
  assert.equal(pages[3].visible.at(-1).id,tracks[0].id);
  assert.equal(new Set(pages.flatMap(p=>idsOf(p.visible))).size,tracks.length);
});

test('full-library search and stable sort apply before selecting a page',()=>{
  const match=collectionPageModel(tracks,ids,{query:'Fixture Melody 001',page:4});
  assert.equal(match.total,1);
  assert.equal(match.pages,1);
  assert.equal(match.page,1,'stale cursor must not become an empty phantom page');
  assert.equal(match.visible[0].id,tracks[0].id);
  const missing=collectionPageModel(tracks,ids,{query:'not an actual artist',page:80});
  assert.equal(missing.total,0);
  assert.equal(missing.page,1);
  assert.deepEqual(missing.visible,[]);
  const alphabetic=collectionPageModel(tracks,ids,{sort:'title',page:1});
  assert.equal(alphabetic.visible[0].id,tracks[0].id);
  assert.equal(alphabetic.visible.at(-1).id,tracks[39].id);
  const byArtist=collectionPageModel(tracks,ids,{sort:'artist',page:1});
  assert.ok(byArtist.visible.every(t=>t.artist==='Fixture Artist 1' ||
     t.artist==='Fixture Artist 2'), 'Artist grouping must be applied globally');
  assert.equal(collectionPageModel(tracks,ids,{page:NaN}).page,1);
  assert.equal(collectionPageModel(tracks,ids,{page:-17}).page,1);
  assert.equal(collectionPageModel(tracks,ids,{page:9000}).page,4);
});

test('Collection renders only selected cards while keeping full-library actions',()=>{
  const page1=render(1);
  const page4=render(4);
  assert.equal((page1.match(/class="track-tile"/g)||[]).length,40);
  assert.equal((page4.match(/class="track-tile"/g)||[]).length,3);
  assert.match(page1,/Songs 1–40 of 123 · Page 1 of 4/);
  assert.match(page4,/Songs 121–123 of 123 · Page 4 of 4/);
  assert.match(page4,/aria-label="Choose saved songs page"/);
  assert.match(page4,/aria-label="Previous saved songs page"/);
  assert.match(page4,/aria-label="Next saved songs page"/);
  assert.match(page4,/data-page="5" disabled/);
  assert.match(page1,/Backup Progress/);
  assert.match(page4,/Restore Backup/);
  assert.match(page4,/Export Library/);
  assert.match(page4,/CSV ↧/);
  assert.doesNotMatch(page1,/Fixture Melody 001/);
  assert.match(page4,/Fixture Melody 001/);
});

test('search match counts are global, even when the requested page was out of range',()=>{
  const match=render(4,'Fixture Melody 001');
  assert.match(match,/Showing 1 of 123 saved songs/);
  assert.equal((match.match(/class="track-tile"/g)||[]).length,1);
  assert.doesNotMatch(match,/id="collection-page-select"/);
  const missing=render(4,'missing song');
  assert.match(missing,/Showing 0 of 123 saved songs/);
  assert.match(missing,/No Matches/);
  assert.match(missing,/Show All Saved Songs/);
  assert.equal((missing.match(/class="track-tile"/g)||[]).length,0);
});

test('client-side navigation resets page on search/sort and focus follows the new page',()=>{
  const source=readFileSync(new URL('../app/public/main.js',import.meta.url),'utf8');
  assert.match(source,/let collectionPage = 1/);
  assert.match(source,/collectionQuery = event.target.value;\s*collectionPage=1;\s*render\(\)/);
  assert.match(source,/collectionSort=\['recent','title','artist'\][\s\S]*?collectionPage=1;\s*render\(\)/);
  assert.match(source,/case 'collection-page': \{[\s\S]*?collectionPage=targetPage;\s*render\(\)/);
  assert.match(source,/main.querySelector\('#collection-page-status'\)/);
  assert.match(source,/case 'collection':\s*main.innerHTML = pages.renderCollection\(\)/);
});
