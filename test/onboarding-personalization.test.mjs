import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseFavoriteArtists, artistSeedProfile, fromActiveFeed, likedArtistLanes } from '../app/src/discovery-personalization.mjs';
import { computeTaste, createInitialState, recordChoice, selectNext } from '../app/src/taste.mjs';
import { sanitizeState } from '../app/src/persistence.mjs';
import { createViews } from '../app/public/views.js';

test('first-run artist entry trims, deduplicates, caps, and never treats Spotify URLs as artist names', () => {
  const names=parseFavoriteArtists('Harry Styles, Kacey Musgraves\nParamore;harry styles\nhttps://example.com');
  assert.deepEqual(names,['Harry Styles','Kacey Musgraves','Paramore']);
  assert.equal(parseFavoriteArtists(Array.from({length:20},(_,n)=>`Artist ${n}`).join(',' )).length,5);
  assert.deepEqual(artistSeedProfile(names).artists.map(x=>x.artist),names);
  assert.deepEqual(parseFavoriteArtists(['Tyler, The Creator','AC/DC','Tyler, The Creator']),['Tyler, The Creator','AC/DC']);
});

test('search results stay inside their own feed even after clearing the query', () => {
  const searching=new Set(['deezer:555']);
  const fresh=new Set(['deezer:123']);
  assert.equal(fromActiveFeed({id:'deezer:555',source:'deezer'},searching),true);
  assert.equal(fromActiveFeed({id:'deezer:555',source:'deezer'},fresh),false);
  assert.equal(fromActiveFeed({id:'deezer:123',source:'deezer'},fresh),true);
  assert.equal(fromActiveFeed({id:'deezer:123',source:'youtube'},fresh),false);
});

test('searching does not bias taste, while liking a search result supplies a smaller signal', () => {
  const track={id:'deezer:111',artist:'Harry Styles',title:'As It Was',genre:'pop',mood:'Bright'};
  assert.deepEqual(computeTaste([], [track]).genres, []);
  const result=recordChoice(createInitialState(),{id:track.id,action:'like',artist:track.artist,genre:track.genre,context:'search'});
  assert.equal(computeTaste(result.history,[track]).genres[0][1],1.5);
  const hydrated=sanitizeState(result);
  assert.equal(hydrated.history[0].context,'search');
  assert.equal(likedArtistLanes(hydrated.history)[0].artist,'Harry Styles');
  assert.equal(likedArtistLanes(hydrated.history)[0].weight,.5);
});

test('the same artist is not forced forever: exploration and artist-streak penalties apply', () => {
  const tracks=[
    {id:'deezer:100',artist:'Harry Styles',title:'A',genre:'pop',mood:'Bright'},
    {id:'deezer:200',artist:'Kacey Musgraves',title:'B',genre:'country',mood:'Warm'},
  ];
  const history=Array.from({length:6},(_,i)=>({id:`deezer:${400+i}`,artist:'Harry Styles',genre:'pop',action:'like'}));
  // Other styles receive an exploration bonus and don't get stuck behind 6 identical artist choices.
  assert.equal(selectNext(tracks,history,'all',()=>0,{seedArtists:['Harry Styles']}).artist,'Kacey Musgraves');
});

test('first-run choices are optional and can be reopened later from Discover', async () => {
  const main=await readFile(new URL('../app/public/main.js',import.meta.url),'utf8');
  assert.match(main,/if \(!shown && view === 'discover'\) openModal\('onboarding'\)/);
  assert.match(main,/action === 'onboarding-fresh'/); // case handled as an action condition below
  assert.match(main,/data-modal="onboarding-artists"/);
  assert.match(main,/Array.from\(\{length:FAVORITE_ARTIST_LIMIT\}/);
  assert.match(main,/data-intro-artist/);
  assert.match(main,/function updateArtistCount/);
  assert.match(main,/Real discovery lanes/);
  assert.match(main,/id === 'music-search'/);
  assert.match(main,/data-modal="onboarding-playlist"/);
  assert.match(main,/let seedActive = false/);
  const data={state:createInitialState(),catalog:[],current:null,allGenres:['all'],challengeIds:[],challengeResponses:[],catalogWarning:'',catalogLive:true,collectionQuery:'',collectionSort:'recent'};
  const sidebar=createViews({...data,seedInfo:{hasArtists:true,ready:true,active:false}}).renderSidebarPreferences();
  assert.match(sidebar,/data-action="open-intro"/);
  assert.match(sidebar,/data-action="import-playlist"/);
  assert.match(sidebar,/data-action="use-saved-artists"/);
});
