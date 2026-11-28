import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {collectionInsights} from '../app/src/collection-insights.mjs';
import {createViews} from '../app/public/views.js';
import {createInitialState} from '../app/src/taste.mjs';

const tracks=[
  {id:'deezer:71',artist:'Björk',title:'One',genre:'Rock',mood:'Dreamy'},
  {id:'deezer:72',artist:'BJORK',title:'Two',genre:' rock ',mood:'dreamy'},
  {id:'deezer:73',artist:'Other',title:'Three',genre:'Jazz',mood:'Warm'},
  {id:'deezer:74',artist:'',title:'Four',genre:'unknown',mood:'Fresh'},
];
const ids=[...tracks.map(t=>t.id),'deezer:9999'];
const history=[{id:tracks[1].id,action:'like',mood:'Fresh'}];

test('insights are global, normalize artist identities and disclose missing metadata',()=>{
  const before=JSON.stringify({tracks,ids,history});
  const stats=collectionInsights(tracks,ids,history);
  assert.deepEqual({saved:stats.saved,available:stats.available,missing:stats.missing,artists:stats.artists,
    genres:stats.genres,moods:stats.moods},
    {saved:5,available:4,missing:1,artists:2,genres:2,moods:2});
  assert.deepEqual(stats.topGenres,[{value:'Rock',count:2},{value:'Jazz',count:1}]);
  assert.deepEqual(stats.topMoods,[{value:'Dreamy',count:2},{value:'Warm',count:1}]);
  assert.equal(JSON.stringify({tracks,ids,history}),before);
});
test('visible overview shows full-library counts and accessible shortcuts',()=>{
  const state={...createInitialState(),favorites:ids,savedTracks:tracks,history};
  const html=createViews({state,catalog:tracks,current:null,allGenres:[],
    collectionGenre:'rock',collectionMood:'all'}).renderCollection();
  assert.match(html,/Your Collection at a glance/);
  assert.match(html,/5<\/strong><span>Saved songs/);
  assert.match(html,/2<\/strong><span>Artists/);
  assert.match(html,/1 saved song ID lacks track details/);
  assert.match(html,/data-action="collection-quick-filter"/);
  assert.match(html,/data-filter-value="Rock"/);
  assert.match(html,/aria-pressed="true" class="collection-insights-chip is-selected"/);
  assert.match(html,/Showing 2 of 4 saved songs/);
  assert.match(html,/data-action="backup-progress"/);
});
test('empty Collection and untrusted tag labels do not create misleading shortcuts',()=>{
  const state=createInitialState();
  const empty=createViews({state,catalog:[],current:null,allGenres:[]}).renderCollection();
  assert.doesNotMatch(empty,/class="collection-insights"/);
  const odd=[{id:'deezer:8',artist:'Artist',title:'Song',genre:'<img onerror=alert(1)>',mood:'Warm'}];
  const markup=createViews({state:{...state,favorites:[odd[0].id]},catalog:odd,
    current:null,allGenres:[]}).renderCollection();
  assert.doesNotMatch(markup,/<img onerror=alert\(1\)>/);
  assert.match(markup,/&lt;img onerror=alert\(1\)&gt;/);
});
test('quick filtering toggles view-only facets and preserves keyboard focus',()=>{
  const code=readFileSync(new URL('../app/public/main.js',import.meta.url),'utf8');
  const handler=code.split("case 'collection-quick-filter':")[1]?.split("case 'clear-collection-filters':")[0]||'';
  assert.match(handler,/collectionPage=1/);
  assert.match(handler,/collectionSearchKey\(currentValue\)===collectionSearchKey\(value\)\?'all':value/);
  assert.match(handler,/\.focus\(\{preventScroll:true\}\)/);
  assert.doesNotMatch(handler,/persist\(|commitSessionChange\(|localStorage|recordDecision/);
});
