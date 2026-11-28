import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInitialState} from '../app/src/taste.mjs';
import {collectionFacets,collectionPageModel} from '../app/src/collection-pagination.mjs';
import {createViews} from '../app/public/views.js';

const tracks=Array.from({length:123},(_,i)=>({
  id:'deezer:'+(8600001+i),source:'deezer',
  title:'Fixture Song '+String(i+1).padStart(3,'0'),
  artist:'Fixture Artist '+(i%7+1),
  genre:i%2?'rock':'pop',
  mood:['Warm','Dreamy','Reflective'][i%3],
  artwork:null,
}));
const ids=tracks.map(t=>t.id);
const history=[{id:tracks[0].id,action:'like',mood:'Bright',recognized:true}];
const state={...createInitialState(),favorites:ids,savedTracks:tracks,history};
const render=(genre='all',mood='all',query='',page=1)=>{
  return createViews({state,catalog:tracks,current:null,allGenres:[],
    collectionQuery:query,collectionSort:'recent',collectionPage:page,
    collectionGenre:genre,collectionMood:mood}).renderCollection();
};

test('facet values and counts use the entire library, not the first 40 rendered songs',()=>{
  const facets=collectionFacets(tracks,history);
  assert.deepEqual(facets.genres,[{value:'pop',count:62},{value:'rock',count:61}]);
  assert.deepEqual(facets.moods,[
    {value:'Dreamy',count:41},{value:'Reflective',count:41},
    {value:'Warm',count:40},{value:'Bright',count:1},
  ]);
  assert.equal(facets.moodById.get(tracks[0].id),'Bright');
  assert.equal(facets.eventById.get(tracks[0].id)?.recognized,true);
  assert.equal(facets.moodById.get(tracks[1].id),'Dreamy');
  assert.equal(facets.eventById.has(tracks[1].id),false);
});

test('genre and mood intersections remain global before paging and sorting',()=>{
  const facets=collectionFacets(tracks,history);
  const pop=collectionPageModel(tracks,ids,{genre:'pop',page:2,moodById:facets.moodById});
  assert.equal(pop.total,62);
  assert.equal(pop.pages,2);
  assert.equal(pop.visible.length,22);
  assert.ok(pop.visible.every(t=>t.genre==='pop'));
  const dreamy=collectionPageModel(tracks,ids,{mood:'Dreamy',page:2,moodById:facets.moodById});
  assert.equal(dreamy.total,41);
  assert.equal(dreamy.visible.length,1);
  assert.ok(dreamy.visible.every(t=>facets.moodById.get(t.id)==='Dreamy'));
  const combined=collectionPageModel(tracks,ids,{genre:'rock',mood:'Dreamy',page:8,
    moodById:facets.moodById});
  assert.equal(combined.total,21);
  assert.equal(combined.page,1,'stale cursor clamps after changing a facet');
  assert.ok(combined.visible.every(t=>t.genre==='rock' &&
    facets.moodById.get(t.id)==='Dreamy'));
  const one=collectionPageModel(tracks,ids,{genre:'pop',mood:'Bright',
    query:'fixture song 001',moodById:facets.moodById});
  assert.equal(one.total,1);
  assert.equal(one.visible[0].id,tracks[0].id);
  const none=collectionPageModel(tracks,ids,{genre:'rock',mood:'Bright',
    moodById:facets.moodById});
  assert.equal(none.total,0);
  assert.equal(none.page,1);
});

test('Collection dropdowns, result status and clear actions reflect combined filters',()=>{
  const filtered=render('rock','Dreamy');
  assert.match(filtered,/id="collection-genre"/);
  assert.match(filtered,/id="collection-mood"/);
  assert.match(filtered,/aria-label="Filter saved songs by genre"/);
  assert.match(filtered,/aria-label="Filter saved songs by mood"/);
  assert.match(filtered,/<option value="rock" selected>rock \(61\)<\/option>/);
  assert.match(filtered,/<option value="Dreamy" selected>Dreamy \(41\)<\/option>/);
  assert.match(filtered,/Showing 21 of 123 saved songs/);
  assert.equal((filtered.match(/class="track-tile"/g)||[]).length,21);
  assert.match(filtered,/data-action="clear-collection-filters"/);
  assert.match(filtered,/data-action="export-csv"/);
  assert.match(filtered,/data-action="backup-progress"/);
  assert.match(filtered,/data-action="restore-progress"/);
  const empty=render('rock','Bright');
  assert.match(empty,/No Matches/);
  assert.match(empty,/Show All Saved Songs/);
  assert.match(empty,/data-action="clear-collection-filters"/);
  assert.match(empty,/Showing 0 of 123 saved songs/);
  assert.equal((empty.match(/class="track-tile"/g)||[]).length,0);
  assert.match(render('all','all','Fixture Song 001'),/data-action="clear-collection-search"/);
  const unfiltered=render();
  assert.doesNotMatch(unfiltered,/data-action="clear-collection-filters"/);
  assert.equal((unfiltered.match(/class="track-tile"/g)||[]).length,40);
});

test('unknown facets are not fabricated and input labels escape untrusted tags',()=>{
  const strange=[{id:'deezer:5',title:'A',artist:'B',genre:'<img onerror=bad()>',mood:'<script>alert(1)</script>'},
    {id:'deezer:6',title:'C',artist:'D',genre:'unknown',mood:'Fresh'}];
  const facets=collectionFacets(strange,[]);
  assert.equal(facets.genres.length,1);
  assert.equal(facets.moods.length,1);
  const state={...createInitialState(),favorites:strange.map(t=>t.id)};
  const html=createViews({state,catalog:strange,current:null,allGenres:[],
    collectionQuery:'',collectionSort:'recent',collectionGenre:'all',collectionMood:'all'}).renderCollection();
  assert.doesNotMatch(html,/<img onerror=bad\(\)>|<script>alert\(1\)<\/script>/);
  assert.match(html,/&lt;img onerror=bad\(\)&gt;/);
  assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test('filter selection resets paging and keeps keyboard focus; clear is browse-only',()=>{
  const source=readFileSync(new URL('../app/public/main.js',import.meta.url),'utf8');
  assert.match(source,/let collectionGenre = 'all'/);
  assert.match(source,/let collectionMood = 'all'/);
  assert.match(source,/if\(event.target.id==='collection-genre' \|\| event.target.id==='collection-mood'\)/);
  assert.match(source,/collectionPage=1;\s*render\(\);\s*\/\/ The select has been replaced/);
  assert.match(source,/\$\('#'\+previousId\)\?\.focus\(\{preventScroll:true\}\)/);
  assert.match(source,/case 'clear-collection-filters': \{/);
  assert.match(source,/collectionQuery='';collectionGenre='all';collectionMood='all';collectionPage=1;/);
  assert.doesNotMatch(source,/localStorage\.setItem\('collection-genre'/);
});

test('mixed-case, padded and accented tags collapse without changing original metadata',()=>{
  const sample=[
    {id:'deezer:9700001',title:'Fjörd Song',artist:'Björk',genre:' Rock ',mood:' Dreamy '},
    {id:'deezer:9700002',title:'Second Song',artist:'Bjork',genre:'rock',mood:'dreamy'},
    {id:'deezer:9700003',title:'Third Song',artist:'Other',genre:'ROCK',mood:'DREAMY'},
    {id:'deezer:9700004',title:'Fourth Song',artist:'Other',genre:'pop',mood:'Fresh'},
    {id:'deezer:9700005',title:'Fifth Song',artist:'Other',genre:'unknown',mood:'Warm'},
  ];
  const history=[
    {id:sample[1].id,action:'like',mood:'  '},
    {id:sample[2].id,action:'like',mood:'Fresh'},
  ];
  const ids=sample.map(t=>t.id);
  const untouched=JSON.stringify({sample,history});
  const facets=collectionFacets(sample,history);
  assert.deepEqual(facets.genres,[{value:'Rock',count:3},{value:'pop',count:1}]);
  assert.deepEqual(facets.moods,[{value:'Dreamy',count:3},{value:'Warm',count:1}]);
  assert.equal(facets.moodById.get(sample[1].id),'dreamy');
  assert.equal(facets.moodById.get(sample[2].id),'DREAMY');
  const filtered=collectionPageModel(sample,ids,{
    genre:'rOcK',mood:'dReAmY',moodById:facets.moodById,
  });
  assert.equal(filtered.total,3);
  assert.equal(collectionPageModel(sample,ids,{genre:'Rock',mood:'Dreamy',
    query:'bjork',moodById:facets.moodById}).total,2);
  assert.equal(collectionPageModel(sample,ids,{query:'fjord'}).visible[0].id,sample[0].id);
  assert.equal(collectionPageModel(sample,ids,{query:'  FJÖRD  '}).total,1);
  const state={...createInitialState(),favorites:ids,savedTracks:sample,history};
  const ui=createViews({state,catalog:sample,current:null,allGenres:[],
    collectionGenre:'ROCK',collectionMood:'dreamy'}).renderCollection();
  assert.match(ui,/<option value="Rock" selected>Rock \(3\)<\/option>/);
  assert.match(ui,/<option value="Dreamy" selected>Dreamy \(3\)<\/option>/);
  assert.match(ui,/Showing 3 of 5 saved songs/);
  assert.equal(JSON.stringify({sample,history}),untouched,'faceting is browse-only');
});
